import { layoutNames } from "./layouts.js";
import { outletConfig } from "./outlet-config.js";
import type { CronkiteCLSManifest } from "./types/cronkite-manifest.generated.js";
import { version } from "./version.js";

const systemPages: NonNullable<CronkiteCLSManifest["systemPages"]> = [
  {
    layout: "404",
    route: "/{language}/404",
    key: "html/{language}/404/index.html",
    cacheControl: "public, max-age=0, must-revalidate",
    perLanguage: true,
    copy: {
      es: {
        title: "Página no encontrada",
        description: "La página que buscas no existe.",
      },
      en: {
        title: "Page Not Found",
        description: "The page you are looking for does not exist.",
      },
      it: {
        title: "Pagina non trovata",
        description: "La pagina che stai cercando non esiste.",
      },
    },
  },
  {
    layout: "search-page",
    route: "/{language}/search",
    key: "html/{language}/search/index.html",
    cacheControl: "public, max-age=0, must-revalidate",
    perLanguage: true,
    copy: {
      es: {
        title: "Buscar",
        description: outletConfig.searchDescriptions.es,
      },
      en: {
        title: "Search",
        description: outletConfig.searchDescriptions.en,
      },
      it: {
        title: "Cerca",
        description: outletConfig.searchDescriptions.it,
      },
    },
  },
  {
    layout: "coming-soon",
    route: "/{language}/coming-soon",
    key: "html/{language}/coming-soon/index.html",
    cacheControl: "public, max-age=0, must-revalidate",
    perLanguage: true,
    copy: {
      es: {
        title: "Próximamente",
        description:
          "Estamos preparando algo especial. Vuelve pronto para descubrirlo.",
      },
      en: {
        title: "Coming soon",
        description: "We are preparing something special. Come back soon.",
      },
      it: {
        title: "Prossimamente",
        description: "Stiamo preparando qualcosa di speciale. Torna presto.",
      },
    },
  },
];

export const cronkiteManifest = {
  contract: "cronkite.cls",
  contractVersion: 1,
  package: "@gaulatti/giorgia",
  version,
  layouts: [...layoutNames],
  languages: [...outletConfig.supportedLanguages],
  collections: {
    "article-page": "json/articles",
    "standalone-page": "json/pages",
  },
  systemPages,
  renderables: {
    "search-page": {
      engine: "handlebars",
      export: "render",
      outputMode: "single",
      lifecycle: "request",
      contentType: "text/html; charset=utf-8",
      resources: {
        "search-manifest": {
          key: "search-manifest-{language}.json",
          schema: "dist/schemas/search-manifest.schema.json",
          contentType: "application/json",
          perLanguage: true,
        },
      },
    },
    "social-image": {
      engine: "html-raster",
      export: "buildInstagramImageHtml",
      contentType: "image/jpeg",
      width: 1080,
      height: 1350,
    },
    "short-video": {
      engine: "remotion",
      entry: "dist/video/index.js",
      compositionId: "ModoItalianoShort",
      contentType: "video/mp4",
    },
  },
  capabilities: {
    fonts: { export: "fontFiles" },
    assets: { export: "assetFiles" },
  },
} as const satisfies CronkiteCLSManifest;
