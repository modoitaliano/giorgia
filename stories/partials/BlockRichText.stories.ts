import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import richTextHbs from '../../src/templates/partials/blocks/rich-text.hbs?raw';
import { articleFixture } from '../fixtures/article.fixture';

const template = Handlebars.compile(richTextHbs);

const meta = {
  title: 'Partials/Blocks/RichText',
  render: (args) => `
    <style>
      [data-highlighter-story] mark.spritz-highlight {
        background-size: 0% 0.72em;
      }

      [data-highlighter-story] mark.spritz-highlight.is-highlighted {
        background-size: 100% 0.72em;
        transition: background-size 850ms cubic-bezier(0.22, 1, 0.36, 1);
      }
    </style>
    <div data-highlighter-story>${template(args)}</div>
  `,
  args: articleFixture.body.find((block) => block.type === 'richText') ?? { html: '<p>Sample rich text.</p>' },
  play: async ({ canvasElement }) => {
    const marks = Array.from(canvasElement.querySelectorAll<HTMLElement>('mark.spritz-highlight'));
    const view = canvasElement.ownerDocument.defaultView;

    marks.forEach((mark) => {
      mark.classList.remove('is-highlighted');
      mark.dataset.highlightDirection = view?.getComputedStyle(mark).direction === 'rtl' ? 'rtl' : 'ltr';
    });

    await new Promise((resolve) => window.setTimeout(resolve, 400));
    marks.forEach((mark) => mark.classList.add('is-highlighted'));
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Highlighter: Story = {
  args: {
    html: '<p>The editor can call attention to <mark class="spritz-highlight">the sentence readers should notice first</mark> without changing the paragraph structure.</p>'
  }
};

export const RightToLeftHighlighter: Story = {
  args: {
    html: '<p dir="rtl">يمكن للمحرر لفت الانتباه إلى <mark class="spritz-highlight" data-highlight-direction="rtl">الكلمات التي ينبغي للقارئ ملاحظتها أولا</mark> من دون تغيير بنية الفقرة.</p>'
  }
};
