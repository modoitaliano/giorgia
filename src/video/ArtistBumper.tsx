import "@fontsource/barlow/700.css";
import "@fontsource/barlow/800.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";

import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame } from "remotion";
import type { ArtistBumperImages, ArtistBumperProps } from "./types.js";

export const ARTIST_BUMPER_FPS = 30;
export const ARTIST_BUMPER_DURATION_IN_FRAMES = 360;
export const ARTIST_BUMPER_WIDTH = 1920;
export const ARTIST_BUMPER_HEIGHT = 1080;

export const ARTIST_BUMPER_TIMELINE = {
  firstImage: [0, 19],
  secondImage: [20, 38],
  thirdImage: [39, 61],
  identity: [62, 220],
  onAir: [221, 359],
} as const;

const robImageOne = new URL("./assets/rob/rob-01.png", import.meta.url).href;
const robImageTwo = new URL("./assets/rob/rob-02.png", import.meta.url).href;
const robImageThree = new URL("./assets/rob/rob-03.png", import.meta.url).href;
const robImageFour = new URL("./assets/rob/rob-04.png", import.meta.url).href;
const robAudio = new URL("./assets/rob/bumper-audio.webm", import.meta.url).href;

export const robArtistBumperProps: ArtistBumperProps = {
  artist: "ROB",
  songTitle: "Cento ragazze",
  images: [robImageOne, robImageTwo, robImageThree, robImageFour],
  audioUrl: robAudio,
  eyebrow: "ModoItaliano presenta",
  contentType: "Singolo",
  creditLines: ["Warner Music Italy · 2025", "Inedito di X Factor 2025"],
  siteUrl: "modoitaliano.fm",
};

export type ArtistBumperSegment = "OPENING" | "IDENTITY" | "ON_AIR";

export function getArtistBumperSegment(frame: number): ArtistBumperSegment {
  if (frame < ARTIST_BUMPER_TIMELINE.identity[0]) return "OPENING";
  if (frame < ARTIST_BUMPER_TIMELINE.onAir[0]) return "IDENTITY";
  return "ON_AIR";
}

export function getArtistBumperImageIndex(frame: number): 0 | 1 | 2 | 3 {
  if (frame <= ARTIST_BUMPER_TIMELINE.firstImage[1]) return 0;
  if (frame <= ARTIST_BUMPER_TIMELINE.secondImage[1]) return 1;
  if (frame <= ARTIST_BUMPER_TIMELINE.thirdImage[1]) return 2;
  return 3;
}

export function validateArtistBumperImages(images: ArtistBumperImages): void {
  if (images.length !== 4) {
    throw new Error("Artist bumper requires exactly four images");
  }
  if (images.some((image) => image.trim().length === 0)) {
    throw new Error("Artist bumper images must be non-empty URLs");
  }
  if (new Set(images).size !== 4) {
    throw new Error("Artist bumper requires four unique images");
  }
}

