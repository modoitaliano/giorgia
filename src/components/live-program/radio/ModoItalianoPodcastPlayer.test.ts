// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModoItalianoPodcastPlayer } from './ModoItalianoPodcastPlayer.js';
import { podcastPropsFromSong, readSongPlaybackActive } from './songSignals.js';

let frames: FrameRequestCallback[] = [];
const runFrames = (ts = 1000) => {
  const pending = frames;
  frames = [];
  act(() => pending.forEach((frame) => frame(ts)));
};

const fakeContext = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  globalCompositeOperation: '',
});
let ctx: ReturnType<typeof fakeContext> | null;

const audioContexts: Array<{ state: string; resume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> = [];
let audioContextState = 'suspended';
let audioContextThrows = false;

beforeEach(() => {
  frames = [];
  audioContexts.length = 0;
  audioContextState = 'suspended';
  audioContextThrows = false;
  ctx = fakeContext();
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.stubGlobal(
    'AudioContext',
    class {
      state = audioContextState;
      destination = {};
      resume = vi.fn(() => Promise.resolve());
      close = vi.fn(() => Promise.resolve());
      constructor() {
        if (audioContextThrows) throw new Error('restricted');
        audioContexts.push(this);
      }
      createAnalyser() {
        return {
          fftSize: 0,
          smoothingTimeConstant: 0,
          frequencyBinCount: 10,
          connect: vi.fn(),
          getByteFrequencyData: (data: Uint8Array) => data.set([0, 255, 128, 0, 64, 0, 0, 0, 0, 0]),
        };
      }
      createMediaElementSource() {
        return { connect: vi.fn() };
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const audioOf = (container: HTMLElement) => container.querySelector('audio')!;
const flush = () => act(async () => { await Promise.resolve(); });

describe('ModoItalianoPodcastPlayer', () => {
  it('renders nothing when hidden', () => {
    const { container, unmount } = render(h(ModoItalianoPodcastPlayer, { show: false, audioUrl: '/harbor-light.mp3' }));
    expect(container.innerHTML).toBe('');
    expect(frames).toHaveLength(0);
    unmount();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it('renders the active song title, artist and cover from song_playback_active', () => {
    const song = readSongPlaybackActive({
      type: 'song_playback_active',
      title: 'Harbor Light',
      artist: 'The Lighthouse Keepers',
      coverUrl: '/assets/default-og.jpg',
    });
    render(h(ModoItalianoPodcastPlayer, podcastPropsFromSong(song)));
    expect(screen.getByText('Harbor Light')).toBeTruthy();
    expect(screen.getByText('The Lighthouse Keepers')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Episode cover' }).getAttribute('src')).toBe('/assets/default-og.jpg');
  });

  it('shows placeholders and a cover glyph without props, and renders without an audio source', () => {
    const { container } = render(h(ModoItalianoPodcastPlayer));
    expect(screen.getByText('Episode Title')).toBeTruthy();
    expect(screen.getByText('Show Name')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
    const audio = audioOf(container);
    expect(audio.getAttribute('src')).toBeNull();
    expect(audio.load).not.toHaveBeenCalled();
    fireEvent.canPlay(audio);
    expect(audio.play).not.toHaveBeenCalled();
    expect(audioContexts).toHaveLength(0);
    expect(screen.getAllByText('0:00')).toHaveLength(2);
  });

  it('applies master gain to the audio element and mutes it at zero', () => {
    const { container, rerender } = render(h(ModoItalianoPodcastPlayer, { masterGain: 2 }));
    const audio = audioOf(container);
    expect(audio.volume).toBe(1);
    expect(audio.muted).toBe(false);
    rerender(h(ModoItalianoPodcastPlayer, { masterGain: 0 }));
    expect(audio.volume).toBe(0);
    expect(audio.muted).toBe(true);
  });

  it('animates the background and an idle waveform until audio plays', () => {
    const { unmount } = render(h(ModoItalianoPodcastPlayer));
    expect(frames).toHaveLength(2);
    runFrames();
    expect(ctx!.createRadialGradient).toHaveBeenCalledTimes(5);
    expect(ctx!.moveTo).toHaveBeenCalled();
    expect(ctx!.lineTo).toHaveBeenCalled();
    expect(ctx!.stroke).toHaveBeenCalledTimes(2);
    expect(frames).toHaveLength(2);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('stops drawing when a canvas has no 2D context', () => {
    ctx = null;
    render(h(ModoItalianoPodcastPlayer));
    runFrames();
    expect(frames).toHaveLength(0);
  });

  it('loads the audio prop, autoplays through the analyser and draws the spectrum', async () => {
    const { container, rerender, unmount } = render(h(ModoItalianoPodcastPlayer, { audioUrl: '/harbor-light.mp3' }));
    const audio = audioOf(container);
    expect(audio.getAttribute('src')).toBe('/harbor-light.mp3');
    expect(audio.load).toHaveBeenCalledTimes(1);

    fireEvent.canPlay(audio);
    await flush();
    expect(audioContexts).toHaveLength(1);
    expect(audioContexts[0]!.resume).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalledTimes(1);

    fireEvent.play(audio);
    ctx!.fillRect.mockClear();
    runFrames();
    // Background tint and vignette, then two mirrored bars for each audible bin and the centre line.
    expect(ctx!.fillRect.mock.calls.length).toBeGreaterThan(6 + 2);

    Object.defineProperty(audio, 'duration', { configurable: true, value: 125 });
    fireEvent.durationChange(audio);
    audio.currentTime = 65;
    fireEvent.timeUpdate(audio);
    expect(screen.getByText('1:05')).toBeTruthy();
    expect(screen.getByText('2:05')).toBeTruthy();

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100 } as DOMRect);
    const scrubber = container.querySelector('[style*="cursor: pointer"]')!;
    fireEvent.click(scrubber, { clientX: 20 });
    expect(audio.currentTime).toBe(25);

    fireEvent.pause(audio);
    fireEvent.play(audio);
    fireEvent.ended(audio);

    // A new source reuses the existing analyser; a running context is not resumed again.
    audioContexts[0]!.state = 'running';
    rerender(h(ModoItalianoPodcastPlayer, { audioUrl: '/harbor-light-2.mp3' }));
    expect(audio.getAttribute('src')).toBe('/harbor-light-2.mp3');
    fireEvent.canPlay(audio);
    await flush();
    expect(audioContexts).toHaveLength(1);
    expect(audioContexts[0]!.resume).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(2);

    unmount();
    expect(audioContexts[0]!.close).toHaveBeenCalled();
  });

  it('treats an unknown duration as zero and ignores scrubbing without one', () => {
    const { container } = render(h(ModoItalianoPodcastPlayer, { audioUrl: '/harbor-light.mp3' }));
    const audio = audioOf(container);
    Object.defineProperty(audio, 'duration', { configurable: true, value: undefined });
    fireEvent.durationChange(audio);
    audio.currentTime = 4;
    fireEvent.click(container.querySelector('[style*="cursor: pointer"]')!, { clientX: 20 });
    expect(audio.currentTime).toBe(4);
  });

  it('asks for interaction when autoplay is blocked', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('blocked'));
    const { container } = render(h(ModoItalianoPodcastPlayer, { audioUrl: '/harbor-light.mp3' }));
    fireEvent.canPlay(audioOf(container));
    await flush();
    expect(screen.getByText('Waiting for interaction to start playback')).toBeTruthy();
  });

  it('still plays when the audio graph cannot be created', async () => {
    audioContextThrows = true;
    const { container } = render(h(ModoItalianoPodcastPlayer, { audioUrl: '/harbor-light.mp3' }));
    const audio = audioOf(container);
    fireEvent.canPlay(audio);
    await flush();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audioContexts).toHaveLength(0);
  });
});
