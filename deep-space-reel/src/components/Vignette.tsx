import React from "react";
import { AbsoluteFill } from "remotion";

// Lens falloff. The only "glow"-adjacent effect allowed, and it darkens.
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
      pointerEvents: "none",
    }}
  />
);