export function getHandoffAtmosphere(frame: number) {
  const progress = interpolate(
    frame,
    ARTIST_BUMPER_TIMELINE.onAir,
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return {
    blue: {
      x: interpolate(progress, [0, 0.48, 1], [-220, 30, 300]),
      y: interpolate(progress, [0, 0.48, 1], [110, -80, -150]),
      scale: interpolate(progress, [0, 0.48, 1], [1, 1.16, 1.06]),
    },
    magenta: {
      x: interpolate(progress, [0, 0.55, 1], [170, -40, -260]),
      y: interpolate(progress, [0, 0.55, 1], [-130, 40, 180]),
      scale: interpolate(progress, [0, 0.55, 1], [1.08, 0.98, 1.2]),
    },
    violet: {
      x: interpolate(progress, [0, 0.42, 1], [-80, 100, 240]),
      y: interpolate(progress, [0, 0.42, 1], [180, 40, -110]),
      scale: interpolate(progress, [0, 0.42, 1], [0.94, 1.12, 1.02]),
    },
  };
}

function MiMark({ width = 220 }: { width?: number }) {
  return (
    <svg
      aria-label="ModoItaliano"
      viewBox="0 0 595.27 206.59"
      width={width}
      role="img"
      style={{ display: "block", overflow: "visible" }}
    >
      <path fill="#fff" d="M160.26 103.3c0 44.25-35.88 80.13-80.12 80.13S0 147.55 0 103.3s35.87-80.14 80.14-80.14c44.25 0 80.12 35.88 80.12 80.14Z" />
      <rect fill="#fff" x="211.95" y="23.16" width="160.26" height="160.27" />
      <path fill="#fff" d="m415.46 181.15 89.9-155.71 89.91 155.71H415.46Z" />
    </svg>
  );
}

const hardCutImageStyle: React.CSSProperties = {
  height: "100%",
  objectFit: "cover",
  width: "100%",
};

function fitText(
  text: string,
  availableWidth: number,
  maximum: number,
  minimum: number,
  approximateGlyphWidth: number,
) {
  return Math.max(
    minimum,
    Math.min(maximum, availableWidth / (Math.max(1, text.length) * approximateGlyphWidth)),
  );
}

function ProgramHeader({ eyebrow }: { eyebrow: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 30,
        left: 82,
        position: "absolute",
        right: 82,
        top: 68,
        zIndex: 20,
      }}
    >
      <MiMark width={172} />
      <span
        style={{
          color: "rgba(255,255,255,.86)",
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 31,
          fontWeight: 700,
          letterSpacing: "0.13em",
          textShadow: "0 3px 16px rgba(0,0,0,.65)",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </span>
      <div
        style={{
          background: "rgba(255,255,255,.42)",
          bottom: -28,
          height: 2,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
    </div>
  );
}

function EditorialGrade({ reveal }: { reveal: boolean }) {
  return (
    <AbsoluteFill
      style={{
        background: reveal
          ? "linear-gradient(90deg, rgba(4,9,30,.34) 0%, rgba(4,9,30,.02) 58%, rgba(4,9,30,.36) 100%), linear-gradient(0deg, rgba(7,13,43,.96) 0%, rgba(7,13,43,.08) 50%, rgba(8,12,30,.28) 100%)"
          : "linear-gradient(90deg, rgba(4,8,26,.12), rgba(4,8,26,.03) 62%, rgba(4,8,26,.36)), linear-gradient(0deg, rgba(7,13,43,.68), transparent 58%)",
      }}
    />
  );
}

function IdentityCard({ props }: { props: ArtistBumperProps }) {
  const artistSize = fitText(props.artist, 1080, 222, 88, 0.52);
  const titleSize = fitText(props.songTitle, 1055, 58, 34, 0.62);
  const credits = props.creditLines ?? ["", ""];

  return (
    <div
      style={{
        bottom: 70,
        color: "white",
        left: 82,
        paddingLeft: 38,
        position: "absolute",
        width: 1160,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "#ed0076",
          bottom: 0,
          boxShadow: "0 0 30px rgba(237,0,118,.3)",
          left: 0,
          position: "absolute",
          top: 0,
          width: 10,
        }}
      />
      <div
        style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: artistSize,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          lineHeight: 0.76,
          textShadow: "0 8px 34px rgba(0,0,0,.66)",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {props.artist}
      </div>
      <div
        style={{
          fontFamily: "Barlow, sans-serif",
          fontSize: titleSize,
          fontWeight: 700,
          letterSpacing: "0.18em",
          marginTop: 24,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {props.songTitle}
      </div>
      <div
        style={{
          borderTop: "2px solid rgba(255,255,255,.4)",
          display: "grid",
          gridTemplateColumns: "190px 1fr",
          marginTop: 27,
          paddingTop: 18,
          width: 1055,
        }}
      >
        <strong
          style={{
            color: "#ed0076",
            fontFamily: "Barlow Condensed, sans-serif",
            fontSize: 31,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}
        >
          {props.contentType ?? "Singolo"}
        </strong>
        <div
          style={{
            fontFamily: "Barlow, sans-serif",
            fontSize: 29,
            fontWeight: 700,
            lineHeight: 1.35,
            textShadow: "0 3px 10px rgba(0,0,0,.78)",
          }}
        >
          {credits[0]}<br />{credits[1]}
        </div>
      </div>
    </div>
  );
}

function OnAirCard({ frame, props }: { frame: number; props: ArtistBumperProps }) {
  const atmosphere = getHandoffAtmosphere(frame);
  const artistSize = fitText(props.artist, 1040, 202, 86, 0.52);
  const titleSize = fitText(props.songTitle, 1040, 44, 29, 0.62);
  const blob = (color: string, size: string, transform: string): React.CSSProperties => ({
    background: `radial-gradient(ellipse at center, ${color} 0%, transparent 68%)`,
    filter: "blur(8px)",
    height: size,
    position: "absolute",
    transform,
    width: size,
    willChange: "transform",
  });

  return (
    <AbsoluteFill style={{ background: "#09102f", overflow: "hidden" }}>
      <div style={blob("rgba(49,93,225,.72)", "1050px", `translate3d(${atmosphere.blue.x}px, ${atmosphere.blue.y}px, 0) scale(${atmosphere.blue.scale})`)} />
      <div style={{ ...blob("rgba(237,0,118,.68)", "1120px", `translate3d(${930 + atmosphere.magenta.x}px, ${-260 + atmosphere.magenta.y}px, 0) scale(${atmosphere.magenta.scale})`) }} />
      <div style={{ ...blob("rgba(123,43,151,.52)", "980px", `translate3d(${620 + atmosphere.violet.x}px, ${450 + atmosphere.violet.y}px, 0) scale(${atmosphere.violet.scale})`) }} />
      <AbsoluteFill style={{ background: "linear-gradient(110deg, rgba(9,16,47,.08), rgba(9,16,47,.54) 66%, rgba(9,16,47,.1))" }} />
      <div style={{ background: "#ed0076", bottom: 0, left: 0, position: "absolute", top: 0, width: 38 }} />
      <div style={{ alignItems: "center", display: "grid", gridTemplateColumns: "390px 1fr", inset: "0 142px", position: "absolute" }}>
        <MiMark width={254} />
        <div style={{ borderLeft: "10px solid #ed0076", color: "white", paddingLeft: 76 }}>
          <div style={{ color: "#ed0076", fontFamily: "Barlow Condensed, sans-serif", fontSize: 38, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            In onda ora
          </div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: artistSize, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.79, marginTop: 17, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {props.artist}
          </div>
          <div style={{ color: "rgba(255,255,255,.78)", fontFamily: "Barlow, sans-serif", fontSize: titleSize, fontWeight: 700, letterSpacing: "0.18em", marginTop: 28, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {props.songTitle}
          </div>
        </div>
      </div>
      <div style={{ bottom: 54, color: "rgba(255,255,255,.82)", fontFamily: "Barlow Condensed, sans-serif", fontSize: 31, fontWeight: 700, letterSpacing: "0.1em", position: "absolute", right: 96 }}>
        {props.siteUrl ?? "modoitaliano.fm"}
      </div>
    </AbsoluteFill>
  );
}

type ArtistBumperFrameProps = ArtistBumperProps & {
  frame: number;
  imageComponent?: React.ElementType<{ src: string; style?: React.CSSProperties }>;
};

export function ArtistBumperFrame({
  frame,
  imageComponent: ImageComponent = "img",
  ...props
}: ArtistBumperFrameProps) {
  validateArtistBumperImages(props.images);
  const segment = getArtistBumperSegment(frame);
  const activeImage = props.images[getArtistBumperImageIndex(frame)];

  if (segment === "ON_AIR") return <OnAirCard frame={frame} props={props} />;

  return (
    <AbsoluteFill style={{ background: "#09102f", color: "white", overflow: "hidden" }}>
      <ImageComponent src={activeImage} style={hardCutImageStyle} />
      <EditorialGrade reveal={segment === "IDENTITY"} />
      <ProgramHeader eyebrow={props.eyebrow ?? "ModoItaliano presenta"} />
      {segment === "IDENTITY" ? <IdentityCard props={props} /> : null}
    </AbsoluteFill>
  );
}

export function ArtistBumper(props: ArtistBumperProps) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ArtistBumperFrame frame={frame} imageComponent={Img} {...props} />
      {props.audioUrl ? <Audio src={props.audioUrl} /> : null}
    </AbsoluteFill>
  );
}
