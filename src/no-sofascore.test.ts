import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cronkiteManifest } from './cronkite-manifest.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * This outlet covers music and never publishes a SofaScore embed. The provider
 * came from another outlet's library and must not return through the embed
 * registry, a template, or the client/preview code that supported it.
 */
describe('SofaScore removal', () => {
  it('declares no SofaScore embed provider', () => {
    expect(Object.keys(cronkiteManifest.templateRendering.embedRegistry).filter((name) => /sofascore/i.test(name))).toEqual([]);
  });

  it('keeps SofaScore out of templates, client, renderer and preview code', () => {
    const roots = ['src/templates', 'client', 'stories', 'src/components', 'src/renderer.core.ts', 'src/cronkite-manifest.ts'];
    const offenders: string[] = [];
    const visit = (target: string) => {
      const absolute = path.join(projectRoot, target);
      if (fs.statSync(absolute).isDirectory()) {
        for (const entry of fs.readdirSync(absolute)) visit(path.join(target, entry));
      } else if (/sofascore/i.test(fs.readFileSync(absolute, 'utf8'))) {
        offenders.push(target);
      }
    };
    roots.forEach(visit);
    expect(offenders).toEqual([]);
  });
});
