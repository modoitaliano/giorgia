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
- `@modoitaliano/giorgia/schemas/robots-input.schema.json` -> robots.txt rule set
- `@modoitaliano/giorgia/schemas/sitemap-input.schema.json` and
  `@modoitaliano/giorgia/schemas/sitemap-index-input.schema.json` -> sitemap files and index
- `@modoitaliano/giorgia/schemas/feed-input.schema.json` -> Atom feed of the latest stories
- `@modoitaliano/giorgia/schemas/search-manifest.schema.json` and
  `@modoitaliano/giorgia/schemas/search-index.schema.json` -> static-search resource contract
- `@modoitaliano/giorgia/partial-deps.json` -> partial-to-layout dependency map
- `@modoitaliano/giorgia/scenes` -> the program scene renderers Alcántara places:
  `ModoItalianoGiorgiaChyron`, `ModoItalianoGiorgiaClock`,
  `ModoItalianoGiorgiaProgramRow`, `ModoItalianoGiorgiaBracket` (with the
  `bracketModel` helpers) and `ModoItalianoGiorgiaPodcastPlayer`, plus the
  shared `GIORGIA` tokens

The root module retains local renderer exports for Storybook and compatibility,
but those exports are not part of Cronkite's opt-in path. See
[docs/cronkite-compatibility.md](docs/cronkite-compatibility.md) for ownership,
validation, search, and asset-rendering details.

### Program row

`ModoItalianoGiorgiaProgramRow` is the bottom row a scene draws when it lists
both the Giorgia clock and the Giorgia chyron. The clock's header sits top-left
by itself; the chyron and the clock's on-air block sit side by side between
`GIORGIA.safeX` and `GIORGIA.safeBottom` (z-index 950), the chyron slot keeping
at least half the row and disappearing while the chyron is hidden. Props:
`programId`, `audioBus`, optional `timeOverride` and `songSequence`, and the two
scenes' stored settings as `clockProps` (`showWorldClocks`, `showLogo`,
`showPlaybackProgress`, all on by default, and `keySafe`) and `chyronProps`
(`show`, on by default, `textSequence`, `ctaSequence` and `keySafe`). Settings
are read the way Alcántara reads them (booleans, non-zero numbers, and
`true`/`1`/`yes`/`on`); `keySafe` on either one keys the whole row. The clock
runs in Spanish at 220 px with 300 ms transitions, no city shuffle and no bell.

`resolveProgramRow(components)` makes the scene's decision: given the scene's
component types (retired ids already mapped to their Giorgia replacements), it
returns the plan (`clockType`, `chyronType` and the `ownedTypes` the row draws,
which must not also draw standalone) when both Giorgia types are listed, and
`null` otherwise.

### Song sequence ids

`normalizeProgramSongSequence` keeps a song's id stable. A song with a string
id keeps it. A song without one gets an id derived from its content (song id,
audio URL, title, artist and length), so normalising the same sequence again,
as each audio-bus update does, gives the same id and the song is not restarted.
When the same id-less song appears again in a sequence, the repeat gets an
occurrence suffix (`_2`, `_3`, ...), and the first keeps the id it has alone.
The ids match Alcántara's (gaulatti/alcantara#378).

### Shuffle order and rotation state

`shuffleProgramSongSequence` no longer reorders the operator's rows: it stores
the order shuffle plays as `shuffleOrder` (the song on air first) and leaves
`items` as they were, so Manual plays the rows again. `programSongPlayOrder`
returns the items in the order that plays (in shuffle, `shuffleOrder`, with
any item added since after it), and the selection walks that order.
`rowsAsPlayOrder` turns the shuffle back into rows for a backend that does not
play `shuffleOrder` (gaulatti/alcantara#834). A normalised song sequence keeps
the engine's `endedAt` (a rotation without loop ran out) and `cuedItemId` (the
item it left the cursor on without airing it).

### Bracket scene

`ModoItalianoGiorgiaBracket` draws the eight-song bracket in the Giorgia look:
square navy plates with hairlines, condensed type, the magenta rule on each
winner and on the draw, voting and final panels, and no rounded or gradient
styling. It keeps the props the stored scenes carry (`title`, `show`,
`startRound`, `matches`, `drawCommand`, `voters`, `matchVotes`,
`activeVotingMatchId`, `votingWinnerId`, `votingResultStartedAt` and
`loadSongCatalog`), so a scene saved for the former legacy bracket renders
unchanged. Covers and song names come from `loadSongCatalog`; nothing else
reaches the network.

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

