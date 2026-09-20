# Cronkite compatibility

Giorgia owns ModoItaliano's renderer identity and declares it through
`cronkiteManifest`. The source object lives in `src/cronkite-manifest.ts`; the
build validates it against the CPS-02 schema and emits
`dist/cronkite-manifest.json`. Consumers can read the JSON export before they
execute package code.

## Identity and drift boundaries

The manifest package and version must match `package.json` and the exported
`version`. Its ordered layout list must match `src/layouts.ts`, and its language
list must match `outletConfig.supportedLanguages`. The build also checks every
declared function export and every packed entry or schema path. A mismatch fails
the build instead of becoming a runtime renderer guess.

The canonical-document TypeScript declaration is generated from
`src/schemas/canonical-document.schema.json`, the CPS-03 normative schema.
Giorgia's runtime validation uses that same JSON Schema. The previous local Zod
copy is not an independent contract.

## Feed renderables

`homepage`, `category-page`, `search-page`, and `link-in-bio` are request-scoped
HTML renderables using the root `render` export. Spritz supplies a `document`
and `feed` object for each; Cronkite validates that envelope against the packed
`dist/schemas/feed-renderable-input.schema.json` before constructing the page
document. The build checks the schema path and renderer export for every
declaration, then emits the six-renderable manifest into `dist`.

## Declared system pages

The manifest owns localized copy for 404, search, and coming-soon pages in
Spanish, English, and Italian. The current Spanish coming-soon copy is preserved
exactly:

- `Próximamente`
- `Estamos preparando algo especial. Vuelve pronto para descubrirlo.`

The system-page descriptors include their routes, output keys, cache policy,
language expansion, and copy. Giorgia declares `es` as its default and supports
`es`, `en`, and `it`.

## Search resource contract and known producer gap

The browser search page fetches
`search-manifest-{language}.json` from the configured content root. That file
contains `files.currentMonth` plus zero or more `files.yearly` shard paths. Each
referenced shard contains an `articles` array; an article requires `title` and
`slug` and may contain `excerpt`, `photoUrl`, and `publishedAt`.

The packed schemas are:

- `dist/schemas/search-manifest.schema.json`
- `dist/schemas/search-index.schema.json`

The `search-page` renderable declares the language-specific manifest as a
CMS-owned resource. The manifest schema documents that every referenced file
must validate against the index-shard schema and names that schema in its
`x-referenced-payload-schema` annotation.

Repository inspection on 2026-09-15 confirmed that Spritz does not currently
produce either resource. The search layout remains declared because it is a
real Giorgia capability, but the missing producer is now an explicit CMS-02
compatibility gap rather than an invisible renderer failure.

## Asset renderables and capabilities

Giorgia declares:

- `social-image`, using the existing `buildInstagramImageHtml` HTML-raster
  export at 1080 by 1350 JPEG;
- `short-video`, using the bundleable `dist/video/index.js` Remotion entry and
  `ModoItalianoShort` composition;
- `fonts`, using `fontFiles`;
- `assets`, using `assetFiles`.

The short-video template accepts caller-owned brand colors, identity, URLs,
logo/background assets, slide copy, and optional audio. It contains no
Fifthbell or Sanremo branding. `npm run verify:packed-remotion` builds and packs
Giorgia, installs the tarball into a clean consumer directory, reads the
data-only manifest, and bundles the declared entry from the installed package.

Giorgia has live-program UI code, but it does not yet publish a generic
program-template contract. The manifest therefore does not advertise a
`live-program` renderable or write-ordering rule.
