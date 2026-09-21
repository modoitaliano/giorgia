import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import Handlebars from 'handlebars';
import { describe, expect, it } from 'vitest';
import { cronkiteManifest } from './cronkite-manifest.js';
import { addContractFormats } from './json-schema-formats.js';
import { layoutFiles } from './layouts.js';
import { assertManifestAlignment } from './manifest-validation.js';
import { outletConfig } from './outlet-config.js';
import type { CronkiteDeclarativeTemplateManifest } from './types/cronkite-manifest.generated.js';
import { version } from './version.js';

const require = createRequire(import.meta.url);
const schema = require('./schemas/cronkite-manifest.schema.json') as object;
const canonicalSchema = require('./schemas/canonical-document.schema.json') as object;
const packageJson = require('../package.json') as { name: string; version: string };
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceSchemaPath(packedPath: string): string {
  expect(packedPath.startsWith('dist/schemas/'), packedPath).toBe(true);
  return path.join(projectRoot, 'src', packedPath.slice('dist/'.length));
}

function expectSafePackagePath(packagePath: string): void {
  expect(path.isAbsolute(packagePath), packagePath).toBe(false);
  expect(packagePath.split('/'), packagePath).not.toContain('..');
}

const sources = () => ({
  layouts: Object.keys(layoutFiles),
  languages: outletConfig.supportedLanguages,
  defaultLanguage: outletConfig.defaultLanguage,
  packageName: packageJson.name,
  packageVersion: packageJson.version,
  exportedVersion: version,
});

function directPartials(source: string): string[] {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, unknown>;
    if (value.type === 'Decorator' || value.type === 'DecoratorBlock' || value.type === 'PartialBlockStatement') {
      throw new Error(`forbidden Handlebars node ${String(value.type)}`);
    }
    if (value.type === 'PartialStatement') {
      const name = value.name as { type?: string; original?: string } | undefined;
      if (name?.type !== 'PathExpression' || !name.original) throw new Error('dynamic partial');
      found.push(name.original);
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(Handlebars.parse(source));
  return found;
}

describe('Cronkite declarative template manifest', () => {
  it('validates against the local declarative manifest schema', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addContractFormats(ajv);
    const validate = ajv.compile(schema);
    expect(validate(cronkiteManifest), JSON.stringify(validate.errors)).toBe(true);
  });

  it('is the sole opt-in and stays aligned with package, layouts, and languages', () => {
    expect(() => assertManifestAlignment(cronkiteManifest, sources())).not.toThrow();
    expect(cronkiteManifest).not.toHaveProperty('contract');
    expect(cronkiteManifest).not.toHaveProperty('layouts');
    expect(cronkiteManifest).not.toHaveProperty('renderables');
    expect(cronkiteManifest.templateRendering.contract).toBe('cronkite.templates');
    expect(cronkiteManifest.templateRendering.helperConfig).toMatchObject({
      defaultLanguage: 'es',
      supportedLanguages: ['es', 'en', 'it'],
      prefixDefaultLocale: false,
    });
  });

  it('declares exact, static partial graphs and safe packed paths', () => {
    const rendering = cronkiteManifest.templateRendering;
    for (const [name, definition] of Object.entries(rendering.partials)) {
      const sourcePath = path.join(projectRoot, definition.entry);
      expect(fs.statSync(sourcePath).isFile(), `${name} entry`).toBe(true);
      expect(directPartials(fs.readFileSync(sourcePath, 'utf8')), name).toEqual(definition.partials);
    }
    for (const [name, definition] of Object.entries(rendering.renderables)) {
      const sourcePath = path.join(projectRoot, definition.template.entry);
      expect(fs.statSync(sourcePath).isFile(), `${name} entry`).toBe(true);
      expect(directPartials(fs.readFileSync(sourcePath, 'utf8')), name).toEqual(definition.template.partials);
      expect(fs.statSync(sourceSchemaPath(definition.inputSchema)).isFile(), `${name} schema`).toBe(true);
    }
    for (const [key, definition] of Object.entries(rendering.staticAssets)) {
      expectSafePackagePath(definition.source);
      if (definition.source.startsWith('src/')) {
        expect(fs.statSync(path.join(projectRoot, definition.source)).isFile(), key).toBe(true);
      }
    }
  });

  it('declares every page plus retained social-card rasterization and no Remotion renderable', () => {
    expect(Object.keys(cronkiteManifest.templateRendering.renderables)).toEqual([
      ...Object.keys(layoutFiles),
      'social-image',
    ]);
    expect(cronkiteManifest.templateRendering.renderables['social-image']).toMatchObject({
      inputSchema: 'dist/schemas/social-image-input.schema.json',
      contentType: 'image/jpeg',
      raster: { format: 'jpeg', width: 1080, height: 1350 },
    });
    expect(JSON.stringify(cronkiteManifest)).not.toContain('remotion');
    expect(JSON.stringify(cronkiteManifest)).not.toContain('export');
  });

  it('owns complete, schema-valid localized system documents with an unprefixed default language', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addContractFormats(ajv);
    const validate = ajv.compile(canonicalSchema);
    for (const page of cronkiteManifest.templateRendering.systemPages) {
      expect(page.variants).toHaveLength(3);
      expect(page.variants[0].key).not.toContain('/es/');
      for (const variant of page.variants) {
        expect(validate(variant.document), JSON.stringify(validate.errors)).toBe(true);
      }
    }
    const search = cronkiteManifest.templateRendering.systemPages.find((page) => page.renderable === 'search-page');
    expect(search?.variants.map((variant) => (variant.document as Record<string, unknown>).searchCopy)).toHaveLength(3);
    for (const [renderable, segment] of [['404', '404'], ['search-page', 'search'], ['coming-soon', 'coming-soon']] as const) {
      const page = cronkiteManifest.templateRendering.systemPages.find((candidate) => candidate.renderable === renderable);
      expect(page?.variants.map((variant) => variant.key)).toEqual([
        `html/${segment}/index.html`,
        `html/en/${segment}/index.html`,
        `html/it/${segment}/index.html`,
      ]);
      expect(page?.variants.map((variant) => variant.document.slug)).toEqual([
        `/${segment}`,
        `/en/${segment}`,
        `/it/${segment}`,
      ]);
    }
  });

  it('fails closed when identity, layouts, languages, or system-page languages drift', () => {
    const layouts = structuredClone(cronkiteManifest) as CronkiteDeclarativeTemplateManifest;
    delete layouts.templateRendering.renderables.homepage;
    expect(() => assertManifestAlignment(layouts, sources())).toThrow('layout drift');

    const languages = structuredClone(cronkiteManifest) as CronkiteDeclarativeTemplateManifest;
    languages.templateRendering.helperConfig.supportedLanguages = ['es'];
    expect(() => assertManifestAlignment(languages, sources())).toThrow('language drift');

    const identity = structuredClone(cronkiteManifest) as CronkiteDeclarativeTemplateManifest;
    identity.version = '9.9.9';
    expect(() => assertManifestAlignment(identity, sources())).toThrow('package identity drift');

    const system = structuredClone(cronkiteManifest) as CronkiteDeclarativeTemplateManifest;
    system.templateRendering.systemPages[0].variants.pop();
    expect(() => assertManifestAlignment(system, sources())).toThrow('system page 404 languages drift');
  });
});
