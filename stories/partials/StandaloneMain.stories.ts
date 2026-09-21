import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import standaloneMainHbs from '../../src/templates/partials/components/standalone-main.hbs?raw';
import { articleFixture } from '../fixtures/article.fixture';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();
const template = Handlebars.compile(standaloneMainHbs);

const meta = {
  title: 'Partials/Standalone/Main',
  render: (args) => template(args),
  args: {
    ...articleFixture,
    title: 'About ModoItaliano',
    dek: 'An evergreen page rendered from an explicit block contract.',
    body: articleFixture.body.slice(0, 3)
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
