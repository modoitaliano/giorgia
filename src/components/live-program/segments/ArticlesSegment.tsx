import { useEffect, useRef, useState } from 'react';
import { ArticleSlide, type NewsItem } from '../components/slides/ArticleSlide.js';
import type { Segment } from './types.js';
import { t, type SupportedLanguage } from '../i18n.js';

interface ApiArticle {
  id: number;
  title: string;
  excerpt: string;
  slug: string;
  url?: string | null;
  canonicalUrl?: string | null;
  featured: boolean;
  featuredImage: {
    url: string;
  };
  categories: {
    name: string;
    slug?: string | null;
  }[];
  publishedAt: string;
}

interface ApiResponse {
  articles: ApiArticle[];
}

const MOCK_ARTICLES: NewsItem[] = [
  {
    id: '1',
    headline: 'La cumbre climática mundial alcanza un acuerdo histórico',
    summary:
      'Los líderes mundiales acordaron nuevas y ambiciosas metas para reducir las emisiones de carbono, un paso importante en la lucha contra el cambio climático.',
    imageUrl: 'https://picsum.photos/seed/news1/1920/1080',
    category: 'Medio ambiente',
    url: 'https://modoitaliano.fm/climate-summit-agreement'
  },
  {
    id: '2',
    headline: 'Anuncian un avance en la computación cuántica',
    summary: 'Investigadores alcanzaron un hito en la computación cuántica que podría transformar el procesamiento de datos y las tecnologías de cifrado.',
    imageUrl: 'https://picsum.photos/seed/news2/1920/1080',
    category: 'Tecnología',
    url: 'https://modoitaliano.fm/quantum-computing-breakthrough'
  },
  {
    id: '3',
    headline: 'Un nuevo hallazgo arqueológico reescribe la historia antigua',
    summary: 'Arqueólogos desenterraron objetos que cuestionan lo que sabemos sobre las civilizaciones antiguas y sus capacidades tecnológicas.',
    imageUrl: 'https://picsum.photos/seed/news3/1920/1080',
    category: 'Ciencia',
    url: 'https://modoitaliano.fm/archaeological-discovery'
  },
  {
    id: '4',
    headline: 'Extienden la misión de la Estación Espacial Internacional',
    summary: 'La NASA y sus socios internacionales anunciaron una extensión de las operaciones de la EEI para continuar la investigación científica en órbita.',
    imageUrl: 'https://picsum.photos/seed/news4/1920/1080',
    category: 'Espacio',
    url: 'https://modoitaliano.fm/iss-mission-extended'
  },
  {
    id: '5',
    headline: 'La energía renovable supera a los combustibles fósiles',
    summary: 'Por primera vez, las fuentes renovables generaron más electricidad que los combustibles fósiles tradicionales a nivel mundial.',
    imageUrl: 'https://picsum.photos/seed/news5/1920/1080',
    category: 'Energía',
    url: 'https://modoitaliano.fm/renewable-energy-milestone'
  }
];

function normalizePath(input: string): string {
  if (!input) return '/';
  const stripped = input.split('?')[0] || '/';
  const normalized = `/${stripped.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  return normalized !== '/' && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function asPathString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return normalizePath(trimmed);
}

function buildArticlePath(article: ApiArticle, language: SupportedLanguage): string {
  const explicitUrl = asPathString(article.url);
  const bareSlug = typeof article.slug === 'string' ? article.slug.trim() : '';
  const primaryCategorySlug = article.categories?.[0]?.slug?.trim();

  return (
    explicitUrl ||
    (primaryCategorySlug
      ? language === 'es'
        ? `/${primaryCategorySlug}/${bareSlug.replace(/^\//, '')}`
        : `/${language}/${primaryCategorySlug}/${bareSlug.replace(/^\//, '')}`
      : normalizePath(bareSlug || article.canonicalUrl || '/'))
  );
}

