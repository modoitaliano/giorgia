import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  frame: 0,
  registered: [] as unknown[],
  compositions: [] as Array<Record<string, any>>,
}));

vi.mock("remotion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("remotion")>();
  const React = await import("react");
  const element = (tag: string) => (props: Record<string, any>) =>
    React.createElement(tag, { "data-remotion": tag, style: props.style, src: props.src }, props.children);
  return {
    ...actual,
    AbsoluteFill: element("div"),
    Audio: (props: Record<string, any>) =>
      React.createElement("audio", { src: props.src, "data-volume": String(props.volume ?? "") }),
    Img: element("img"),
    Sequence: (props: Record<string, any>) =>
      React.createElement("section", { "data-from": props.from, "data-duration": props.durationInFrames }, props.children),
    useCurrentFrame: () => state.frame,
    useVideoConfig: () => ({ fps: 30, durationInFrames: 300, width: 1080, height: 1920 }),
    Composition: (props: Record<string, any>) => {
      state.compositions.push(props);
      return null;
    },
    registerRoot: (root: unknown) => {
      state.registered.push(root);
    },
  };
});

const { ShortVideo } = await import("./ShortVideo.js");
const { ArtistBumper, ArtistBumperFrame, robArtistBumperProps, validateArtistBumperImages } = await import("./ArtistBumper.js");
const { RemotionRoot } = await import("./Root.js");

const brand = { name: "Brand", siteUrl: "https://example.test/" };
const slides = [
  { type: "HOOK", title: "Hook title", byline: "Desk", durationInFrames: 60 },
  { type: "ARTICLE", title: "Story", excerpt: "Summary", slug: "/a-story", durationInFrames: 120 },
  { type: "OUTRO", durationInFrames: 30 },
] as const;

const render = (node: ReactNode) => renderToStaticMarkup(node as never);

beforeEach(() => {
  state.frame = 0;
  state.compositions.length = 0;
});

describe("ShortVideo composition", () => {
  it("lays slides out back to back with the brand name when there is no logo", () => {
    const html = render(createElement(ShortVideo, { title: "T", byline: "B", slides: [...slides], brand }));
    expect(html).toContain('data-from="0" data-duration="60"');
    expect(html).toContain('data-from="60" data-duration="120"');
    expect(html).toContain('data-from="180" data-duration="30"');
    expect(html).toContain("Hook title");
    expect(html).toContain("https://example.test/a-story");
    expect(html).toContain("https://example.test/");
    expect(html).toContain(">Brand<");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<img");
  });

  it("uses brand colors, logo and background art, explicit article url and image, and outro text", () => {
    const richBrand = { ...brand, logoUrl: "https://cdn.test/logo.png", backgroundImageUrl: "https://cdn.test/bg.jpg", primaryColor: "#111111", secondaryColor: "#222222" };
    const html = render(
      createElement(ShortVideo, {
        title: "T",
        byline: "B",
        brand: richBrand,
        audioUrl: "https://cdn.test/a.mp3",
        slides: [
          { type: "HOOK", title: "H", byline: "b", durationInFrames: 30 },
          { type: "ARTICLE", title: "S", excerpt: "E", url: "https://news.test/full", imageUrl: "https://cdn.test/art.jpg", durationInFrames: 30 },
          { type: "ARTICLE", title: "No slug", excerpt: "E", durationInFrames: 30 },
          { type: "OUTRO", text: "Goodbye", durationInFrames: 30 },
        ],
      }),
    );
    expect(html).toContain("https://cdn.test/logo.png");
    expect(html).toContain("https://cdn.test/bg.jpg");
    expect(html).toContain("https://cdn.test/art.jpg");
    expect(html).toContain("#111111");
    expect(html).toContain("https://news.test/full");
    expect(html).toContain("Goodbye");
    expect(html).toContain('<audio src="https://cdn.test/a.mp3"');
  });

  it("fades the soundtrack out over the last second", () => {
    const props = { title: "T", byline: "B", slides: [{ type: "OUTRO", durationInFrames: 90 }], brand, audioUrl: "https://cdn.test/a.mp3" };
    state.frame = 0;
    expect(render(createElement(ShortVideo, props as never))).toContain('data-volume="1"');
    state.frame = 90;
    expect(render(createElement(ShortVideo, props as never))).toContain('data-volume="0"');
  });
});

describe("ArtistBumper composition", () => {
  it("renders the frame for the current timeline position with the remotion image and audio", () => {
    state.frame = 10;
    const html = render(createElement(ArtistBumper, robArtistBumperProps));
    expect(html).toContain(`src="${robArtistBumperProps.images[0]}"`);
    expect(html).toContain("<audio");
    state.frame = 100;
    expect(render(createElement(ArtistBumper, robArtistBumperProps))).toContain("Cento ragazze");
  });

  it("omits audio when none is supplied and falls back to default copy", () => {
    const minimal = { artist: "ARTIST", songTitle: "SONG", images: ["a", "b", "c", "d"] as const, audioUrl: null };
    state.frame = 100;
    const identity = render(createElement(ArtistBumper, minimal));
    expect(identity).not.toContain("<audio");
    expect(identity).toContain("ModoItaliano presenta");
    expect(identity).toContain("Singolo");
    state.frame = 300;
    const onAir = render(createElement(ArtistBumper, minimal));
    expect(onAir).toContain("modoitaliano.fm");
    expect(onAir).toContain("In onda ora");
  });

  it("honours custom eyebrow, content type, credits and site url", () => {
    const custom = { ...robArtistBumperProps, eyebrow: "Presenta", contentType: "Album", creditLines: ["Line one", "Line two"] as const, siteUrl: "example.test" };
    const identity = render(createElement(ArtistBumperFrame, { ...custom, frame: 100 }));
    expect(identity).toContain("Presenta");
    expect(identity).toContain("Album");
    expect(identity).toContain("Line one");
    expect(render(createElement(ArtistBumperFrame, { ...custom, frame: 300 }))).toContain("example.test");
  });

  it("rejects blank image urls", () => {
    expect(() => validateArtistBumperImages(["a", "  ", "c", "d"])).toThrow("non-empty URLs");
  });
});

describe("Remotion root", () => {
  it("registers both compositions and derives short-video metadata from its slides", () => {
    render(createElement(RemotionRoot));
    expect(state.compositions.map((c) => c.id)).toEqual(["ModoItalianoShort", "ModoItalianoArtistBumper"]);
    const short = state.compositions[0];
    expect(short.durationInFrames).toBe(300);
    expect(short.calculateMetadata({ props: { slides: [...slides] } })).toEqual({ durationInFrames: 210, fps: 30, width: 1080, height: 1920 });
    expect(state.compositions[1].fps).toBe(30);
    expect(state.compositions[1].width).toBe(1920);
  });

  it("registers the root when the video entry point loads", async () => {
    vi.resetModules();
    state.registered.length = 0;
    const entry = await import("./index.js");
    expect(state.registered).toHaveLength(1);
    expect(typeof entry.ShortVideo).toBe("function");
  });
});
