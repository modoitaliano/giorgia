import { describe, expect, it, vi } from 'vitest';
import { buildInstagramImageHtml } from './instagram-image-template.js';

describe('buildInstagramImageHtml', () => {
  it('renders title, category, image and qr code when url is provided', () => {
    const html = buildInstagramImageHtml({
      imageUrl: 'https://cdn.modoitaliano.fm/image.jpg',
      title: 'Breaking Story',
      category: 'World',
      url: 'https://modoitaliano.fm/world/breaking-story'
    });

    expect(html).toContain('Breaking Story');
    expect(html).toContain('WORLD');
    expect(html).toContain('https://cdn.modoitaliano.fm/image.jpg');
    expect(html).toContain('aria-label="QR Code"');
    expect(html).toContain('<svg');
  });

  it('falls back to slug and escapes html content', () => {
    const html = buildInstagramImageHtml({
      imageUrl: 'https://cdn.modoitaliano.fm/<img>.jpg',
      title: 'A <script>alert("x")</script>',
      slug: 'latest-news'
    });

    expect(html).toContain('LATEST NEWS');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('https://cdn.modoitaliano.fm/&lt;img&gt;.jpg');
    expect(html).not.toContain('<script>alert("x")</script>');
  });
});

describe('buildInstagramImageHtml defaults and runtimes', () => {
  it('uses the generic category and omits the qr code without category, slug or url', () => {
    const html = buildInstagramImageHtml({ imageUrl: 'https://cdn.modoitaliano.fm/i.jpg', title: 'T' });
    expect(html).toContain('LATEST STORY');
    expect(html).not.toContain('aria-label="QR Code"');
  });

  it('registers the qr helper that renders a code for a url', async () => {
    const { default: Handlebars } = await import('handlebars');
    const out = Handlebars.compile('{{{instagramQrCode "https://modoitaliano.fm/x"}}}')({});
    expect(out).toContain('aria-label="QR Code"');
  });

  it('loads the template through the bundler raw import outside node', async () => {
    vi.resetModules();
    const original = process.versions;
    Object.defineProperty(process, 'versions', { value: {}, configurable: true });
    try {
      const mod = await import('./instagram-image-template.js');
      const html = mod.buildInstagramImageHtml({ imageUrl: 'https://cdn.modoitaliano.fm/i.jpg', title: 'Browser Title' });
      expect(html).toContain('Browser Title');
    } finally {
      Object.defineProperty(process, 'versions', { value: original, configurable: true });
    }
  });
});
