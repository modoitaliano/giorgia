import { describe, expect, it, vi } from 'vitest';
import { canonicalArticleSchema } from './types/canonical-article.js';

describe('canonicalArticleSchema.parse', () => {
  it('reports a root-level violation with the "/" path', () => {
    expect(() => canonicalArticleSchema.parse(5)).toThrow(/^Canonical document validation failed: \/ /);
  });

  it('reports the instance path of a nested violation', () => {
    expect(() => canonicalArticleSchema.parse({})).toThrow(/Canonical document validation failed: /);
  });

  it('does not mutate the input it validates', () => {
    const input = { untouched: true };
    expect(() => canonicalArticleSchema.parse(input)).toThrow();
    expect(input).toEqual({ untouched: true });
  });
});

describe('canonicalArticleSchema.parse error summarising', () => {
  it('tolerates a validator that reports no error list or message', async () => {
    vi.resetModules();
    vi.doMock('ajv/dist/2020.js', () => {
      const compile = () => {
        const validate = Object.assign(() => false, { errors: null as unknown });
        return validate;
      };
      return { Ajv2020: class { addFormat() {} compile = compile } };
    });
    const mod = await import('./types/canonical-article.js');
    expect(() => mod.canonicalArticleSchema.parse({})).toThrow('Canonical document validation failed: ');
    vi.doUnmock('ajv/dist/2020.js');

    vi.resetModules();
    vi.doMock('ajv/dist/2020.js', () => {
      const compile = () => Object.assign(() => false, { errors: [{ instancePath: '/a' }] });
      return { Ajv2020: class { addFormat() {} compile = compile } };
    });
    const withoutMessage = await import('./types/canonical-article.js');
    expect(() => withoutMessage.canonicalArticleSchema.parse({})).toThrow('/a is invalid');
    vi.doUnmock('ajv/dist/2020.js');
    vi.resetModules();
  });
});
