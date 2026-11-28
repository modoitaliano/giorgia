// @vitest-environment node
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LiveProgram from './LiveProgram.js';

// On the server there is no window: the program renders its markup with the local API default and fetches nothing
// until it is hydrated in the browser.
describe('LiveProgram on the server', () => {
  it('renders without a window and without an API base url', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(h(LiveProgram, {} as never));
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<div');
  });
});
