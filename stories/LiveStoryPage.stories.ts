import type { Meta, StoryObj } from '@storybook/html';
import { render } from '../src/renderer.browser';
import { loadLiveStoryPreviewData } from './preview-data';

const meta = {
  title: 'Pages/LiveStoryPage',
  render: (_args, { loaded }) => render(loaded.liveStory)
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Current: Story = {
  loaders: [async () => ({ liveStory: await loadLiveStoryPreviewData() })]
};
