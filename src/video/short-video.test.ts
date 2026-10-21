import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDurationInFrames } from "./ShortVideo.js";
import {
  ARTIST_BUMPER_DURATION_IN_FRAMES,
  ArtistBumperFrame,
  getArtistBumperImageIndex,
  getArtistBumperSegment,
  getHandoffAtmosphere,
  robArtistBumperProps,
  validateArtistBumperImages,
} from "./ArtistBumper.js";
import type { ArtistBumperImages, ShortVideoSlide } from "./types.js";

describe("short-video template", () => {
  it("derives composition duration from caller-owned slides", () => {
    const slides: ShortVideoSlide[] = [
      { type: "HOOK", title: "Hook", byline: "Desk", durationInFrames: 60 },
      {
        type: "ARTICLE",
        title: "Story",
        excerpt: "Summary",
        durationInFrames: 120,
      },
      { type: "OUTRO", durationInFrames: 30 },
    ];

    expect(getDurationInFrames(slides)).toBe(210);
  });

  it("contains no Fifthbell or Sanremo identity", () => {
    const source = ["Root.tsx", "ShortVideo.tsx", "types.ts"]
      .map((file) =>
        readFileSync(join(process.cwd(), "src", "video", file), "utf8"),
      )
      .join("\n");

    expect(source).not.toMatch(/fifthbell|sanremo/i);
  });

  it("uses hard editorial cuts across the complete 12-second bumper", () => {
    expect(ARTIST_BUMPER_DURATION_IN_FRAMES).toBe(360);
    expect(getArtistBumperSegment(0)).toBe("OPENING");
    expect(getArtistBumperSegment(61)).toBe("OPENING");
    expect(getArtistBumperSegment(62)).toBe("IDENTITY");
    expect(getArtistBumperSegment(220)).toBe("IDENTITY");
    expect(getArtistBumperSegment(221)).toBe("ON_AIR");
    expect(getArtistBumperSegment(359)).toBe("ON_AIR");
  });

  it("shows four distinct images before the on-air card", () => {
    validateArtistBumperImages(robArtistBumperProps.images);
    expect([0, 20, 39, 62].map(getArtistBumperImageIndex)).toEqual([0, 1, 2, 3]);
    expect(() => validateArtistBumperImages(["same", "same", "third", "fourth"])).toThrow(
      "four unique images",
    );
  });

  it("moves the on-air gradient throughout its hold", () => {
    const start = getHandoffAtmosphere(221);
    const middle = getHandoffAtmosphere(290);
    const end = getHandoffAtmosphere(359);

    expect(middle).not.toEqual(start);
    expect(end).not.toEqual(middle);
    expect(end.blue.x).toBeGreaterThan(start.blue.x);
    expect(end.magenta.x).toBeLessThan(start.magenta.x);
  });

  it("rejects invalid image counts from untyped composition inputs", () => {
    for (const images of [[], ["one", "two", "three", "four", "one"]]) {
      expect(() => renderToStaticMarkup(createElement(ArtistBumperFrame, {
        ...robArtistBumperProps,
        images: images as unknown as ArtistBumperImages,
        frame: 0,
      }))).toThrow("exactly four images");
    }
  });

  it("renders each image cut, identity text, and the final on-air handoff", () => {
    for (const [frame, imageIndex] of [[0, 0], [19, 0], [20, 1], [38, 1], [39, 2], [61, 2], [62, 3], [220, 3]]) {
      const markup = renderToStaticMarkup(createElement(ArtistBumperFrame, {
        ...robArtistBumperProps,
        frame,
      }));
      expect(markup).toContain(`src="${robArtistBumperProps.images[imageIndex]}"`);
      expect(markup.includes("Cento ragazze")).toBe(frame >= 62);
    }
    for (const frame of [221, 359]) {
      const markup = renderToStaticMarkup(createElement(ArtistBumperFrame, {
        ...robArtistBumperProps,
        frame,
      }));
      expect(markup).toContain("In onda ora");
      expect(markup).toContain("Cento ragazze");
      expect(markup).not.toContain("<img");
    }
  });
});