Unit tests run in Node. A test that renders React components or hooks opts into a
DOM by starting the file with `// @vitest-environment happy-dom` and uses
`@testing-library/react` (pinned in `devDependencies`); other tests are unaffected.

## Storybook fixtures and built assets

`npm run storybook` and `npm run build-storybook` first run
`npm run storybook:assets`. It uses the existing CSS/navigation builders and
stages their output, template assets, local fonts and the live-program
`modoitaliano/` public assets in `.cache/storybook-public`.
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
npx tsx scripts/verify-storybook-artifact.ts
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

## Live program

`src/live-program/` holds only the live-program app entry (`main.tsx`, `index.html`); the components live in `src/components/live-program/`. Both the bundle (`import.meta.glob` in `main.tsx`) and the contract-v2 manifest build (`discoverLiveProgramComponents()`, default `src/components/live-program`) discover component files there, excluding tests; the build fails if none are found.

`LiveProgram` reads the active scene's component list (the `componentType` list the scene renderer passes as `activeComponents`, or the active scene layout's comma-separated `componentType`). It draws the radio components for Alcantara's own scene types:

| `componentType` | Component | Source of its values |
| --- | --- | --- |
| `modoitaliano-podcast-player` | Not rendered by Giorgia; Alcántara renders it from Bleecker's `PodcastPlayer` | Scene metadata for that type: `show`, `episodeTitle`, `showName`, `coverUrl`, `audioUrl` (and `masterGain` when given; full gain otherwise) |
| `modoitaliano-giorgia-podcast-player` | `ModoItalianoGiorgiaPodcastPlayer` | Same as above |
| `earone` | `Earone` | Rank and spins from the latest `song_playback_active` signal (`externalChartRank`, `externalChartSpins`), cleared by `song_off_air`; `label` from scene metadata |

It also draws seven TV graphics for Alcantara's scene types (`frontend/app/routes/program.tsx` at `b0e8f009`), mapped in `tv/TvSceneLayers.tsx`:

| `componentType` | Component | Source of its values |
| --- | --- | --- |
| `logo-widget` | `LogoWidget` | Scene metadata `logoUrl` and `position` (`top-right` or `bottom-right`, default `bottom-right`) (`:2294-2295`); nothing draws without a `logoUrl` |
| `reloj-loop-clock` | `RelojLoopClock` | Scene metadata `timezone`, `Europe/Madrid` when unset (`:2361-2362`) |
| `cronica-background` | `CronicaBackground` | None (`:2585-2586`) |
| `cronica-chyron` | `CronicaChyron` | Scene metadata `text`; nothing draws while it is empty (`:2587-2588`) |
| `cronica-reiteramos` | `CronicaReiteramos` | Scene metadata `text` (default `REITERAMOS`) and `show` (default `true`) (`:2589-2590`) |
| `modoitaliano-giorgia-clock` | `ModoItalianoGiorgiaClock` | Scene metadata `showWorldClocks`, `showLogo`, `showPlaybackProgress` (each default on) and `keySafe` (default off); the program's time override and song sequence (Alcantara `b4a51c7`, `:2460-2479`) |
| `modoitaliano-giorgia-chyron` | `ModoItalianoGiorgiaChyron` | Scene metadata `textSequence`, `ctaSequence`, `show` (read only when it is a boolean, default `true`) and `keySafe` (default off) (`b4a51c7`, `:2481-2491`) |

