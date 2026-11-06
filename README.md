# @modoitaliano/giorgia

Server-side renderer and Handlebars template bundle for ModoItaliano pages.

## What it does

- Renders canonical content documents into HTML
- Supports the layouts declared by the packaged Cronkite manifest, including
  article, homepage, category, search, 404, coming-soon, live-story,
  link-in-bio, media, and standalone pages
- Ships declarative Handlebars templates, explicit partial dependencies, and static assets
- Ships a provider-neutral social-card template for Cronkite rasterization
- Preserves the masthead, footer, and radio player across same-language internal navigation

## Installation

```bash
npm install @modoitaliano/giorgia
```

## Cronkite usage

Cronkite reads `dist/cronkite-manifest.json`, validates the nested
`templateRendering` contract, and compiles the declared package templates. Page
publication does not import or execute Giorgia JavaScript.

Each supplied document must match the normative canonical schema in
[src/schemas/canonical-document.schema.json](src/schemas/canonical-document.schema.json).
TypeScript declarations and declarative runtime validation use that same artifact.

## Exports

- `@modoitaliano/giorgia` -> renderer entrypoint
- `@modoitaliano/giorgia/cronkite-manifest.json` -> data-only declarative template manifest
- `@modoitaliano/giorgia/video` -> legacy non-CPS Remotion entrypoint
- `@modoitaliano/giorgia/schemas/canonical-document.schema.json` -> canonical input contract
- `@modoitaliano/giorgia/schemas/feed-renderable-input.schema.json` -> feed publication envelope
- `@modoitaliano/giorgia/schemas/search-manifest.schema.json` and
  `@modoitaliano/giorgia/schemas/search-index.schema.json` -> static-search resource contract
- `@modoitaliano/giorgia/partial-deps.json` -> partial-to-layout dependency map

The root module retains local renderer exports for Storybook and compatibility,
but those exports are not part of Cronkite's opt-in path. See
[docs/cronkite-compatibility.md](docs/cronkite-compatibility.md) for ownership,
validation, search, and asset-rendering details.

### Artist bumper

The legacy Remotion entrypoint also registers `ModoItalianoArtistBumper`, a
12-second, 1920x1080 artist-and-song introduction. Its contract accepts exactly
four unique 16:9 image URLs, optional audio, artist and song text, credits, and
the station URL. The first three images, the identity card, and the final
`In onda ora` card use hard editorial cuts; only the final card's blue, violet,
and magenta background light fields move.

`robArtistBumperProps` is the bundled ROB / `Cento ragazze` reference fixture.
The Remotion composition and the `React/ArtistBumper` Storybook stories use the
same component and packaged assets. The timeline is fixed at 30 fps:

- `00:00.000-00:02.066`: three image cuts
- `00:02.066-00:07.366`: artist, song, and credits over the fourth image
- `00:07.366-00:12.000`: animated `In onda ora` card

## Development

```bash
npm install
npm run typecheck
npm run test:unit
npm run build
npm run verify:packed-contract
npm run storybook
```

## Storybook fixtures and built assets

`npm run storybook` and `npm run build-storybook` first run
`npm run storybook:assets`. It uses the existing CSS/navigation builders and
stages their output, template assets and local fonts in `.cache/storybook-public`.
Storybook serves and packages that directory at the artifact root, including
`/content/styles/giorgia.css`, `/content/fonts/fonts.css`, its referenced WOFF2
files and `/assets/giorgia-navigation.js`. Re-run the command after changing
staged assets. Direct `storybook build` without the preparation step is not the
supported build command.

Ordinary homepage/page and breaking-news/home partial examples use checked-in
fixtures; homepage slot calculations use `FIXTURE_NOW`. Only explicitly named
`Current` stories run editorial JSON loaders. The existing live-story page and
partial previews are named `Current` because they use those feeds. Live network
failures reject the loader and appear in Storybook's error display; they never
turn an unavailable feed into a successful fixture article. Fixture images,
third-party media and the existing radio shell's now-playing request remain
external runtime dependencies, separate from editorial preview loaders. The
breaking-news fixture is labelled as a layout fixture, not a current score or
live-match claim.

After building, run the browser/artifact regression against the exact output:

```sh
npm run build-storybook
node scripts/verify-storybook-artifact.mjs
```

The check starts an isolated loopback static server and fresh Chromium contexts,
verifies packaged asset bytes/MIME and applied styles/fonts, then exercises the
manager, fixture pages/partials and explicit live-failure controls. All external
requests are deliberately blocked: fixture stories must make no editorial feed
requests, and Current stories must show an error rather than fixture success.
Eleven additional synthetic negative controls fail the events index after a
successful homepage fetch, fail canonical article/event JSON, or supply
empty/null/invalid indexes. They assert the
exact error and request stage without claiming live-content success.
Third-party diagnostics are recorded separately. The JSON report is printed to
stdout; screenshots default to `.cache/storybook-artifact-evidence`. Optional
positional arguments specify the artifact directory and screenshot directory.
Use the project's installed Playwright Chromium (`npx playwright install chromium`
if not already available). Local artifact verification does not prove public
hosting or close the separate deployment/browser acceptance issue #7.

Loader contracts also exercise missing optional breaking-news fields, events
errors, and empty or invalid article collections without outbound requests:

```sh
node --import tsx --test scripts/preview-loader-contract.test.mjs
```

The mandatory managed-updater refresh is also covered by a local boundary check:

```sh
node --test scripts/agent-updater-boundary.test.mjs
```