export async function fetchArticles(language: SupportedLanguage = 'es'): Promise<NewsItem[]> {
  try {
    const response = await fetch(`https://cdn.modoitaliano.fm/content/homepage-current-${language}.json?_=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch homepage feed: ${response.status} ${response.statusText}`);
    }

    const data: ApiResponse = await response.json();
    const now = new Date();
    const recentThreshold = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const feedArticles = Array.isArray(data.articles) ? data.articles : [];

    const articlesWithImages = feedArticles.filter((article) => article.featuredImage?.url);
    const sortByPublishedDesc = (a: ApiArticle, b: ApiArticle) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

    const featuredRecentArticles = articlesWithImages
      .filter((article) => article.featured === true && new Date(article.publishedAt) >= recentThreshold)
      .sort(sortByPublishedDesc);

    const everythingElseArticles = articlesWithImages
      .filter((article) => !(article.featured === true && new Date(article.publishedAt) >= recentThreshold))
      .sort(sortByPublishedDesc);

    const selectedArticles = [...featuredRecentArticles, ...everythingElseArticles].slice(0, 10);

    const items: NewsItem[] = selectedArticles.map((article) => ({
      id: article.id.toString(),
      headline: article.title,
      summary: article.excerpt,
      imageUrl: article.featuredImage.url,
      category: article.categories?.[0]?.name,
      url: `https://modoitaliano.fm${buildArticlePath(article, language)}`
    }));

    const finalItems = items.length > 0 ? items : MOCK_ARTICLES;
    finalItems.forEach((item) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = item.imageUrl;
    });

    return finalItems;
  } catch (error) {
    console.error('Error fetching news items:', error);
    return MOCK_ARTICLES;
  }
}

interface ArticlesSegmentRendererProps {
  items: NewsItem[];
  itemIndex: number;
  progress: number;
  language: SupportedLanguage;
}

function ArticlesSegmentRenderer({ items, itemIndex, progress, language }: ArticlesSegmentRendererProps) {
  const [displayedIndex, setDisplayedIndex] = useState(itemIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousIndexRef = useRef(itemIndex);

  useEffect(() => {
    if (itemIndex !== previousIndexRef.current && items.length > 0) {
      setIsTransitioning(true);
      const timer = window.setTimeout(() => {
        setDisplayedIndex(itemIndex);
        setIsTransitioning(false);
        previousIndexRef.current = itemIndex;
      }, 800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [itemIndex, items.length]);

  if (items.length === 0) {
    return <div className='text-white'>{t('articles.noArticles', language)}</div>;
  }

  const currentItem = items[itemIndex % items.length];
  const previousItem = items[displayedIndex % items.length];

  return (
    <div className='relative w-full h-full'>
      {isTransitioning && previousItem && (
        <div className='absolute inset-0'>
          <ArticleSlide newsItem={previousItem} progress={100} />
        </div>
      )}
      <div className={`absolute inset-0 ${isTransitioning ? 'animate-slide-transition' : ''}`}>
        <ArticleSlide newsItem={currentItem} progress={progress} />
      </div>
    </div>
  );
}

export function createArticlesSegment(articles: NewsItem[], onDataUpdate?: (nextArticles: NewsItem[]) => void, language: SupportedLanguage = 'es'): Segment {
  return {
    id: 'articles',
    label: t('segment.articles', language),
    get itemCount() {
      return articles.length > 0 ? articles.length : MOCK_ARTICLES.length;
    },
    durationMsPerItem: 10000,
    render: (itemIndex: number, progress: number) => {
      const items = articles.length > 0 ? articles : MOCK_ARTICLES;
      return <ArticlesSegmentRenderer key={`article-${itemIndex}`} items={items} itemIndex={itemIndex} progress={progress} language={language} />;
    },
    prefetch: async () => {
      if (!onDataUpdate) {
        return;
      }
      const freshArticles = await fetchArticles(language);
      onDataUpdate(freshArticles);
    }
  };
}

export type { NewsItem };
