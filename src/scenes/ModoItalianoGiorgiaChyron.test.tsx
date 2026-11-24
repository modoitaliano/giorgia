import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModoItalianoGiorgiaChyron } from './ModoItalianoGiorgiaChyron.js';

// gaulatti/alcantara#183: the Giorgia headline over an autoplay sequence.

const NOW = Date.parse('2026-11-17T15:00:00Z');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const headline = (container: HTMLElement) => container.querySelector('h2');

it('advances an autoplay headline sequence on air', () => {
  const textSequence = {
    mode: 'autoplay',
    intervalMs: 1000,
    startedAt: NOW,
    items: [
      { id: 'a', text: 'Primo titolo' },
      { id: 'b', text: 'Secondo titolo' },
    ],
  };
  const view = render(<ModoItalianoGiorgiaChyron textSequence={textSequence} />);
  expect(headline(view.container)?.textContent).toBe('PRIMO TITOLO');
  act(() => vi.advanceTimersByTime(1000));
  expect(headline(view.container)?.textContent).toBe('SECONDO TITOLO');
});

it('shows nothing without a headline sequence', () => {
  expect(render(<ModoItalianoGiorgiaChyron />).container.innerHTML).toBe('');
});

it('fills its container inline instead of sitting over the safe area', () => {
  const textSequence = { mode: 'manual', items: [{ id: 'a', text: 'Ciao' }], activeItemId: 'a' };
  const view = render(<ModoItalianoGiorgiaChyron inline textSequence={textSequence} />);
  const block = view.getByLabelText('Modo Italiano Giorgia chyron');
  expect(block.style.position).toBe('relative');
  expect(block.style.width).toBe('100%');
});

it('drops the call-to-action shadow for a chroma-key scene', () => {
  const manual = (text: string) => ({ mode: 'manual', items: [{ id: 'a', text }], activeItemId: 'a' });
  const view = render(<ModoItalianoGiorgiaChyron keySafe textSequence={manual('Ciao')} ctaSequence={manual('In diretta')} />);
  expect(view.getByText('In diretta').style.textShadow).toBe('none');
});

// gaulatti/giorgia#74: the marquee, the wrapped headline and the hidden and empty cases.

const manual = (text: string, extra: Record<string, unknown> = {}) => ({
  mode: 'manual',
  items: [{ id: 'a', text, ...extra }],
  activeItemId: 'a',
});

it('scrolls a marquee headline as two identical halves', () => {
  const view = render(<ModoItalianoGiorgiaChyron textSequence={manual('Ultima ora', { useMarquee: true })} />);
  expect(headline(view.container)).toBeNull();
  const marquee = view.container.querySelector('.modoitaliano-giorgia-chyron-marquee')!;
  expect(marquee.textContent).toBe('ULTIMA ORAULTIMA ORA');
  expect(marquee.children[1].getAttribute('aria-hidden')).toBe('true');
});

it('wraps a headline too long for one line at the smallest size instead of cutting it', () => {
  const long = 'Il governo approva la riforma della giustizia dopo una lunga notte di trattative in parlamento';
  const view = render(<ModoItalianoGiorgiaChyron textSequence={manual(long)} />);
  const style = headline(view.container)!.style;
  expect(headline(view.container)!.textContent).toBe(long.toUpperCase());
  expect(style.overflowWrap).toBe('anywhere');
  expect(style.whiteSpace).not.toBe('nowrap');
});

it('keeps a short headline on one line', () => {
  const view = render(<ModoItalianoGiorgiaChyron textSequence={manual('Ciao')} />);
  expect(headline(view.container)!.style.whiteSpace).toBe('nowrap');
});

it('keeps its call-to-action shadow when it is not chroma-keyed', () => {
  const view = render(<ModoItalianoGiorgiaChyron textSequence={manual('Ciao')} ctaSequence={manual('In diretta')} />);
  expect(view.getByText('In diretta').style.textShadow).not.toBe('none');
  expect(headline(view.container)!.style.textShadow).not.toBe('none');
});

it('shows no call to action when the sequence has none', () => {
  const view = render(<ModoItalianoGiorgiaChyron textSequence={manual('Ciao')} />);
  expect(view.queryByText('In diretta')).toBeNull();
});

it('drops the headline shadow for a chroma-key scene', () => {
  const view = render(<ModoItalianoGiorgiaChyron keySafe textSequence={manual('Ciao')} />);
  expect(headline(view.container)!.style.textShadow).toBe('none');
});

it('shows nothing while hidden, or when the headline is empty', () => {
  expect(render(<ModoItalianoGiorgiaChyron show={false} textSequence={manual('Ciao')} />).container.innerHTML).toBe('');
  cleanup();
  expect(render(<ModoItalianoGiorgiaChyron textSequence={manual('   ')} />).container.innerHTML).toBe('');
});
