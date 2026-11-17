// The built stylesheet must keep the unprefixed backdrop-filter: Chromium ignores
// -webkit-backdrop-filter, and Vite's CSS minifier keeps only the last of the pair.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const CSS = fileURLToPath(new URL('./RelojLoopClock.css', import.meta.url));

describe('RelojLoopClock stylesheet in a Vite build', () => {
  it('keeps the unprefixed backdrop-filter blur on the tint layer', async () => {
    const output = await build({
      configFile: false,
      logLevel: 'silent',
      build: { write: false, rollupOptions: { input: CSS } },
    });
    const bundles = Array.isArray(output) ? output : [output];
    const css = bundles
      .flatMap((bundle) => ('output' in bundle ? bundle.output : []))
      .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
      .map((chunk) => String((chunk as { source: string | Uint8Array }).source))
      .join('\n');
    const tint = css.match(/\.reloj-loop-root:before\{[^}]*\}/)?.[0] ?? '';
    expect(tint).toMatch(/(^|[{;])backdrop-filter:blur\(14px\)/);
  }, 60000);
});
