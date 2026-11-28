import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ProgramAudioBusSource } from './audioBus.js';

// The row Alcántara draws when a scene lists both the Giorgia clock and chyron (moved from
// gaulatti/alcantara frontend/app/components/ModoItalianoProgramRow.tsx). The two renderers are
// stand-ins here so the test reads exactly the props the row hands them.

const calls = vi.hoisted(() => ({ clock: [] as Record<string, unknown>[], chyron: [] as Record<string, unknown>[] }));
vi.mock('./ModoItalianoGiorgiaClock.js', () => ({
  ModoItalianoGiorgiaClock: (props: Record<string, unknown>) => {
    calls.clock.push(props);
    return <div data-stand-in={`clock-${String(props.part)}`} />;
  },
}));
vi.mock('./ModoItalianoGiorgiaChyron.js', () => ({
  ModoItalianoGiorgiaChyron: (props: Record<string, unknown>) => {
    calls.chyron.push(props);
    return props.show ? <div data-stand-in='chyron' /> : null;
  },
}));

import { ModoItalianoGiorgiaProgramRow } from './ModoItalianoGiorgiaProgramRow.js';
import { GIORGIA } from './giorgiaBroadcast.js';

const audioBus: ProgramAudioBusSource = { getSnapshot: vi.fn(), subscribe: vi.fn() };

beforeEach(() => {
  calls.clock.length = 0;
  calls.chyron.length = 0;
});
afterEach(cleanup);

const last = <T,>(list: T[]) => list[list.length - 1];
const header = () => last(calls.clock.filter((props) => props.part === 'header'));
const onAir = () => last(calls.clock.filter((props) => props.part === 'onAir'));
const chyron = () => last(calls.chyron);

it('hands both clock parts Alcántara’s settings, with every scene setting at its default', () => {
  render(<ModoItalianoGiorgiaProgramRow programId='modoitaliano.fm' audioBus={audioBus} />);
  const common = {
    programId: 'modoitaliano.fm',
    audioBus,
    timeOverride: null,
    transitionDurationMs: 300,
    shuffleCities: false,
    widthPx: 220,
    showWorldClocks: true,
    showLogo: true,
    showPlaybackProgress: true,
    showBellIcon: false,
    songSequence: undefined,
    language: 'es',
    keySafe: false,
  };
  expect(header()).toEqual({ ...common, part: 'header' });
  expect(onAir()).toEqual({ ...common, part: 'onAir', inline: true });
  expect(chyron()).toEqual({ show: true, textSequence: undefined, ctaSequence: undefined, inline: true, keySafe: false });
});

it('passes the program’s time override and song sequence, and the chyron’s sequences, through unchanged', () => {
  const timeOverride = { startTime: '21:30', startedAt: '2026-11-17T15:02:00Z' };
  const songSequence = { mode: 'manual', items: [] };
  const textSequence = { mode: 'manual', items: [{ id: 'a', text: 'Ciao' }], activeItemId: 'a' };
  const ctaSequence = { mode: 'manual', items: [{ id: 'b', text: 'In diretta' }], activeItemId: 'b' };
  render(
    <ModoItalianoGiorgiaProgramRow
      programId='p'
      audioBus={audioBus}
      timeOverride={timeOverride}
      songSequence={songSequence}
      chyronProps={{ textSequence, ctaSequence }}
    />,
  );
  expect(header().timeOverride).toBe(timeOverride);
  expect(onAir().songSequence).toBe(songSequence);
  expect(chyron().textSequence).toBe(textSequence);
  expect(chyron().ctaSequence).toBe(ctaSequence);
});

it('places the row between the safe edges at the bottom, the chyron slot first and the on-air block after it', () => {
  const { container } = render(<ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} />);
  // The header renders on its own, outside the row.
  expect((container.firstElementChild as HTMLElement).dataset.standIn).toBe('clock-header');
  const row = container.querySelector<HTMLElement>('[data-program-row="giorgia"]')!;
  expect(row.className).toBe('absolute z-[950] flex items-end gap-12');
  expect(row.style.left).toBe(`${GIORGIA.safeX}px`);
  expect(row.style.right).toBe(`${GIORGIA.safeX}px`);
  expect(row.style.bottom).toBe(`${GIORGIA.safeBottom}px`);
  const slots = [...row.children] as HTMLElement[];
  expect(slots.map((slot) => slot.dataset.programRowSlot)).toEqual(['chyron', 'clock']);
  expect(slots[0].className).toBe('flex-1 min-w-[50%] empty:hidden');
  expect(slots[0].querySelector('[data-stand-in="chyron"]')).not.toBeNull();
  expect(slots[1].className).toBe('min-w-0');
  expect(slots[1].querySelector('[data-stand-in="clock-onAir"]')).not.toBeNull();
});

it('empties the chyron slot while the chyron is hidden', () => {
  const { container } = render(<ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} chyronProps={{ show: 'off' }} />);
  expect(chyron().show).toBe(false);
  expect(container.querySelector('[data-program-row-slot="chyron"]')!.childElementCount).toBe(0);
});

it('reads the clock’s switches as Alcántara stores them', () => {
  const { rerender } = render(
    <ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} clockProps={{ showWorldClocks: false, showLogo: 0, showPlaybackProgress: ' NO ' }} />,
  );
  expect([header().showWorldClocks, header().showLogo, header().showPlaybackProgress]).toEqual([false, false, false]);
  rerender(<ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} clockProps={{ showWorldClocks: 'yes', showLogo: 2, showPlaybackProgress: 'On' }} />);
  expect([onAir().showWorldClocks, onAir().showLogo, onAir().showPlaybackProgress]).toEqual([true, true, true]);
});

it('keeps a default for a setting it cannot read', () => {
  render(
    <ModoItalianoGiorgiaProgramRow
      programId='p'
      audioBus={audioBus}
      clockProps={{ showWorldClocks: 'maybe', showLogo: null, keySafe: {} }}
      chyronProps={{ show: [], keySafe: 'sometimes' }}
    />,
  );
  expect(header().showWorldClocks).toBe(true);
  expect(header().showLogo).toBe(true);
  expect(header().keySafe).toBe(false);
  expect(chyron().show).toBe(true);
  expect(chyron().keySafe).toBe(false);
});

it('keys the whole row when either the clock or the chyron is key-safe', () => {
  const { rerender } = render(<ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} clockProps={{ keySafe: 'true' }} />);
  expect([header().keySafe, onAir().keySafe, chyron().keySafe]).toEqual([true, true, true]);
  rerender(<ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} chyronProps={{ keySafe: 1 }} />);
  expect([header().keySafe, onAir().keySafe, chyron().keySafe]).toEqual([true, true, true]);
  rerender(<ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} clockProps={{ keySafe: '0' }} chyronProps={{ keySafe: false }} />);
  expect([header().keySafe, onAir().keySafe, chyron().keySafe]).toEqual([false, false, false]);
});
