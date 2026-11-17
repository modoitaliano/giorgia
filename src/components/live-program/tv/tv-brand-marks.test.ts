// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockWidget } from './ClockWidget.js';
import { LogoWidget } from './LogoWidget.js';
import RelojClone from './RelojClone.js';

// giorgia#48: the clock plate ships with the bundle; the three ModoRadio marks are retired.
const CLOCK_PLATE = './modoitaliano/tv/reloj.png';
const CLOCK_PLATE_SHA256 = '3b62d40eee4973c34932b86bf1eb023587ca4fed4b8b7cc682f7ac1a5ce04823';
const RETIRED_MARKS = ['bug-sm.svg', 'bug-big.svg', 'reloj-modoradio_full_negro.svg'];
const TV_IMAGES = ['reloj.png', ...RETIRED_MARKS];

// Fictional harbor-light logo.
const HARBOR_LOGO = './harbor-light/logo.svg';

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listSourceFiles(path) : [path];
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T10:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LogoWidget draws only a scene-supplied logo', () => {
  it('draws the scene logoUrl on the plate and nothing else', () => {
    const { container } = render(h(LogoWidget, { logoUrl: HARBOR_LOGO }));
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe(HARBOR_LOGO);
    expect(container.querySelector('.logo-widget')!.className).toContain('bottom-right');
  });

  it('draws nothing at all without logoUrl, not an empty plate', () => {
    const { container } = render(h(LogoWidget, { position: 'top-right' }));
    expect(container.innerHTML).toBe('');
    act(() => {
      vi.advanceTimersByTime(40000);
    });
    expect(container.innerHTML).toBe('');
  });
});

describe('ClockWidget plate', () => {
  it('loads reloj.png bundle-relative from an inline background image', () => {
    const { container } = render(h(ClockWidget, { timezone: 'Europe/Rome' }));
    const plate = container.querySelector<HTMLElement>('.clock-widget')!;
    expect(plate.style.backgroundImage).toContain(CLOCK_PLATE);
  });
});

describe('RelojClone', () => {
  it('draws the analogue clock without the retired ModoRadio mark', () => {
    const { container } = render(h(RelojClone, { timezone: 'Europe/Rome' }));
    expect(container.querySelector('.clock-face')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('modoradio');
  });
});

describe('TV image sources', () => {
  it('ships reloj.png byte-identical to Alcantara f13ee4d and none of the retired marks', () => {
    const dir = 'src/live-program/public/modoitaliano/tv';
    expect(readdirSync(dir)).toEqual(['reloj.png']);
    const sha256 = createHash('sha256').update(readFileSync(join(dir, 'reloj.png'))).digest('hex');
    expect(sha256).toBe(CLOCK_PLATE_SHA256);
  });

  it('leaves no root-absolute reference to the four TV images in src', () => {
    // The same pattern as the ticket's grep, over every file in src, tests included.
    const rootAbsolute = new RegExp(`['"(]/(${TV_IMAGES.map((name) => name.replace(/\./g, '\\.')).join('|')})`);
    const offenders = listSourceFiles('src').filter((path) => rootAbsolute.test(readFileSync(path, 'latin1')));
    expect(offenders).toEqual([]);
  });

  it('leaves no reference to the retired ModoRadio marks outside the tests in src', () => {
    // Tests name the marks to prove they are gone; nothing else in src may.
    const offenders = listSourceFiles('src')
      .filter((path) => !/\.test\.tsx?$/.test(path))
      .filter((path) => {
        const text = readFileSync(path, 'latin1');
        return RETIRED_MARKS.some((name) => text.includes(name));
      });
    expect(offenders).toEqual([]);
  });
});
