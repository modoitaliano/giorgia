import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LogoWidget } from '../../../../src/components/live-program/tv/LogoWidget.js';

const meta: Meta = {
  title: 'React/LiveProgram/TV/LogoWidget',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<LogoWidget {...args} />);
    return container;
  }
};

export default meta;

// A scene-supplied logo; Giorgia's own mark stands in for the scene's logoUrl.
export const SceneLogo: StoryObj = {
  args: {
    logoUrl: './assets/mi.svg',
    position: 'bottom-right'
  }
};

export const SceneLogoTopRight: StoryObj = {
  args: {
    logoUrl: './assets/mi.svg',
    position: 'top-right'
  }
};

// Without logoUrl the widget draws nothing: the ModoRadio bugs are retired from Giorgia (#48).
export const NoLogo: StoryObj = {
  args: {}
};
