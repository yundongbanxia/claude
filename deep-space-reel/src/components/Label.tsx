import React from "react";
import { FONT } from "../fonts";
import { COLOR } from "../theme";

type Align = "left" | "right";

/**
 * A HUD annotation: a thin mono line on top, optional serif Chinese below.
 * Positioned by its anchor corner so leaders can meet it precisely.
 */
export const Label: React.FC<{
  x: number;
  y: number;
  align?: Align;
  // anchor the text block's bottom edge to y instead of its top edge
  above?: boolean;
  mono: string;
  zh?: string;
  accent?: string;
  opacity: number;
  size?: number;
}> = ({
  x,
  y,
  align = "left",
  above,
  mono,
  zh,
  accent = COLOR.white,
  opacity,
  size = 17,
}) => (
  <div
    style={{
      position: "absolute",
      left: align === "left" ? x : undefined,
      right: align === "right" ? 1920 - x : undefined,
      top: above ? undefined : y,
      bottom: above ? 1080 - y : undefined,
      textAlign: align,
      opacity,
      whiteSpace: "nowrap",
    }}
  >
    <div
      style={{
        fontFamily: FONT.mono,
        fontWeight: 300,
        fontSize: size,
        letterSpacing: "0.16em",
        color: accent,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {mono}
    </div>
    {zh ? (
      <div
        style={{
          fontFamily: FONT.serif,
          fontWeight: 400,
          fontSize: size + 5,
          letterSpacing: "0.12em",
          color: COLOR.white,
          opacity: 0.8,
          marginTop: 6,
        }}
      >
        {zh}
      </div>
    ) : null}
  </div>
);
