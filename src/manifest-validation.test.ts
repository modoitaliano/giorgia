import { describe, expect, it } from 'vitest';
import { cronkiteManifest } from './cronkite-manifest.js';
import { assertManifestAlignment, type ManifestAlignmentSources } from './manifest-validation.js';
import { layoutFiles } from './layouts.js';
import { outletConfig } from './outlet-config.js';
import { version } from './version.js';
import type { CronkiteDeclarativeTemplateManifest } from './types/cronkite-manifest.generated.js';

const sources = (): ManifestAlignmentSources => ({
  layouts: Object.keys(layoutFiles),
  languages: outletConfig.supportedLanguages,
  defaultLanguage: outletConfig.defaultLanguage,
  packageName: cronkiteManifest.package,
  packageVersion: cronkiteManifest.version,
  exportedVersion: version,
});

const clone = () => structuredClone(cronkiteManifest) as CronkiteDeclarativeTemplateManifest;

describe('assertManifestAlignment boundaries', () => {
  it('accepts the shipped manifest', () => {
    expect(() => assertManifestAlignment(clone(), { ...sources(), exportedVersion: cronkiteManifest.version })).not.toThrow();
  });

  it('rejects a default language that differs from the source', () => {
    expect(() => assertManifestAlignment(clone(), { ...sources(), exportedVersion: cronkiteManifest.version, defaultLanguage: 'zz' })).toThrow(
      'default language drift',
    );
  });

  it('rejects a system page that points at an undeclared renderable', () => {
    const manifest = clone();
    manifest.templateRendering.systemPages[0].renderable = 'missing-renderable';
    expect(() => assertManifestAlignment(manifest, { ...sources(), exportedVersion: cronkiteManifest.version })).toThrow(
      'system page uses undeclared renderable: missing-renderable',
    );
  });
});
