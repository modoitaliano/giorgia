// @vitest-environment happy-dom
// Ported from gaulatti/alcantara frontend/app/components/ModoItalianoGiorgiaPodcastPlayer.test.tsx.
// The Alcantara component-registry assertion has no counterpart here (the
// manifest is a separate ticket), and jest-dom matchers are plain DOM reads.
import { createElement as h } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import miLogoUrl from '../../../templates/assets/mi.svg';
import { ModoItalianoGiorgiaPodcastPlayer } from './ModoItalianoGiorgiaPodcastPlayer.js';
import { podcastPropsFromSong, readSongPlaybackActive } from './songSignals.js';

let frames: FrameRequestCallback[] = [];
const runFrames = () => {
  const pending = frames;
  frames = [];
  act(() => pending.forEach((frame) => frame(0)));
};
let ctx: { clearRect: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn>; fillStyle: string; globalAlpha: number } | null;
let reducedMotion = false;
const contexts: Array<{ close: ReturnType<typeof vi.fn> }> = [];

beforeEach(() => {
  frames = [];
  contexts.length = 0;
  reducedMotion = false;
  ctx = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '', globalAlpha: 1 };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) => frames.push(frame));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: reducedMotion }) as MediaQueryList);
  vi.stubGlobal('AudioContext', class {
    destination = {};
    close = vi.fn(() => Promise.resolve());
    constructor() { contexts.push(this); }
    createAnalyser() {
      return { connect: vi.fn(), fftSize: 256, smoothingTimeConstant: 0.85, getByteFrequencyData: (data: Uint8Array) => data.fill(200) };
    }
    createMediaElementSource() { return { connect: vi.fn() }; }
    resume() { return Promise.resolve(); }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const audioOf = (container: HTMLElement) => container.querySelector('audio')!;
const heading = () => screen.getByRole('heading') as HTMLElement;

describe('ModoItalianoGiorgiaPodcastPlayer', () => {
  it('renders full long copy, centered cover and exactly one ModoItaliano logo', () => {
    const title = 'Una lunghissima conversazione sulla musica italiana e le canzoni che ci accompagnano ogni giorno';
    render(h(ModoItalianoGiorgiaPodcastPlayer, { episodeTitle: title, showName: 'Harbor Light Radio', coverUrl: '/cover.jpg' }));
    expect(heading().textContent).toBe(title);
    expect(heading().style.whiteSpace).toBe('pre-wrap');
    expect(heading().style.overflowWrap).toBe('anywhere');
    expect(heading().style.fontSize).toBe('100px');
    expect((screen.getByRole('img', { name: 'Episode cover' }) as HTMLElement).style.objectPosition).toBe('center center');
    const logos = screen.getAllByRole('img', { name: 'ModoItaliano' }) as HTMLElement[];
    expect(logos).toHaveLength(1);
    expect(logos[0]!.getAttribute('src')).toBe(miLogoUrl);
    expect(logos[0]!.style).toMatchObject({ top: '69px', left: '96px', width: '222px' });
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.queryByText('No cover selected')).toBeNull();
  });

  it('renders the active song title, artist and cover from song_playback_active', () => {
    const song = readSongPlaybackActive({
      type: 'song_playback_active',
      title: 'Harbor Light',
      artist: 'The Lighthouse Keepers',
      coverUrl: '/assets/default-og.jpg',
    });
    render(h(ModoItalianoGiorgiaPodcastPlayer, podcastPropsFromSong(song)));
    expect(heading().textContent).toBe('Harbor Light');
    expect(heading().style.fontSize).toBe('164px');
    expect(screen.getByText('The Lighthouse Keepers')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Episode cover' }).getAttribute('src')).toBe('/assets/default-og.jpg');
  });

  it('sizes a mid-length title and says when no cover is selected', () => {
    render(h(ModoItalianoGiorgiaPodcastPlayer, { episodeTitle: 'x'.repeat(61) }));
    expect(heading().style.fontSize).toBe('124px');
    expect(screen.getByText('No cover selected')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Episode cover' })).toBeNull();
  });

  it('renders without an audio source when audioUrl is empty', () => {
    const { container } = render(h(ModoItalianoGiorgiaPodcastPlayer));
    const audio = audioOf(container);
    expect(audio.getAttribute('src')).toBeNull();
    fireEvent.canPlay(audio);
    expect(audio.play).not.toHaveBeenCalled();
    expect(contexts).toHaveLength(0);
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
  });

  it('passes audio, master gain, timing and seeking through to the player', async () => {
    const { container, rerender } = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3', masterGain: 0.4 }));
    const audio = audioOf(container);
    expect(audio.getAttribute('src')).toBe('/episode.mp3');
    expect(audio.volume).toBe(0.4);
    fireEvent.canPlay(audio);
    await waitFor(() => expect(audio.play).toHaveBeenCalled());
    Object.defineProperty(audio, 'duration', { configurable: true, value: 180 });
    fireEvent.durationChange(audio);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '60' } });
    expect(audio.currentTime).toBe(60);
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('1:00')).toBeTruthy();
    expect(screen.getByText('3:00')).toBeTruthy();
    rerender(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3', show: false, masterGain: 0 }));
    expect(audio.muted).toBe(true);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(audio.pause).toHaveBeenCalled();
  });

  it('does not autoplay while hidden and treats a non-finite gain or duration as zero', () => {
    const { container } = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3', show: false, masterGain: Number.NaN }));
    const audio = audioOf(container);
    expect(audio.volume).toBe(0);
    fireEvent.canPlay(audio);
    expect(audio.play).not.toHaveBeenCalled();
    Object.defineProperty(audio, 'duration', { configurable: true, value: Number.POSITIVE_INFINITY });
    fireEvent.durationChange(audio);
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: Number.POSITIVE_INFINITY });
    fireEvent.timeUpdate(audio);
    expect(screen.getAllByText('0:00')).toHaveLength(2);
    expect(frames).toHaveLength(0);
  });

  it('shows a focus outline on the scrubber', () => {
    const { container } = render(h(ModoItalianoGiorgiaPodcastPlayer));
    const slider = screen.getByRole('slider');
    const wrapper = slider.parentElement as HTMLElement;
    expect(wrapper.style.outline).not.toContain('solid');
    fireEvent.focus(slider);
    expect(wrapper.style.outline).toContain('solid');
    fireEvent.blur(slider);
    expect(wrapper.style.outline).not.toContain('solid');
    expect(container).toBeTruthy();
  });

  it('draws the spectrum while playing and a flat line when idle or with reduced motion', async () => {
    const { container, unmount } = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3' }));
    const audio = audioOf(container);
    // Idle: one flat line.
    expect(ctx!.fillRect).toHaveBeenCalledTimes(1);
    fireEvent.canPlay(audio);
    await waitFor(() => expect(audio.play).toHaveBeenCalled());
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    ctx!.fillRect.mockClear();
    runFrames();
    expect(ctx!.fillRect).toHaveBeenCalledTimes(80);

    reducedMotion = true;
    unmount();
    expect(contexts[0]!.close).toHaveBeenCalled();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    frames = [];

    const again = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3' }));
    const second = audioOf(again.container);
    fireEvent.canPlay(second);
    await waitFor(() => expect(contexts).toHaveLength(2));
    Object.defineProperty(second, 'paused', { configurable: true, value: false });
    ctx!.fillRect.mockClear();
    runFrames();
    expect(ctx!.fillRect).toHaveBeenCalledTimes(1);
  });

  it('reuses the audio graph on a second play', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('blocked'));
    const { container } = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3' }));
    fireEvent.canPlay(audioOf(container));
    const start = await screen.findByRole('button', { name: 'Start playback' });
    fireEvent.click(start);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Start playback' })).toBeNull());
    expect(contexts).toHaveLength(1);
    expect(audioOf(container).play).toHaveBeenCalledTimes(2);
  });

  it('skips drawing without a 2D context', () => {
    ctx = null;
    render(h(ModoItalianoGiorgiaPodcastPlayer));
    expect(frames).toHaveLength(0);
  });

  it('offers interaction when autoplay is blocked and reports media errors', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('blocked'));
    const { container } = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3' }));
    const audio = audioOf(container);
    fireEvent.canPlay(audio);
    expect(await screen.findByRole('button', { name: 'Start playback' })).toBeTruthy();
    fireEvent.error(audio);
    expect(screen.getByRole('alert').textContent).toBe('Unable to play this audio.');
  });

  it('reports a failure when play rejects with a media error', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('decode'));
    const { container } = render(h(ModoItalianoGiorgiaPodcastPlayer, { audioUrl: '/episode.mp3' }));
    const audio = audioOf(container);
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 4 } });
    fireEvent.canPlay(audio);
    expect((await screen.findByRole('alert')).textContent).toBe('Unable to play this audio.');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
