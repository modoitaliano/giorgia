// Maps an Alcantara scene onto the radio components. The componentType names
// and the per-component metadata fields are Alcantara's own (its program
// page's scene renderer and ModoItalianoPodcastPlayerEditorFields), so a scene
// built in Alcantara's editor draws the same component here.
import React from 'react';
import { Earone } from './Earone.js';
import { ModoItalianoGiorgiaPodcastPlayer } from './ModoItalianoGiorgiaPodcastPlayer.js';
import { ModoItalianoPodcastPlayer, type ModoItalianoPodcastPlayerProps } from './ModoItalianoPodcastPlayer.js';
import { earonePropsFromSong, type ActiveSong } from './songSignals.js';

export const MODOITALIANO_PODCAST_PLAYER = 'modoitaliano-podcast-player';
export const MODOITALIANO_GIORGIA_PODCAST_PLAYER = 'modoitaliano-giorgia-podcast-player';
export const EARONE = 'earone';

export const RADIO_COMPONENT_TYPES: readonly string[] = [MODOITALIANO_PODCAST_PLAYER, MODOITALIANO_GIORGIA_PODCAST_PLAYER, EARONE];

export function isRadioComponentType(componentType: string): boolean {
  return RADIO_COMPONENT_TYPES.includes(componentType);
}

/** The component types of a scene, read as Alcantara reads them: its layout's comma-separated list. */
export function sceneComponentTypes(scene: { layout: { componentType: string } } | null): string[] {
  return scene ? scene.layout.componentType.split(',').filter(Boolean) : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Podcast player props from the scene's metadata for that component, with
 * Alcantara's own reading of each field. `masterGain` is not an editor field:
 * Alcantara passes its output gain, which is full gain outside fade-to-black and
 * confidence mode. A finite `masterGain` in the metadata is honoured; otherwise
 * the player's own default (full gain) applies.
 */
export function podcastPlayerPropsFromScene(value: unknown): ModoItalianoPodcastPlayerProps {
  const props = record(value);
  const scene: ModoItalianoPodcastPlayerProps = {
    show: typeof props.show === 'boolean' ? props.show : true,
    coverUrl: text(props.coverUrl),
    episodeTitle: text(props.episodeTitle),
    showName: text(props.showName),
    audioUrl: text(props.audioUrl),
  };
  if (typeof props.masterGain === 'number' && Number.isFinite(props.masterGain)) {
    scene.masterGain = props.masterGain;
  }
  return scene;
}

/** The Earone label from the scene's metadata, or the component's default, as in Alcantara. */
export function earoneLabelFromScene(value: unknown): string {
  return text(record(value).label) || 'EARONE';
}

export interface RadioSceneLayersProps {
  componentTypes: string[];
  metadata: Record<string, unknown>;
  activeSong: ActiveSong | null;
}

/** Draws the radio components the scene asks for, in the scene's order; other types draw nothing here. */
export function RadioSceneLayers({ componentTypes, metadata, activeSong }: RadioSceneLayersProps) {
  return (
    <>
      {componentTypes.map((componentType) => {
        if (componentType === EARONE) {
          return <Earone key={componentType} label={earoneLabelFromScene(metadata[componentType])} {...earonePropsFromSong(activeSong)} />;
        }
        if (componentType === MODOITALIANO_PODCAST_PLAYER) {
          return <ModoItalianoPodcastPlayer key={componentType} {...podcastPlayerPropsFromScene(metadata[componentType])} />;
        }
        if (componentType === MODOITALIANO_GIORGIA_PODCAST_PLAYER) {
          return <ModoItalianoGiorgiaPodcastPlayer key={componentType} {...podcastPlayerPropsFromScene(metadata[componentType])} />;
        }
        return null;
      })}
    </>
  );
}
