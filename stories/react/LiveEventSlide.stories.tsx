import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LiveEventSlide } from '../../src/components/live-program/components/slides/LiveEventSlide';
import type { LiveEventData } from '../../src/components/live-program/segments/fetchLiveEvents';

const breakingEvent: LiveEventData = {
  category: 'U.S.',
  title: 'Major Winter Storm Moves Across the Northeast',
  excerpt: 'Millions under winter storm warnings as heavy snow and high winds impact travel and power grids.',
  image: 'https://picsum.photos/seed/winter-storm/1920/1080',
  alt: 'Snow-covered city streets',
  url: 'https://modoitaliano.fm/us/winter-storm-northeast',
  updatedAt: new Date().toISOString(),
  updates: [
    { timestamp: new Date(Date.now() - 60000).toISOString(), text: 'Governor declares state of emergency in New York, New Jersey, Connecticut.' },
    { timestamp: new Date(Date.now() - 300000).toISOString(), text: 'Over 200,000 without power across the tri-state area.' },
    { timestamp: new Date(Date.now() - 600000).toISOString(), text: 'JFK and Newark airports suspend all flights until further notice.' },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), text: 'National Guard deployed to assist with emergency response.' },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), text: 'Snowfall rates of 2-3 inches per hour reported in parts of Massachusetts.' },
  ],
};

const meta: Meta = {
  title: 'React/LiveEventSlide',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.overflow = 'hidden';

    const root = createRoot(container);
    root.render(<LiveEventSlide event={breakingEvent} progress={args.progress ?? 45} language='en' />);

    return container;
  },
};

export default meta;

export const BreakingNews: StoryObj = {
  args: { progress: 30 },
};
