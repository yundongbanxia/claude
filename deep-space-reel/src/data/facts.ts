/**
 * Every number that appears on screen lives here, keyed to a source in
 * README.md → "数据与来源". Do not put a figure on screen that is not in
 * this file, and do not add one here without a source row in the README.
 */

export const VOYAGER = {
  launch: "1977.09.05", // [V1]
  jupiter: "1979.03.05", // [V2] closest approach
  saturn: "1980.11.12", // [V3] closest approach
  paleBlueDot: "1990.02.14", // [V4]
  paleBlueDotAU: 40.5, // [V4] 40.47 AU (probe–Earth); used for placement
  paleBlueDotKm: "6 BILLION KM", // [V4] NASA: 6 billion km from the Sun
  heliopause: "2012.08.25", // [V5]
  heliopauseAU: 121, // [V5] ≈ 121 AU
  heliopauseKm: "181 亿公里", // [V5] 18.11 billion km
} as const;

// Mean orbital radii (AU) — schematic placement of orbit rings only. [P1]
export const ORBIT_AU = {
  earth: 1,
  mars: 1.52,
  jupiter: 5.2,
  saturn: 9.57,
  uranus: 19.17,
  neptune: 30.18,
} as const;

export const LIGHT_DAY = {
  date: "2026.11.18", // [V6] projected
  km: "25,902,068,356", // [V6] one light-day
  hours: 24, // [V6]
} as const;

export const MARS = {
  delayMinMin: 3, // [M1] one-way light time, closest
  delayMaxMin: 22, // [M1] one-way light time, farthest
} as const;

export type MarsSite = {
  id: string;
  name: string;
  zh: string;
  lat: number; // planetocentric, north positive
  lon: number; // east positive, −180…180
  coord: string; // as printed on screen
};

export const MARS_SITES: MarsSite[] = [
  // [M5] Nature Astronomy, Zhurong landing site
  {
    id: "zhurong",
    name: "ZHURONG",
    zh: "祝融号",
    lat: 25.066,
    lon: 109.925,
    coord: "25.1°N 109.9°E",
  },
  // [M4] Octavia E. Butler Landing
  {
    id: "perseverance",
    name: "PERSEVERANCE",
    zh: "毅力号",
    lat: 18.4447,
    lon: 77.4508,
    coord: "18.4°N 77.5°E",
  },
  // [M3] Bradbury Landing
  {
    id: "curiosity",
    name: "CURIOSITY",
    zh: "好奇号",
    lat: -4.5895,
    lon: 137.4417,
    coord: "4.6°S 137.4°E",
  },
];

export type MarsMilestone = {
  year: string;
  mission: string;
  zh: string;
  site?: MarsSite["id"];
};

export const MARS_TIMELINE: MarsMilestone[] = [
  { year: "1965", mission: "MARINER 4", zh: "水手4号 · 首次近距离拍摄火星" }, // [M2]
  { year: "1976", mission: "VIKING 1", zh: "海盗1号 · 着陆克律塞平原" }, // [M6]
  {
    year: "2012",
    mission: "CURIOSITY",
    zh: "好奇号 · 着陆盖尔撞击坑",
    site: "curiosity",
  }, // [M3]
  {
    year: "2021",
    mission: "PERSEVERANCE",
    zh: "毅力号 · 着陆耶泽罗撞击坑",
    site: "perseverance",
  }, // [M4]
  {
    year: "2021",
    mission: "TIANWEN-1",
    zh: "天问一号 · 祝融号着陆乌托邦平原",
    site: "zhurong",
  }, // [M5]
];