The TV graphics draw after the radio components, in the scene's list order, inside one full-frame box with no z-index, as Alcantara's scene container does (`:2251`). A scene that lists both Giorgia types draws them in the Giorgia bottom row instead (`tv/giorgiaProgramRow.tsx`, ported from Alcantara's `utils/programRow.ts` and `ModoItalianoProgramRow` at `b4a51c7`, `:2206`, `:2623`): the clock's header top-left, then, between the safe edges at the bottom, the chyron (at least half the row) and the clock's on-air block, after the other graphics. In the row the chyron's `show` is read like the other settings (`false`, `0`, `no`, `off` hide it), and `keySafe` on either type keys the whole row. With only one of the two listed, it draws by itself. The legacy `modoitaliano-*` row is never mixed with Giorgia and is not drawn. Each component's own z-index then stacks against the page's other layers, and an unpositioned graphic is not hidden by the stage's black filler. Per-component `zIndex` metadata (`:2254`, `:2610-2617`) is not read yet.

The podcast players never read song signals. A scene that lists a radio component or one of these TV graphics draws only the Modo Italiano layers it also lists (`modoitaliano-content`, `modoitaliano-marquee`); every other scene draws what it drew before. Nothing in the radio components or the TV mapping makes a network call.

The TV graphics read their text and song sequences through the shared `./scenes` program sequence module (`tv/programSequence.ts` only re-exports it), so a stored sequence resolves on TV the same way as in the program window: the same song ids, shuffle order and rotation state.

The top-right corner (world clocks and the red bell box) follows Alcantara's own program renderer (`gaulatti/alcantara` `frontend/app/routes/program.tsx` at `8bca10b`) on radio and TV graphics scenes only:

- **World clocks** draw on such a scene only when its list also names a clock type: `clock-widget` (`:2291`), `reloj-clock`, `reloj-digital-loop-clock` (`:2362-2366`), `toni-clock`, `fifthbell-clock`, `fifthbell-corner` (`:2401`) or `modoitaliano-clock` (`:2426`). The scene's `showWorldClocks` setting still applies on top. `reloj-loop-clock` and `modoitaliano-giorgia-clock` are not clock types for the corner: those scenes draw their own `RelojLoopClock` or Giorgia clock.
- **The bell** draws on such a scene only when its list names `toni-clock`, `fifthbell-clock` or `fifthbell-corner` (`:2196-2198`, `:2401-2425`): always for the two `fifthbell` types, and for `toni-clock` only when the scene metadata sets `showBellIcon: true` (Alcantara's default is off).

So a scene listing only `modoitaliano-podcast-player`, `modoitaliano-giorgia-podcast-player`, `earone`, `reloj-loop-clock`, a Crónica type or a Giorgia type shows no clocks and no bell. Every other scene keeps its corner exactly as before: its clocks and bell follow only `showWorldClocks` and `showBellIcon` (both on by default), whatever its list names. Making every scene follow its component list is separate, future work.

The TV graphics components live in `src/components/live-program/tv/`: `ModoItalianoChyron`, `ModoItalianoGiorgiaChyron`, `ModoItalianoClock`, `ModoItalianoGiorgiaClock`, `ModoItalianoDisclaimer`, `ModoItalianoBracket` (with `modoItalianoBracket.ts`), `CronicaChyron`, `CronicaBackground`, `CronicaReiteramos`, `CronicaLayout`, `RelojClone`, `RelojLoopClock` and `RelojDigitalLoopClock`, with stories under `stories/react/live-program/tv/` on the fictional `harbor-light` fixtures. Discovery finds them all; `LiveProgram` draws `LogoWidget`, `RelojLoopClock`, `CronicaBackground`, `CronicaChyron`, `CronicaReiteramos`, `ModoItalianoGiorgiaClock` and `ModoItalianoGiorgiaChyron` for the scene types above, and no scene type maps to the others yet. Their stylesheets are part of the bundle (one imports the Barlow fonts from Google Fonts). The bracket reads `audience_interaction_draw_*` payloads and still accepts `modoitaliano_bracket_draw_*`. Two components reach the program's API, and only with an explicit `apiBaseUrl` prop: the bracket reads `/songs?limit=0` when it is given no songs, and `RelojDigitalLoopClock` posts `/program/:programId/activate` when its countdown ends. Without that prop neither makes a request.

**Broadcast time override.** Alcantara's broadcast time override is program-wide, not a scene field: Alcantara's renderer builds it from its broadcast settings (`timeOverrideEnabled`, `timeOverrideStartTime`, `timeOverrideStartedAt`) and gives it to every clock. `LiveProgram` reads it from the latest `broadcast_settings_update` event, else from the projected state's optional `broadcastSettings` (added by gaulatti/alcantara#177), else there is none, and passes it to the corner world clocks and the Giorgia clock. It is active only when enabled with both values set. Until Alcantara sends `broadcastSettings` in the state, a page loaded while an override is already on shows real time until the next settings change.

**Giorgia clock and chyron.** `ModoItalianoGiorgiaClock` and `ModoItalianoGiorgiaChyron`, with their shared parts in `tv/giorgiaBroadcast.tsx` (`GiorgiaMark`, `GiorgiaRule`, `GiorgiaGrade`), follow Alcantara's current design: hard cuts, one magenta rule, condensed type on a navy grade. Both take `keySafe` (default `false`) for scenes shot over a chroma key: solid navy plates instead of the gradient, and no shadows or soft edges on type, mark or rule. A scene sets it as `keySafe` in its metadata for `modoitaliano-giorgia-clock` or `modoitaliano-giorgia-chyron`, read the way Alcantara reads it (booleans; non-zero numbers; `true`/`1`/`yes`/`on`). `LiveProgram` draws them for the `modoitaliano-giorgia-clock` and `modoitaliano-giorgia-chyron` scene types (see the table above), alone or in the bottom row. The clock's on-air block shows the song of the program's song sequence, which `LiveProgram` takes from the latest `audio_bus_update` (`settings.songSequence`), as Alcantara does; until one arrives, and on a page loaded while a sequence is already set, it shows none. Alcantara also shows the song its own audio bus is playing; the v2 event stream carries no playable track for it, so `LiveProgram` does not.

**Playing track.** When the projected state carries a `playingTrack` (`{ playbackId, title, artist, startedAt }`, added by gaulatti/alcantara#178), the Giorgia clock's on-air block shows that track instead of the song sequence. Alcantara sets it only once the playout engine has confirmed a start, and leaves it out otherwise. `LiveProgram` reads it from the `/state` snapshot, `program_state_snapshot`, every state-bearing signal (`scene_change`, `program_scenes_changed`, `program_media_groups_changed`, `program_stingers_changed`) and `playing_track_update { playingTrack?, updatedAt }`, the signal Alcantara sends whenever the track starts or ends; whichever arrived last wins, so one without the field clears it and the sequence shows again (`utils/playingTrack.ts`). A null title or artist shows as empty and is never filled from the sequence: with only one of them, that one leads the block; with neither, the block does not show. The track's cover is its own `coverUrl` (an absolute public https address, added by gaulatti/alcantara#179) when present. A value without the contract's shape (including a `coverUrl` that is not a string) is treated as absent.

**Cover box.** The on-air block's cover is the playing track's `coverUrl`, else the song's own cover (the sequence song's `coverUrl`). With no cover address, or when the image fails to load, the same box holds a placeholder drawn in CSS from the look's tokens: a navy square with the magenta rule along its foot, a solid plate when key-safe (`GiorgiaCoverPlaceholder` in `tv/giorgiaBroadcast.tsx`). The clock never falls back to a picture: it used to request `/cover.jpg`, which only Alcantara's own site serves. A default cover picture is a brand decision and is not bundled. `src/live-program-bundle.test.ts` fails the build test if the bundle references any site-absolute asset path (a quoted or `url()` path with an asset extension) that is not one of its own files. Against an Alcantara without #178 the field never arrives and the clock shows the sequence as before. The manifest lists `playing_track_update`, which Alcantara accepts from `cf7246f`: Alcantara rejects a manifest with any signal outside its `PROGRAM_TEMPLATE_V2_SIGNALS` (`program-template.service.ts:311-321`), and `src/live-program-manifest.test.ts` pins that set as of `cf7246f`. `docs/contracts/program-template-v2.schema.json` is a byte-for-byte copy of Alcantara's at `cf7246f`; registering this bundle needs an Alcantara at `cf7246f` or later.

TV images ship in the bundle under `modoitaliano/tv/` and are referenced bundle-relative through `MODOITALIANO_ASSETS.tv` (`src/components/live-program/assets.ts`), so they load when the bundle is served from a sub-path. Only `reloj.png`, the `ClockWidget` plate (byte-identical to `gaulatti/alcantara` `frontend/public/reloj.png` at `f13ee4d`, sha256 `3b62d40e…ce04823`), is carried; `ClockWidget` sets it as an inline `backgroundImage` so Vite does not resolve it at build time. Alcantara's three ModoRadio marks (`bug-sm.svg`, `bug-big.svg`, `reloj-modoradio_full_negro.svg`) are retired from Giorgia and are not bundled: `LogoWidget` draws only a scene-supplied `logoUrl` and draws nothing without one (so `CronicaLayout`, which passes none, shows no logo), and `RelojClone` draws its analogue clock without the wordmark plate beneath it. `src/live-program-bundle.test.ts` builds the bundle with the real config and checks that none of the retired marks or their names are in the output and that the manifest lists `reloj.png` with its sha256.

## Image variants

`featuredImage`, and the image blocks of a body, may carry the original's `width` and `height` (integers, pixels) and `variants`, an array of `{ url, width, height }` sorted by width ascending and holding only variants that exist. All three are optional and the original `url` is unchanged. When `variants` is present the templates emit `srcset` (the variants plus the original, when its width is known) and `sizes` for the slot, with `width` and `height` set; when it is absent they emit the original `url` exactly as before. Images below the fold are `loading='lazy'`; the lead image of a page is not, and carries `fetchpriority='high'`. The markup is written out at each image (Cronkite's contract lets a template name a partial only once, so a shared partial cannot serve a template with several images). Unknown extra fields are ignored. CSS background images (the editorial hero and the landing story card) cannot use `srcset` and still load the original.

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
