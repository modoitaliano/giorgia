import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModoItalianoBracket } from '../../../src/live-program/components/tv/ModoItalianoBracketComponent.js';
import {
  HARBOR_LIGHT_SONGS,
  HARBOR_LIGHT_BRACKET_MATCHES,
  HARBOR_LIGHT_AUDIENCE_DRAW_START,
  HARBOR_LIGHT_LEGACY_DRAW_START
} from './harbor-light.fixture.js';

const meta: Meta = {
  title: 'TV/ModoItalianoBracket',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0d1117';
    createRoot(container).render(<ModoItalianoBracket {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    title: 'HARBOR LIGHT TORNEO',
    show: true,
    startRound: 'roundOf16',
    matches: HARBOR_LIGHT_BRACKET_MATCHES,
    songs: HARBOR_LIGHT_SONGS
  }
};

export const AudienceInteractionDraw: StoryObj = {
  args: {
    title: 'HARBOR LIGHT TORNEO',
    show: true,
    startRound: 'roundOf16',
    matches: HARBOR_LIGHT_BRACKET_MATCHES,
    songs: HARBOR_LIGHT_SONGS,
    event: HARBOR_LIGHT_AUDIENCE_DRAW_START
  }
};

export const LegacyBracketDraw: StoryObj = {
  args: {
    title: 'HARBOR LIGHT TORNEO',
    show: true,
    startRound: 'roundOf16',
    matches: HARBOR_LIGHT_BRACKET_MATCHES,
    songs: HARBOR_LIGHT_SONGS,
    drawCommand: HARBOR_LIGHT_LEGACY_DRAW_START
  }
};
