import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// gaulatti/giorgia#74: the player's guards for an <audio> element that is not there. The element is always
// rendered, so a page cannot reach them; a render that has lost its refs can, and the player must then do
// nothing instead of throwing on air. React hands back refs that never hold an element to prove it.

const refs = vi.hoisted(() => ({ lost: false }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: (initial: unknown) => {
      const real = actual.useRef(initial);
      return refs.lost
        ? {
            get current() {
              return null;
            },
            set current(_value: unknown) {},
          }
        : real;
    },
  };
});

import { ModoItalianoGiorgiaPodcastPlayer } from './ModoItalianoGiorgiaPodcastPlayer.js';

beforeEach(() => {
  refs.lost = true;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  refs.lost = false;
  vi.restoreAllMocks();
});

it('does nothing, and does not throw, when there is no audio element to set the volume of or to load', () => {
  const { rerender } = render(<ModoItalianoGiorgiaPodcastPlayer audioUrl='/episode.mp3' masterGain={0.5} />);
  rerender(<ModoItalianoGiorgiaPodcastPlayer audioUrl='/other.mp3' masterGain={0.2} />);
  expect(screen.getByLabelText('Modo Italiano Giorgia podcast player')).toBeInTheDocument();
});

it('ignores a seek when there is no audio element to seek', () => {
  const { container } = render(<ModoItalianoGiorgiaPodcastPlayer audioUrl='/episode.mp3' />);
  const audio = container.querySelector('audio')!;
  Object.defineProperty(audio, 'duration', { configurable: true, value: 180 });
  fireEvent.durationChange(audio);
  const slider = screen.getByRole('slider');
  expect(() => fireEvent.change(slider, { target: { value: '60' } })).not.toThrow();
  expect(audio.currentTime).toBe(0);
});
