import Handlebars from 'handlebars';
import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import { canonicalArticleSchema } from './types/canonical-article.js';

function fixture(layout: 'homepage' | 'live-story', providerId?: number) {
  return canonicalArticleSchema.parse({
    id: 'context-fixture', slug: '/fixture', canonicalUrl: 'https://example.test/fixture',
    contentVersion: '2026-11-03T12:00:00Z', publishedAt: '2026-11-03T12:00:00Z', updatedAt: '2026-11-03T12:00:00Z',
    status: 'published', title: 'Context fixture', language: 'en', featured: false, layout,
    authors: [{ name: 'Fixture desk', slug: 'fixture-desk' }], categories: [{ name: 'Sports', slug: 'sports' }],
    navigation: { categories: [] }, body: [], articles: [], sofascore_id: providerId,
    showHero: false, showEditorialHero: false, showBreakingNews: true,
    showLanding: false, showMustRead: false, showMoreStories: false,
    breakingNews: {
      main: { category: 'Sports fixture', image: 'https://example.test/fixture.jpg', title: 'Context fixture', url: '/fixture', sofascore_id: providerId },
      updates: []
    }
  });
}

describe('SofaScore template context through the public Node renderer', () => {
  it.each(['homepage', 'live-story'] as const)('retains the provider ID through nested helper blocks in %s', layout => {
    const html = render(fixture(layout, 15388428));
    expect(html).toContain(Handlebars.escapeExpression('https://widgets.sofascore.com/embed/attackMomentum?id=15388428&widgetTheme=light'));
    expect(html).toContain('href=\'https://www.sofascore.com/football/match#id:15388428\'');
  });

  it.each(['homepage', 'live-story'] as const)('still rejects a missing provider ID in %s', layout => {
    expect(() => render(fixture(layout))).toThrow('Embed provider "sofascore-widget" requires parameter id');
  });
});
