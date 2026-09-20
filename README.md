# @gaulatti/giorgia

Server-side renderer and Handlebars template bundle for ModoItaliano pages.

## What it does

- Renders canonical content documents into HTML
- Supports the layouts declared by the packaged Cronkite manifest, including
  article, homepage, category, search, 404, coming-soon, live-story,
  link-in-bio, media, and standalone pages
- Ships reusable Handlebars templates, partial dependency metadata, and compiled CSS
- Ships provider-neutral social-image and Remotion short-video renderables
- Preserves the masthead, footer, and radio player across same-language internal navigation

## Installation

```bash
npm install @gaulatti/giorgia
```

## Basic usage

```ts
import { render } from "@gaulatti/giorgia";

const html = render(doc);
```

`doc` must match the normative canonical schema in
[src/schemas/canonical-document.schema.json](src/schemas/canonical-document.schema.json).
TypeScript declarations are generated from that schema; runtime rendering validates
against the same artifact.

## Exports

- `@gaulatti/giorgia` -> renderer entrypoint
- `@gaulatti/giorgia/cronkite-manifest.json` -> data-only CLS capability manifest
- `@gaulatti/giorgia/video` -> bundleable Remotion short-video entrypoint
- `@gaulatti/giorgia/schemas/canonical-document.schema.json` -> canonical input contract
- `@gaulatti/giorgia/schemas/search-manifest.schema.json` and
  `@gaulatti/giorgia/schemas/search-index.schema.json` -> static-search resource contract
- `@gaulatti/giorgia/partial-deps.json` -> partial-to-layout dependency map

The root module also exports `cronkiteManifest`, `outletConfig`, `version`,
`render`, `fontFiles`, `assetFiles`, and `buildInstagramImageHtml`. See
[docs/cronkite-compatibility.md](docs/cronkite-compatibility.md) for ownership,
validation, search, and asset-rendering details.

## Development

```bash
npm install
npm run typecheck
npm run test:unit
npm run build
npm run verify:packed-remotion
npm run storybook
```

## Persistent navigation

Standard page layouts replace only `#page-content` during same-origin, same-language navigation. The masthead, footer, and bottom radio player stay mounted, so an active stream continues without interruption. Each persistent shell surface has its own static View Transition identity, preventing the visible player bar from being redrawn with page content. Swup updates the URL, browser history, document metadata, focus announcement, and scroll position; native View Transitions animate the content where supported, with a CSS fallback and reduced-motion handling.

Page-local scripts that must run after a content swap use `data-swup-reload-script`. Initializers shared by several layouts expose an idempotent `window.__brokaw*` function and are called after each page view. Search and media pagination tag their query-only history entries so back/forward navigation can distinguish local state changes from page changes. Cross-language links and pages without the standard content boundary use a normal document navigation.

## Publish flow

- CI validates typecheck, unit tests, and package build on pull requests and `main` pushes.
- GitHub-hosted runners build, test, and deploy this public repository.
- A `v*` tag matching the version in `package.json` triggers the package workflow
  on a GitHub-hosted runner. The workflow builds and publishes
  `@gaulatti/giorgia` to npm with provenance through the `giorgia-npm` GitHub
  environment. The npm trusted publisher must authorize
  `modoitaliano/giorgia`, `publish.yml`, and `giorgia-npm` for direct publishing.
- Verify the package version and `package-lock.json` match, merge the release
  commit to `main`, then tag that commit and push the tag. Confirm the publish
  workflow succeeds and `npm view @gaulatti/giorgia version` reports the new
  version. The publish workflow rejects branch dispatches, mismatched tags, and
  versions already present on npm before publishing. It reports success only
  after npm serves the exact built version; a registry read failure or missing
  version fails the job.
- Storybook pull requests build an immutable artifact but receive no AWS token.
  A push or manual run on `main` deploys that exact artifact to
  `https://ui.modoitaliano.fm` through the `giorgia-storybook` GitHub
  environment and short-lived AWS OIDC role
  `giorgia-storybook-github-deploy`. Storybook deployment never runs
  `npm publish` or changes the package version.

### Storybook infrastructure and rollback

The Modo Italiano `Loredana` CloudFormation stack owns the dedicated Storybook
bucket and CloudFront distribution. The workflow resolves outputs
`LoredanaGiorgiaStorybookBucketName` and
`LoredanaGiorgiaStorybookDistributionId`; it must never target the Fifthbell
`ui.fifthbell.com` resources used by Brokaw.

Each build carries `deployment.json` with its repository, package version, run,
and full Git SHA. Deployment uploads to `/releases/<sha>` and changes the
CloudFront origin path only after the complete immutable prefix is present.
The previous origin path is retained and restored automatically if the public
identity check fails after promotion. A failed build or upload therefore
cannot partially overwrite the last known-good documentation.

The deployment log records the previous origin path. For an
operator-authorized manual rollback, fetch the current distribution config and
ETag, restore only the dedicated S3 origin's `OriginPath` to that recorded
`/releases/<sha>` value, submit the update with the ETag, wait for CloudFront to
deploy, and invalidate `/*`. Confirm the public `deployment.json` reports the
expected prior SHA. Do not delete release prefixes until a separately reviewed
retention policy exists.

The deployment role must trust only audience `sts.amazonaws.com` and the
repository's current immutable GitHub OIDC subject:

```text
repo:modoitaliano@327696306/giorgia@1304750193:environment:giorgia-storybook
```

Its permissions are limited to `cloudformation:DescribeStacks` for Loredana;
`s3:ListBucket` and `s3:GetBucketLocation` on the dedicated bucket;
`s3:GetObject` and `s3:PutObject` on that bucket's `releases/*`; and
`cloudfront:GetDistribution`,
`cloudfront:GetDistributionConfig`, `cloudfront:UpdateDistribution`,
`cloudfront:CreateInvalidation`, and `cloudfront:GetInvalidation` on the one
Storybook distribution. It has no delete permission. No long-lived AWS key
belongs in GitHub secrets.