It invokes the actual installed updater with disposable local Git remotes and
snapshots. Four cases assert strict missing/non-executable-sync failures,
preserved no-fetch failure, valid sync delegation and snapshot cleanup. Child
Git configuration is isolated, and downstream startup is a fixture observer;
this check does not claim real Clouseau installation or hosting verification.

## Persistent navigation

Standard page layouts replace only `#page-content` during same-origin, same-language navigation. The masthead, footer, and bottom radio player stay mounted, so an active stream continues without interruption. Each persistent shell surface has its own static View Transition identity, preventing the visible player bar from being redrawn with page content. Swup updates the URL, browser history, document metadata, focus announcement, and scroll position; native View Transitions animate the content where supported, with a CSS fallback and reduced-motion handling.

Page-local scripts that must run after a content swap use `data-swup-reload-script`. Initializers shared by several layouts expose an idempotent `window.__brokaw*` function and are called after each page view. Search and media pagination tag their query-only history entries so back/forward navigation can distinguish local state changes from page changes. Cross-language links and pages without the standard content boundary use a normal document navigation.

## Publish flow

- CI validates typecheck, unit tests, and package build on pull requests and `main` pushes.
- GitHub-hosted runners build, test, and deploy this public repository.
- A `v*` tag matching the version in `package.json` triggers the package workflow
  on a GitHub-hosted runner. The workflow builds and publishes
  `@modoitaliano/giorgia` to npm with provenance through the `giorgia` GitHub
  environment. The npm trusted publisher must authorize
  `modoitaliano/giorgia`, `publish.yml`, and `giorgia` for direct publishing.
- Verify the package version and `package-lock.json` match, merge the release
  commit to `main`, then tag that commit and push the tag. Confirm the publish
  workflow succeeds and `npm view @modoitaliano/giorgia version` reports the new
  version. The publish workflow rejects branch dispatches, mismatched tags, and
  versions already present on npm before publishing. It reports success only
  after npm serves the exact built version; a registry read failure or missing
  version fails the job. The `0.1.100` cutover release is the one-time manual
  exception tracked in [giorgia#12](https://github.com/modoitaliano/giorgia/issues/12);
  do not use this workflow for that release.
- Storybook pull requests build an immutable artifact but receive no AWS token.
  A push or manual run on `main` deploys that exact artifact to
  `https://ui.modoitaliano.fm` through the `giorgia-storybook` GitHub
  environment and short-lived AWS OIDC role
  `giorgia-github-deploy`. Storybook deployment never runs
  `npm publish` or changes the package version.

### Storybook infrastructure and rollback

The existing Modo Italiano `Loredana` CloudFormation stack owns the Storybook
bucket and CloudFront distribution. The workflow resolves outputs
`LoredanaGiorgiaBucketName` and
`LoredanaGiorgiaDistributionId`; it must never target the Fifthbell
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

Its permissions are limited to `cloudformation:DescribeStacks` for
`Loredana`;
`s3:ListBucket` and `s3:GetBucketLocation` on the dedicated bucket;
`s3:GetObject` and `s3:PutObject` on that bucket's `releases/*`; and
`cloudfront:GetDistribution`,
`cloudfront:GetDistributionConfig`, `cloudfront:UpdateDistribution`,
`cloudfront:CreateInvalidation`, and `cloudfront:GetInvalidation` on the one
Storybook distribution. It has no delete permission. No long-lived AWS key
belongs in GitHub secrets.

## Pull request verification

Local agent review uses the shared `clouseau` skill with the developer's
authenticated coding harness and the `.clouseau-local.json` recipe; it needs no
CI provider keys. `AGENTS.md` owns the rule: run it against the final committed
change before opening a PR, repair findings, and publish the passing signed
receipt in the initial ready PR body. Never push directly to `main`.

Every PR runs:

- `npm run typecheck`,
- `npm run test:coverage`: the Vitest `unit` project under V8 coverage; the Clouseau gate measures changed-line coverage of `src` (see below),
- `npm run build` and the packed declarative contract check (`node scripts/verify-packed-contract.mjs`),
- the workflow-contract tests in `.github/tests`.

The Clouseau gate (`coverage.mode: changed_lines` in `.github/clouseau.json`)
requires every line and branch a PR adds or modifies under `src` to be covered,
and repository-wide line and branch coverage must not fall below the base
revision's, which CI measures on the PR base. New behaviour needs a test, never
a coverage pragma. The mode is read from the base revision's configuration, so
a PR that changes it is itself judged by the previous mode.

A PR carrying an authenticated local review stamp is verified by the pinned
Clouseau engine without AI credentials; unstamped PRs use the CI reviewer.
Passing reviews receive a bot approval and native auto-merge. Unresolved
product-direction questions go to the owner, and changes to review controls need
the owner's `/approve-intent <head SHA>` comment. See [the purpose
contract](.github/clouseau.md). The CI engine is resolved from protected
Clouseau `main` at the start of each run (see
[automatic Clouseau CI upgrades](https://github.com/gaulatti/clouseau/blob/main/docs/automatic-ci-upgrades.md)).

Package publication and the Storybook deployment stay separate, explicitly
authorized workflows outside this review contract.

CI needs these repository secrets: `DEEPSEEK_API_KEY` and `TYPESAFE_API_KEY` for
the CI reviewer, and `DEPLOYMENT_TOKEN` (a token with contents write access
from an identity other than `github-actions[bot]`) for automatic repairs.
