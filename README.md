# @gaulatti/giorgia

Server-side renderer and Handlebars template bundle for ModoItaliano pages.

## What it does

- Renders canonical content documents into HTML
- Supports `article-page`, `homepage`, `category-page`, `live-story`, and `404` layouts
- Ships reusable Handlebars templates, partial dependency metadata, and compiled CSS
- Preserves the masthead, footer, and radio player across same-language internal navigation

## Installation

```bash
npm install @gaulatti/giorgia
```

## Basic usage

```ts
import { render } from '@gaulatti/giorgia';

const html = render(doc);
```

`doc` must match the canonical schema used by the renderer (see [src/types/canonical-article.ts](src/types/canonical-article.ts)).

## Exports

- `@gaulatti/giorgia` -> renderer entrypoint
- `@gaulatti/giorgia/partial-deps.json` -> partial-to-layout dependency map

## Development

```bash
npm install
npm run typecheck
npm run test:unit
npm run build
npm run storybook
```

## Persistent navigation

Standard page layouts replace only `#page-content` during same-origin, same-language navigation. The masthead, footer, and bottom radio player stay mounted, so an active stream continues without interruption. Each persistent shell surface has its own static View Transition identity, preventing the visible player bar from being redrawn with page content. Swup updates the URL, browser history, document metadata, focus announcement, and scroll position; native View Transitions animate the content where supported, with a CSS fallback and reduced-motion handling.

Page-local scripts that must run after a content swap use `data-swup-reload-script`. Initializers shared by several layouts expose an idempotent `window.__brokaw*` function and are called after each page view. Search and media pagination tag their query-only history entries so back/forward navigation can distinguish local state changes from page changes. Cross-language links and pages without the standard content boundary use a normal document navigation.

## Publish flow

- CI validates typecheck, unit tests, and package build on pull requests and `main` pushes.
- Package publish is triggered by pushing a `v*` tag.
