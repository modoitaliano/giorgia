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

Article pages display every supplied `authors[].name` in document order below
the excerpt in the editorial red accent, with the publication date on a
separate muted line. It reuses the category labels' existing `text-[#8f0d00]`
and `dark:text-[#ff2e1a]` utilities so the accent also works with previously
published, immutable stylesheets. Names are escaped as ordinary Handlebars
text and separated by commas. The byline uses no
language-specific label, synthesized credit, or author-profile link; author
identity remains CMS-owned. This uses the existing canonical-document schema
and Cronkite helpers. Storybook includes single-author, multiple-author,
long-credit, and dark-mode article examples.

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

## Unrecognized input

Owner's rule (gaulatti/ariston#217): if we don't recognize it, we ignore it.
The packaged input schemas (`canonical-document`, `feed-renderable-input`,
`social-image-input`, `search-manifest`) accept members they do not define,
and accept values this release does not know where a fallback exists:

| Input | Fallback |
|---|---|
| Body block with an unknown `type` | Dropped (the `body-block` partial renders nothing) |
| Heading `level` other than 2, 3 or 4 | Rendered as level 2 |
| `infoBox.tone` other than neutral/info/warning/success | Rendered as `neutral` |
| Spotify `embedKind` other than track/album/playlist/episode/show | Passed to Spotify as sent (lowercase letters only, as the manifest's `embedRegistry.spotify.kind` pattern) |
| `heroLayout` other than spotlight/editorial | Treated as absent |
| Embed provider the helper does not declare | `embedUrl` yields `''`; the guarded embed is omitted |

Every `embedUrl` call (X, TikTok, Spotify) sits inside `{{#with (embedUrl ...)}}`,
so an empty result renders no iframe.

These stay strict, because accepting them would be unsafe or leave nothing to
render: `status` (the publication guard), page `layout`, a known block type's
own required members, the Spotify kind's URL-safe pattern and the search
manifest's safe relative paths.

Giorgia's own renderers count each ignored item by reason. `ignoredInputCounts()`
(root export) returns the counters, and the first item of each reason writes one
`[giorgia] ignored unrecognized input: <reason>` warning naming only the reason.
Cronkite renders the declarative templates without those renderers, so on that
path the template gives the same fallback and any count belongs to Cronkite.

## Verification boundaries

The build validates the local manifest schema and package alignment. Unit tests
also inspect every template dependency, validate all system documents, reject
the retired executable contract, and compare declarative output with the local
renderer for article, homepage, category, search, and link-in-bio fixtures.
Deployment and live-runtime verification remain outside this repository's local
verification boundary.
