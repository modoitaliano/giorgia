import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { addContractFormats } from './json-schema-formats.js';

function validator(format: string) {
  const ajv = new Ajv2020({ strict: false });
  addContractFormats(ajv);
  return ajv.compile({ type: 'string', format });
}

describe('addContractFormats', () => {
  it('accepts RFC 3339 date-times and rejects malformed or impossible ones', () => {
    const check = validator('date-time');
    expect(check('2026-03-11T12:00:00.000Z')).toBe(true);
    expect(check('2026-03-11T12:00:00+02:00')).toBe(true);
    expect(check('2026-03-11')).toBe(false);
    expect(check('2026-13-45T99:00:00Z')).toBe(false);
  });

  it('accepts absolute URIs and rejects values the URL parser refuses', () => {
    const check = validator('uri');
    expect(check('https://modoitaliano.fm/a')).toBe(true);
    expect(check('not a uri')).toBe(false);
    expect(check('/relative')).toBe(false);
  });

  it('accepts UUIDs including the nil and max forms and rejects others', () => {
    const check = validator('uuid');
    expect(check('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(check('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(check('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
    expect(check('nope')).toBe(false);
  });
});
