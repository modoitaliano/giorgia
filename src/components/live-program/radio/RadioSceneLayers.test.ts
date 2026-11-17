// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EARONE,
  MODOITALIANO_GIORGIA_PODCAST_PLAYER,
  MODOITALIANO_PODCAST_PLAYER,
  RADIO_COMPONENT_TYPES,
  RadioSceneLayers,
  earoneLabelFromScene,
  isRadioComponentType,
  podcastPlayerPropsFromScene,
  sceneComponentTypes,
} from './RadioSceneLayers.js';

afterEach(() => cleanup());

describe('radio scene mapping', () => {
  it("uses Alcantara's componentType names", () => {
    expect(RADIO_COMPONENT_TYPES).toEqual(['modoitaliano-podcast-player', 'modoitaliano-giorgia-podcast-player', 'earone']);
    expect([MODOITALIANO_PODCAST_PLAYER, MODOITALIANO_GIORGIA_PODCAST_PLAYER, EARONE]).toEqual(RADIO_COMPONENT_TYPES);
    expect(isRadioComponentType('earone')).toBe(true);
    expect(isRadioComponentType('modoitaliano-content')).toBe(false);
  });

  it("reads a scene's comma-separated component list", () => {
    expect(sceneComponentTypes(null)).toEqual([]);
    expect(sceneComponentTypes({ layout: { componentType: 'earone,,modoitaliano-content' } })).toEqual(['earone', 'modoitaliano-content']);
  });

  it('reads podcast props from the scene metadata as Alcantara does', () => {
    expect(podcastPlayerPropsFromScene(undefined)).toEqual({ show: true, coverUrl: '', episodeTitle: '', showName: '', audioUrl: '' });
    expect(podcastPlayerPropsFromScene(['x'])).toEqual({ show: true, coverUrl: '', episodeTitle: '', showName: '', audioUrl: '' });
    expect(
      podcastPlayerPropsFromScene({ show: false, coverUrl: '/c.jpg', episodeTitle: 'E', showName: 'S', audioUrl: '/a.mp3', masterGain: 0.5 })
    ).toEqual({ show: false, coverUrl: '/c.jpg', episodeTitle: 'E', showName: 'S', audioUrl: '/a.mp3', masterGain: 0.5 });
    expect(podcastPlayerPropsFromScene({ show: 'no', episodeTitle: 4, masterGain: Number.NaN })).toEqual({
      show: true,
      coverUrl: '',
      episodeTitle: '',
      showName: '',
      audioUrl: '',
    });
    expect(podcastPlayerPropsFromScene({ masterGain: '0.5' })).not.toHaveProperty('masterGain');
  });

  it('reads the Earone label from the scene metadata', () => {
    expect(earoneLabelFromScene({ label: 'HARBOR CHART' })).toBe('HARBOR CHART');
    expect(earoneLabelFromScene({ label: '' })).toBe('EARONE');
    expect(earoneLabelFromScene(null)).toBe('EARONE');
  });

  it('draws nothing for component types that are not radio components', () => {
    const { container } = render(h(RadioSceneLayers, { componentTypes: ['modoitaliano-content', 'ticker'], metadata: {}, activeSong: null }));
    expect(container.innerHTML).toBe('');
  });
});
