import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// All fonts are self-hosted in public/fonts (built by scripts/fetch-fonts.mjs)
// so a render never depends on the network or on the browser's CA store.

// English + numerals: thin monospace (Google Fonts "latin" subset).
export const MONO_FAMILY = "IBM Plex Mono Reel";
for (const weight of ["200", "300", "400"]) {
  loadFont({
    family: MONO_FAMILY,
    url: staticFile(`fonts/ibm-plex-mono-${weight}.woff2`),
    weight,
  });
}

// Chinese: Noto Serif SC, subset to exactly the glyphs used in src/.
// A full CJK font is ~100 network chunks per weight — a local subset keeps
// renders fast and deterministic.
export const SERIF_FAMILY = "Noto Serif SC Reel";
for (const weight of ["300", "400"]) {
  loadFont({
    family: SERIF_FAMILY,
    url: staticFile(`fonts/noto-serif-sc-${weight}.woff2`),
    weight,
  });
}

export const FONT = {
  // Serif first so CJK glyphs land in Noto; Latin inside Chinese lines also
  // renders in Noto's Latin, which matches the serif voice.
  serif: `"${SERIF_FAMILY}", serif`,
  // CJK falls through to the serif subset rather than a system font (tofu).
  mono: `"${MONO_FAMILY}", "${SERIF_FAMILY}", monospace`,
} as const;
