import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

// gaulatti/giorgia#74: the song-box animation for a motion that is 'in' while no card is up. The component
// only sets 'in' together with the card, so a page never shows that state; this forces it to prove the
// animation is still the "In" one, not the "Out" one. The clock keeps its box motion in its twelfth piece of
// state; the wrapper gives that one 'in'.

const forced = vi.hoisted(() => ({ motion: null as 'in' | 'out' | null, calls: 0 }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const STATES_IN_CLOCK = 12;
  const MOTION_STATE = 11;
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = forced.calls++ % STATES_IN_CLOCK;
      const real = actual.useState(initial as never);
      return forced.motion && index === MOTION_STATE ? [forced.motion, real[1]] : real;
    },
  };
});

import { ModoItalianoClock } from './ModoItalianoClock.js';

afterEach(() => {
  cleanup();
  forced.motion = null;
  forced.calls = 0;
  vi.restoreAllMocks();
});

const card = (container: HTMLElement) =>
  (container.firstElementChild as HTMLElement).querySelector(':scope > div:last-child') as HTMLElement;

it("plays the 'In' animation for an 'in' motion with no song card, and the 'Out' one for 'out'", () => {
  for (const [motion, name] of [
    ['in', 'modoItalianoClockSongBoxIn'],
    ['out', 'modoItalianoClockSongBoxOut'],
  ] as const) {
    forced.motion = motion;
    forced.calls = 0;
    const view = render(<ModoItalianoClock programId='p' />);
    expect(card(view.container).style.animation).toContain(name);
    view.unmount();
  }
});
