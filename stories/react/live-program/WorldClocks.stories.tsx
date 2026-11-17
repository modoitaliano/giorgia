import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorldClocks } from '../../../src/components/live-program/components/WorldClocks.js';

/**
 * The live program's corner clocks. LiveProgram passes them the program-wide
 * broadcast time override from Alcantara's broadcast settings (#49).
 */
const meta: Meta = {
  title: 'React/LiveProgram/WorldClocks',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.padding = '64px';
    container.style.background = '#000';
    createRoot(container).render(<WorldClocks {...args} />);
    return container;
  }
};

export default meta;

export const RealTime: StoryObj = {
  args: { language: 'es', shuffleCities: false }
};

/** A program-wide broadcast time override: every city shows 07:30 and counts on from it. */
export const TimeOverride: StoryObj = {
  args: {
    language: 'es',
    shuffleCities: false,
    timeOverride: { startTime: '07:30', startedAt: new Date().toISOString() }
  }
};
