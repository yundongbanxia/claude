import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill } from "remotion";
import { HudFrame } from "./components/HudFrame";
import { Starfield } from "./components/Starfield";
import { Vignette } from "./components/Vignette";
import "./fonts";
import { LightDayScene } from "./scenes/LightDayScene";
import { MarsScene } from "./scenes/MarsScene";
import { Outro } from "./scenes/Outro";
import { Prologue } from "./scenes/Prologue";
import { VoyagerScene } from "./scenes/VoyagerScene";
import { COLOR, EASE, SCENE, TRANSITION } from "./theme";

// Every cut is a slow dissolve; no wipes, slides or flips.
const dissolve = linearTiming({
  durationInFrames: TRANSITION,
  easing: EASE.camera,
});

/**
 * Master timeline — TOTAL_FRAMES (900) @ 30 fps.
 * Layers, back to front: starfield (continuous across cuts) → scenes →
 * vignette → HUD chrome.
 */
export const DeepSpaceReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.space }}>
      <Starfield />
      <TransitionSeries>
        <TransitionSeries.Sequence
          name="00 Prologue"
          durationInFrames={SCENE.prologue}
        >
          <Prologue />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={dissolve} />
        <TransitionSeries.Sequence
          name="01 Voyager"
          durationInFrames={SCENE.voyager}
        >
          <VoyagerScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={dissolve} />
        <TransitionSeries.Sequence
          name="01b Light-day"
          durationInFrames={SCENE.lightDay}
        >
          <LightDayScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={dissolve} />
        <TransitionSeries.Sequence name="02 Mars" durationInFrames={SCENE.mars}>
          <MarsScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={dissolve} />
        <TransitionSeries.Sequence
          name="03 Outro"
          durationInFrames={SCENE.outro}
        >
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Vignette />
      <HudFrame />
    </AbsoluteFill>
  );
};
