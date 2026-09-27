import React from "react";
import { Composition, Folder } from "remotion";
import { DeepSpaceReel } from "./DeepSpaceReel";
import "./fonts";
import { LightDayScene } from "./scenes/LightDayScene";
import { MarsScene } from "./scenes/MarsScene";
import { Outro } from "./scenes/Outro";
import { Prologue } from "./scenes/Prologue";
import { VoyagerScene } from "./scenes/VoyagerScene";
import { FPS, HEIGHT, SCENE, TOTAL_FRAMES, WIDTH } from "./theme";

// Each scene is also registered on its own ("connected compositions") so it
// can be scrubbed in isolation. Scenes are transparent — the starfield,
// vignette and HUD live in the master composition only.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DeepSpaceReel"
        component={DeepSpaceReel}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Folder name="Scenes">
        <Composition
          id="S00-Prologue"
          component={Prologue}
          durationInFrames={SCENE.prologue}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="S01-Voyager"
          component={VoyagerScene}
          durationInFrames={SCENE.voyager}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="S01b-LightDay"
          component={LightDayScene}
          durationInFrames={SCENE.lightDay}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="S02-Mars"
          component={MarsScene}
          durationInFrames={SCENE.mars}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="S03-Outro"
          component={Outro}
          durationInFrames={SCENE.outro}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
    </>
  );
};
