#!/usr/bin/env node
/**
 * Self-hosts every font the reel uses, so renders never touch the network:
 *
 *   public/fonts/ibm-plex-mono-{200,300,400}.woff2  — Google Fonts "latin" subset
 *   public/fonts/noto-serif-sc-{300,400}.woff2      — see below
 *
 * Builds public/fonts/noto-serif-sc-{300,400}.woff2 — Noto Serif SC subset
 * to exactly the non-ASCII characters used anywhere in src/.
 *
 * Google Fonts' css2 API returns a subset font when given `text=`. Re-run
 * this (npm run fonts) whenever Chinese copy changes; the render will show
 * tofu / fallback glyphs for any character missing from the subset.
 *
 * Behind a proxy on Node 22+, run with NODE_USE_ENV_PROXY=1.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEIGHTS = ["300", "400"];

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const chars = new Set();
for (const file of walk(join(root, "src"))) {
  if (!/\.(tsx?|json)$/.test(file)) continue;
  for (const ch of readFileSync(file, "utf8")) {
    if (ch.codePointAt(0) > 0x7f) chars.add(ch);
  }
}
// Latin that appears inside Chinese lines renders in Noto too.
for (const ch of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:;·-–—%()/'") {
  chars.add(ch);
}
const text = [...chars].sort().join("");
console.log(`${chars.size} glyphs`);

// A modern UA gets woff2.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

mkdirSync(join(root, "public", "fonts"), { recursive: true });

for (const w of WEIGHTS) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@${w}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl, { headers: { "User-Agent": UA } })).text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
  if (urls.length !== 1) {
    throw new Error(`Expected one font URL for weight ${w}, got ${urls.length}:\n${css}`);
  }
  const res = await fetch(urls[0], { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Font download failed (${res.status}) for weight ${w}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = join(root, "public", "fonts", `noto-serif-sc-${w}.woff2`);
  writeFileSync(out, buf);
  console.log(`wrote ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}

// IBM Plex Mono: the css2 response lists one @font-face per unicode subset,
// each preceded by a /* subset */ comment. Keep only "latin".
for (const w of ["200", "300", "400"]) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@${w}`;
  const css = await (await fetch(cssUrl, { headers: { "User-Agent": UA } })).text();
  const latin = css.match(/\/\* latin \*\/[^}]*url\((https:[^)]+)\)/);
  if (!latin) throw new Error(`No latin subset for IBM Plex Mono ${w}:\n${css}`);
  const res = await fetch(latin[1], { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Font download failed (${res.status}) for Plex ${w}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = join(root, "public", "fonts", `ibm-plex-mono-${w}.woff2`);
  writeFileSync(out, buf);
  console.log(`wrote ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}
