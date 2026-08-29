import Swup from 'swup';
import SwupA11yPlugin from '@swup/a11y-plugin';
import SwupHeadPlugin from '@swup/head-plugin';
import SwupScriptsPlugin from '@swup/scripts-plugin';

declare global {
  interface Window {
    __brokawHydrateRelativeTimes?: (root?: ParentNode) => void;
    __brokawInitAnimatedHighlights?: () => void;
    __brokawInitCarousels?: (root?: ParentNode) => void;
    __brokawPageCleanup?: () => void;
    __brokawSyncSofascoreTheme?: () => void;
    gtag?: (...args: unknown[]) => void;
  }
}

function localeForPath(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment === 'en' || segment === 'it' ? segment : 'es';
}

function shouldIgnoreVisit(url: string, { el }: { el?: Element } = {}): boolean {
  if (el?.closest('[data-no-swup]')) return true;

  const target = new URL(url, window.location.href);
  const currentLocale = document.documentElement.lang || localeForPath(window.location.pathname);
  return localeForPath(target.pathname) !== currentLocale;
}

function shouldSkipPopStateHandling(event: PopStateEvent): boolean {
  const state = event.state as { source?: string; pageLayout?: string } | null;
  if (state?.source === 'swup') return false;

  if (state?.source === 'brokaw-page' && state.pageLayout) {
    const currentLayout = document.querySelector<HTMLElement>('#page-content')?.dataset.pageLayout;
    return currentLayout === state.pageLayout;
  }

  return true;
}

function hydratePage(): void {
  const page = document.querySelector<HTMLElement>('#page-content');
  if (!page) return;

  window.__brokawHydrateRelativeTimes?.(page);
  window.__brokawInitCarousels?.(page);
  window.__brokawInitAnimatedHighlights?.();
  window.__brokawSyncSofascoreTheme?.();
}

function trackPageView(): void {
  const page = document.querySelector<HTMLElement>('#page-content');
  if (!page || typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_title: document.title
  });
  window.gtag('event', 'page_metadata', {
    content_type: page.dataset.pageLayout || '',
    content_id: page.dataset.pageId || '',
    content_language: page.dataset.pageLanguage || document.documentElement.lang
  });
}

const swup = new Swup({
  cache: false,
  containers: ['#page-content'],
  ignoreVisit: shouldIgnoreVisit,
  native: true,
  skipPopStateHandling: shouldSkipPopStateHandling,
  plugins: [
    new SwupHeadPlugin(),
    new SwupA11yPlugin(),
    new SwupScriptsPlugin({ head: false, body: true, optin: true })
  ]
});

swup.hooks.before('content:replace', () => {
  window.__brokawPageCleanup?.();
  window.__brokawPageCleanup = undefined;
});

swup.hooks.on('page:view', () => {
  hydratePage();
  trackPageView();
});
