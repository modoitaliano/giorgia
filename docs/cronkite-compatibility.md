# Cronkite compatibility

Giorgia opts into Cronkite through the nested `templateRendering` object in
`dist/cronkite-manifest.json`. This is the sole CPS rendering contract. Cronkite
reads the JSON artifact, validates every referenced package file and input
schema, inspects the declared partial graph, and compiles Handlebars itself.
Page rendering does not import or execute Giorgia JavaScript.

## Declarative surface

Every layout in `src/layouts.ts` is a named renderable with:

- a package-relative Handlebars entry;
- the exact direct partials used by that entry;
- the canonical-document input schema; and
- an explicit response content type.

Every reachable partial is declared the same way. Dynamic partials, inline
partial decorators, and partial blocks were replaced with static dependencies.
The manifest also declares the retained `social-image` template as a 1080 by
1350 JPEG raster. Remotion is not a CPS renderable.

## Helpers and document ownership

The templates use only Cronkite's built-in and closed helper set. Primitive
helpers come from Cronkite; outlet-specific values come from `helperConfig`;
provider URLs come from `embedRegistry`. Article URLs, homepage slot
distribution, embed identifiers, search copy, status variants, and social-card
QR markup are supplied as document data. The legacy local renderer remains only
for Storybook and output-parity tests.

Search copy is complete for Spanish, English, and Italian, including headings,
form labels, empty and error states, result grammar, and pagination. It is
serialized into the page for the client-side search script instead of being
selected from `outletConfig`.

## System pages

The manifest owns complete canonical documents for 404, search, and coming-soon
pages in all three supported languages. Spanish is the unprefixed default:

- `html/404/index.html`, `html/search/index.html`, and
  `html/coming-soon/index.html`;
- `html/en/...` for English; and
- `html/it/...` for Italian.

Each system-page group names its renderable, content type, cache policy, output
key, and complete input document. The Spanish coming-soon copy remains:
`Próximamente` and
`Estamos preparando algo especial. Vuelve pronto para descubrirlo.`

## Static assets

Fonts, `fonts.css`, compiled Giorgia CSS, navigation JavaScript, the logo, and
default social images are explicit `staticAssets`. Templates link to
`/content/styles/giorgia.css`; CSS is no longer injected into each document.
Every destination key maps to one package source with its content type and cache
policy.

## Search resources

The browser search page still reads `search-manifest-{language}.json` and its
referenced index shards from the configured content origin. Spritz owns those
CMS resources; they are not static assets or executable Giorgia capabilities.

## Verification boundaries

The build validates the local manifest schema and package alignment. Unit tests
also inspect every template dependency, validate all system documents, reject
the retired executable contract, and compare declarative output with the local
renderer for article, homepage, category, search, and link-in-bio fixtures.
Deployment and live-runtime verification remain outside this repository's local
verification boundary.
