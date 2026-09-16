import { describe, expect, it } from "vitest";
import { canonicalArticleSchema } from "./canonical-article.js";

const document = {
  id: "contract-fixture",
  slug: "/fixture",
  canonicalUrl: "https://modoitaliano.fm/fixture",
  contentVersion: "2026-09-15T20:00:00.000Z",
  publishedAt: "2026-09-15T20:00:00.000Z",
  updatedAt: "2026-09-15T20:00:00.000Z",
  status: "published",
  title: "Fixture",
  language: "pt-BR",
  featured: false,
  body: [],
  layout: "homepage",
} as const;

describe("normative canonical-document schema", () => {
  it("accepts an open BCP 47 language and non-article documents without authors", () => {
    expect(canonicalArticleSchema.parse(document)).toMatchObject(document);
  });

  it("rejects malformed language tags", () => {
    expect(() =>
      canonicalArticleSchema.parse({ ...document, language: "not_a_tag" }),
    ).toThrow("Canonical document validation failed");
  });

  it("requires authors and categories for article pages", () => {
    expect(() =>
      canonicalArticleSchema.parse({ ...document, layout: "article-page" }),
    ).toThrow("Canonical document validation failed");

    expect(
      canonicalArticleSchema.parse({
        ...document,
        layout: "article-page",
        authors: [{ name: "Desk", slug: "desk" }],
        categories: [{ name: "News", slug: "news" }],
      }),
    ).toMatchObject({ layout: "article-page" });
  });
});
