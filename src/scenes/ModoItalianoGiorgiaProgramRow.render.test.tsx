import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_AUDIO_BUS_SNAPSHOT, type ProgramAudioBusSource } from './audioBus.js';
import { ModoItalianoGiorgiaProgramRow } from './ModoItalianoGiorgiaProgramRow.js';

// The row with the real Giorgia clock and chyron: what a scene listing both puts on screen.

const audioBus: ProgramAudioBusSource = { getSnapshot: () => EMPTY_AUDIO_BUS_SNAPSHOT, subscribe: () => () => {} };
const manual = (text: string) => ({ mode: 'manual', items: [{ id: 'a', text }], activeItemId: 'a' });
const song = { mode: 'manual', items: [{ id: 's', kind: 'preset', artist: 'Mina', title: 'Se telefonando' }], activeItemId: 's', intervalMs: 4000, loop: true, startedAt: 0 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T15:04:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('draws the header on its own and the headline beside the on-air block in the row', () => {
  const { container } = render(
    <ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} songSequence={song} chyronProps={{ textSequence: manual('Ultima ora') }} />,
  );
  const row = container.querySelector('[data-program-row="giorgia"]')!;
  expect(container.querySelector('.modoitaliano-giorgia-clock-header')!.closest('[data-program-row]')).toBeNull();
  expect(row.querySelector('[data-program-row-slot="chyron"] .modoitaliano-giorgia-chyron')!.textContent).toContain('ULTIMA ORA');
  expect(row.querySelector('[data-program-row-slot="clock"]')!.textContent).toContain('MINA');
});

it('leaves the chyron slot empty when the chyron is off, so the on-air block takes the left edge', () => {
  const { container } = render(
    <ModoItalianoGiorgiaProgramRow programId='p' audioBus={audioBus} chyronProps={{ show: false, textSequence: manual('Ultima ora') }} />,
  );
  expect(container.querySelector('[data-program-row-slot="chyron"]')).toBeEmptyDOMElement();
});
