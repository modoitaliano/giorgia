import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const workflow = readFileSync(`${repositoryRoot}.github/workflows/deploy.yml`, 'utf8');
const promotion = readFileSync(`${repositoryRoot}scripts/promote-storybook.sh`, 'utf8');
const promotionScript = `${repositoryRoot}scripts/promote-storybook.sh`;
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runPromotion({ failPublicCheck = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'giorgia-storybook-deploy-'));
  temporaryDirectories.push(directory);
  const artifact = join(directory, 'storybook-static');
  const fakeBin = join(directory, 'bin');
  const originState = join(directory, 'origin-path');
  const awsLog = join(directory, 'aws.log');
  mkdirSync(join(artifact, 'assets'), { recursive: true });
  mkdirSync(fakeBin);
  writeFileSync(
    join(artifact, 'deployment.json'),
    JSON.stringify({ repository: 'modoitaliano/giorgia', sha: 'a'.repeat(40) }),
  );
  writeFileSync(join(artifact, 'index.html'), '<!doctype html>');
  writeFileSync(join(artifact, 'assets', 'manager-123.js'), 'export {};');
  writeFileSync(originState, '/releases/previous');

  const fakeAws = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'printf "%s\\n" "$*" >> "$FAKE_AWS_LOG"',
    'case "$1 $2" in',
    "  's3 sync'|'s3api head-object'|'cloudfront wait') exit 0 ;;",
    "  'cloudfront create-invalidation') printf '%s\\n' invalidation-1; exit 0 ;;",
    "  'cloudfront get-distribution-config')",
    '    origin=$(cat "$FAKE_ORIGIN_STATE")',
    "    jq -n --arg bucket \"$STORYBOOK_BUCKET_NAME\" --arg host \"${STORYBOOK_URL#https://}\" --arg origin \"$origin\" '{ETag: \"etag-1\", DistributionConfig: {Aliases: {Quantity: 1, Items: [$host]}, Origins: {Quantity: 1, Items: [{Id: \"storybook\", DomainName: ($bucket + \".s3.us-east-1.amazonaws.com\"), OriginPath: $origin}]}}}'",
    '    ;;',
    "  'cloudfront update-distribution')",
    '    config=',
    '    while [[ $# -gt 0 ]]; do',
    '      if [[ "$1" == --distribution-config ]]; then shift; config=${1#file://}; fi',
    '      shift || true',
    '    done',
    "    jq -r '.Origins.Items[0].OriginPath' \"$config\" > \"$FAKE_ORIGIN_STATE\"",
    "    printf '%s\\n' '{}'",
    '    ;;',
    '  *) echo "unexpected aws command: $*" >&2; exit 64 ;;',
    'esac',
  ].join('\n');
  const fakeCurl = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'if [[ "${FAKE_CURL_FAIL:-false}" == true ]]; then exit 22; fi',
    "jq -n --arg repository \"$GITHUB_REPOSITORY\" --arg sha \"$GITHUB_SHA\" '{repository: $repository, sha: $sha}'",
  ].join('\n');
  writeFileSync(join(fakeBin, 'aws'), fakeAws);
  writeFileSync(join(fakeBin, 'curl'), fakeCurl);
  chmodSync(join(fakeBin, 'aws'), 0o755);
  chmodSync(join(fakeBin, 'curl'), 0o755);

  const result = spawnSync('bash', [promotionScript, artifact], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AWS_REGION: 'us-east-1',
      FAKE_AWS_LOG: awsLog,
      FAKE_CURL_FAIL: String(failPublicCheck),
      FAKE_ORIGIN_STATE: originState,
      GITHUB_REPOSITORY: 'modoitaliano/giorgia',
      GITHUB_RUN_ID: '12345',
      GITHUB_SHA: 'a'.repeat(40),
      PATH: `${fakeBin}:${process.env.PATH}`,
      STORYBOOK_BUCKET_NAME: 'loredana-giorgia-storybook',
      STORYBOOK_DISTRIBUTION_ID: 'EDISTRIBUTION1',
      STORYBOOK_URL: 'https://ui.modoitaliano.fm',
    },
  });

  return {
    ...result,
    awsLog: readFileSync(awsLog, 'utf8'),
    originPath: readFileSync(originState, 'utf8').trim(),
  };
}

describe('Storybook deployment boundary', () => {
  it('builds pull requests without granting them AWS credentials', () => {
    expect(workflow).toMatch(/on:\n\s+pull_request:/);
    expect(workflow).toContain("if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain('name: giorgia-storybook');
    expect(workflow).toContain('id-token: write');
  });

  it('uses the Giorgia OIDC role and no long-lived AWS key inputs', () => {
    expect(workflow).toContain('role/giorgia-storybook-github-deploy');
    expect(workflow).toContain('aws-actions/configure-aws-credentials@v6.2.3');
    expect(workflow).not.toContain('aws-access-key-id');
    expect(workflow).not.toContain('aws-secret-access-key');
    expect(workflow).not.toContain('secrets.AWS_');
  });

  it('resolves resources from the Loredana stack and never republishes npm', () => {
    expect(workflow).toContain('LoredanaGiorgiaStorybookBucketName');
    expect(workflow).toContain('LoredanaGiorgiaStorybookDistributionId');
    expect(workflow).toContain('https://ui.modoitaliano.fm');
    expect(workflow).not.toMatch(/npm (publish|version)/);
  });

  it('stages immutable assets and can restore the prior CloudFront origin', () => {
    expect(promotion).toContain('release_path="/releases/$GITHUB_SHA"');
    expect(promotion).toContain('aws s3 sync');
    expect(promotion).not.toContain('aws s3 rm');
    expect(promotion).toContain('update_origin_path "$release_path"');
    expect(promotion).toContain('update_origin_path "$previous_origin_path"');
    expect(promotion).toContain('rollback_on_failure');
    expect(promotion).toContain('$STORYBOOK_URL/deployment.json');
  });

  it('promotes only after staging the complete commit-addressed release', () => {
    const result = runPromotion();

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.awsLog.indexOf('s3 sync')).toBeLessThan(
      result.awsLog.indexOf('cloudfront update-distribution'),
    );
    expect(result.originPath).toBe(`/releases/${'a'.repeat(40)}`);
  });

  it('restores the prior origin path when the public identity check fails', () => {
    const result = runPromotion({ failPublicCheck: true });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('restoring the prior release');
    expect(result.originPath).toBe('/releases/previous');
    expect(result.awsLog.match(/cloudfront update-distribution/g)).toHaveLength(2);
  });
});
