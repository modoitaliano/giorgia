import React from "react";
import { Composition } from "remotion";
import { getDurationInFrames, ShortVideo } from "./ShortVideo.js";
import type { ShortVideoProps } from "./types.js";

const defaultProps: ShortVideoProps = {
  title: "Notizie del giorno",
  byline: "ModoItaliano",
  brand: {
    name: "ModoItaliano",
    siteUrl: "https://modoitaliano.fm",
    primaryColor: "#b21100",
    secondaryColor: "#111827",
  },
  slides: [
    {
      type: "HOOK",
      title: "Notizie del giorno",
      byline: "ModoItaliano",
      durationInFrames: 90,
    },
    {
      type: "ARTICLE",
      title: "Una storia di esempio",
      excerpt: "Il testo e la grafica sono forniti dal chiamante.",
      slug: "storia-di-esempio",
      durationInFrames: 150,
    },
    {
      type: "OUTRO",
      durationInFrames: 60,
    },
  ],
};

export function RemotionRoot() {
  return (
    <Composition
      id="ModoItalianoShort"
      component={ShortVideo}
      calculateMetadata={({ props }) => ({
        durationInFrames: getDurationInFrames(props.slides),
        fps: 30,
        width: 1080,
        height: 1920,
      })}
      defaultProps={defaultProps}
      durationInFrames={getDurationInFrames(defaultProps.slides)}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}
