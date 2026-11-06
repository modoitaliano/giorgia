import type { SupportedLanguage } from '../i18n.js';

export interface LiveEventUpdate {
  timestamp?: string;
  time?: string;
  text?: string;
  html?: string;
}

export interface LiveEventData {
  category: string;
  title: string;
  excerpt?: string;
  image: string;
  alt?: string;
  url: string;
  liveUrl?: string;
  updatedAt: string;
  updates: LiveEventUpdate[];
}

interface BreakingNewsMain {
  category?: string;
  title?: string;
  excerpt?: string;
  image?: string;
  alt?: string;
  url?: string;
  liveUrl?: string;
}

interface BreakingNewsBlock {
  main?: BreakingNewsMain;
  updates?: LiveEventUpdate[];
}

interface HomepageFeed {
  breakingNews?: BreakingNewsBlock;
  updatedAt?: string;
}

export async function fetchLiveEvent(language: SupportedLanguage = 'es'): Promise<LiveEventData | null> {
  try {
    const response = await fetch(
      `https://cdn.modoitaliano.fm/content/homepage-current-${language}.json?_=${Date.now()}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return null;
    }

    const data: HomepageFeed = await response.json();
    const main = data.breakingNews?.main;
    if (!main || !main.title) {
      return null;
    }

    return {
      category: main.category || 'EN VIVO',
      title: main.title,
      excerpt: main.excerpt,
      image: main.image || '',
      alt: main.alt || main.title,
      url: main.url || '/',
      liveUrl: main.liveUrl,
      updatedAt: data.updatedAt || new Date().toISOString(),
      updates: data.breakingNews?.updates || [],
    };
  } catch (error) {
    console.error('Error fetching live event:', error);
    return null;
  }
}
