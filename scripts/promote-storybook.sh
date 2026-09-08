#!/usr/bin/env bash

set -euo pipefail

artifact_dir=${1:-storybook-static}
: "${AWS_REGION:?AWS_REGION is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${STORYBOOK_BUCKET_NAME:?STORYBOOK_BUCKET_NAME is required}"
: "${STORYBOOK_DISTRIBUTION_ID:?STORYBOOK_DISTRIBUTION_ID is required}"
: "${STORYBOOK_URL:?STORYBOOK_URL is required}"

[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "GITHUB_SHA must be a complete lowercase Git commit SHA" >&2
  exit 2
}
[[ "$STORYBOOK_BUCKET_NAME" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || {
  echo "STORYBOOK_BUCKET_NAME is invalid" >&2
  exit 2
}
[[ "$STORYBOOK_DISTRIBUTION_ID" =~ ^[A-Z0-9]+$ ]] || {
  echo "STORYBOOK_DISTRIBUTION_ID is invalid" >&2
  exit 2
}
[[ "$STORYBOOK_URL" =~ ^https://[A-Za-z0-9.-]+$ ]] || {
  echo "STORYBOOK_URL must be an origin-only HTTPS URL" >&2
  exit 2
}
[[ -d "$artifact_dir" && -f "$artifact_dir/deployment.json" ]] || {
  echo "Storybook artifact or deployment identity is missing" >&2
  exit 2
}

jq -e \
  --arg repository "$GITHUB_REPOSITORY" \
  --arg sha "$GITHUB_SHA" \
  '.repository == $repository and .sha == $sha' \
  "$artifact_dir/deployment.json" >/dev/null

release_path="/releases/$GITHUB_SHA"
release_uri="s3://$STORYBOOK_BUCKET_NAME${release_path}/"
public_host=${STORYBOOK_URL#https://}
scratch_dir=$(mktemp -d)
previous_origin_path=
distribution_promoted=false
deployment_verified=false

read_distribution() {
  aws cloudfront get-distribution-config \
    --id "$STORYBOOK_DISTRIBUTION_ID" \
    --output json > "$scratch_dir/distribution-response.json"

  local matching_origins
  matching_origins=$(jq \
    --arg bucket "$STORYBOOK_BUCKET_NAME" \
    '[.DistributionConfig.Origins.Items[] | select(
      .DomainName == ($bucket + ".s3.amazonaws.com") or
      (.DomainName | startswith($bucket + ".s3."))
    )] | length' \
    "$scratch_dir/distribution-response.json")
  [[ "$matching_origins" == 1 ]] || {
    echo "Distribution must have exactly one origin for the configured Storybook bucket" >&2
    return 1
  }

  jq -e --arg host "$public_host" \
    '.DistributionConfig.Aliases.Items | index($host) != null' \
    "$scratch_dir/distribution-response.json" >/dev/null || {
      echo "Distribution does not own the configured Storybook hostname" >&2
      return 1
    }
}

current_origin_path() {
  jq -r \
    --arg bucket "$STORYBOOK_BUCKET_NAME" \
    '.DistributionConfig.Origins.Items[] | select(
      .DomainName == ($bucket + ".s3.amazonaws.com") or
      (.DomainName | startswith($bucket + ".s3."))
    ) | .OriginPath' \
    "$scratch_dir/distribution-response.json"
}

update_origin_path() {
  local target_path=$1
  local etag

  read_distribution
  etag=$(jq -er '.ETag' "$scratch_dir/distribution-response.json")
  jq \
    --arg bucket "$STORYBOOK_BUCKET_NAME" \
    --arg path "$target_path" \
    '(.DistributionConfig.Origins.Items[] | select(
      .DomainName == ($bucket + ".s3.amazonaws.com") or
      (.DomainName | startswith($bucket + ".s3."))
    ).OriginPath) = $path | .DistributionConfig' \
    "$scratch_dir/distribution-response.json" > "$scratch_dir/distribution-config.json"
  aws cloudfront update-distribution \
    --id "$STORYBOOK_DISTRIBUTION_ID" \
    --if-match "$etag" \
    --distribution-config "file://$scratch_dir/distribution-config.json" \
    --output json >/dev/null
}

invalidate_distribution() {
  local invalidation_id
  invalidation_id=$(aws cloudfront create-invalidation \
    --distribution-id "$STORYBOOK_DISTRIBUTION_ID" \
    --paths '/*' \
    --query 'Invalidation.Id' \
    --output text)
  aws cloudfront wait invalidation-completed \
    --distribution-id "$STORYBOOK_DISTRIBUTION_ID" \
    --id "$invalidation_id"
}

rollback_on_failure() {
  local exit_status=$?
  trap - EXIT

  if [[ "$exit_status" -ne 0 && "$distribution_promoted" == true && "$deployment_verified" != true ]]; then
    set +e
    echo "Promotion failed after the origin switch; restoring the prior release" >&2
    if aws cloudfront wait distribution-deployed --id "$STORYBOOK_DISTRIBUTION_ID" &&
      update_origin_path "$previous_origin_path" &&
      aws cloudfront wait distribution-deployed --id "$STORYBOOK_DISTRIBUTION_ID" &&
      invalidate_distribution; then
      rollback_status=0
    else
      rollback_status=1
    fi
    set -e
    if [[ "$rollback_status" -ne 0 ]]; then
      echo "Automatic rollback failed; restore origin path '$previous_origin_path' immediately" >&2
    fi
  fi

  rm -rf "$scratch_dir"
  exit "$exit_status"
}
trap rollback_on_failure EXIT

# Upload into a commit-addressed prefix. Nothing live is overwritten during
# staging, and the previous release remains available as a rollback target.
aws s3 sync "$artifact_dir/" "$release_uri" \
  --only-show-errors \
  --cache-control 'no-cache, must-revalidate'
if [[ -d "$artifact_dir/assets" ]]; then
  aws s3 sync "$artifact_dir/assets/" "${release_uri}assets/" \
    --only-show-errors \
    --cache-control 'public, max-age=31536000, immutable'
fi
aws s3api head-object \
  --bucket "$STORYBOOK_BUCKET_NAME" \
  --key "releases/$GITHUB_SHA/deployment.json" \
  --output json >/dev/null

read_distribution
previous_origin_path=$(current_origin_path)
if [[ "$previous_origin_path" != "$release_path" ]]; then
  update_origin_path "$release_path"
  distribution_promoted=true
  aws cloudfront wait distribution-deployed --id "$STORYBOOK_DISTRIBUTION_ID"
  invalidate_distribution
fi

deployed_identity=$(curl \
  --fail \
  --silent \
  --show-error \
  --location \
  --max-time 30 \
  "$STORYBOOK_URL/deployment.json?run=$GITHUB_RUN_ID")
jq -e \
  --arg repository "$GITHUB_REPOSITORY" \
  --arg sha "$GITHUB_SHA" \
  '.repository == $repository and .sha == $sha' \
  <<< "$deployed_identity" >/dev/null
deployment_verified=true

echo "Promoted $GITHUB_REPOSITORY@$GITHUB_SHA from '$previous_origin_path' to '$release_path'"
