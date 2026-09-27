# 人类的深空之旅 · Deep Space Reel

一支 30 秒的动态图形短片：从旅行者1号到火星探索。用 [Remotion](https://www.remotion.dev) 以代码制作。

- 规格：1920×1080 · 30fps · 900 帧（30 秒）
- 风格：深空黑底，冷白 / 淡金 / 火星锈红三色；中文 Noto Serif SC，英文与数字 IBM Plex Mono 细体；慢速镜头、视差星场、HUD 细线标注
- 视觉规范：见 [`CLAUDE.md`](./CLAUDE.md)（后续修改都要遵守）

## 分镜

| # | 时间 | 场景 | 内容 |
|---|---|---|---|
| 00 | 0:00–0:05 | 序 | 一条细线展开，标题「人类的深空之旅」落在线上 |
| 01 | 0:04–0:14 | 远航 | 对数距离尺度的日心示意图。旅行者1号 1977 年发射，飞掠木星、土星，1990 年回望地球（暗淡蓝点），2012 年穿越日球层顶；镜头一路拉远 |
| 01b | 0:13–0:19 | 光日 | 一把 24 小时长的标尺：信号从地球走到旅行者1号。预计 2026.11.18 它将距地球一光日；地火之间 3–22 分钟的时延在这把尺上只是左端的一小截 |
| 02 | 0:18–0:27 | 火星 | 3D 火星缓慢推近、顺行自转。左侧 1965 → 2021 的里程碑逐条出现，好奇号 / 毅力号 / 祝融号的着陆点按公布坐标投影标注 |
| 03 | 0:27–0:30 | 未完 | 「信号，仍在路上」，淡出到黑 |

## 本地预览

需要 Node.js 18+。

```bash
cd deep-space-reel
npm i
npm run dev          # 打开 Remotion Studio（默认 http://localhost:3000）
```

Studio 里 `DeepSpaceReel` 是成片；`Scenes/` 文件夹下每个场景可单独预览（场景本身透明，星场/HUD 只在成片中）。

## 渲染

```bash
npx remotion render DeepSpaceReel out/deep-space-reel.mp4
# 或
npm run render
```

- 首次渲染会自动下载 Chrome Headless Shell（来自 `remotion.media`，需要网络放行该域名）。
- 火星场景是 WebGL，`remotion.config.ts` 默认使用 `swangle`（无 GPU 也能渲染）。本机有 GPU 时可加 `--gl=angle` 提速。
- 只渲染几帧检查：`npx remotion render DeepSpaceReel out/frames --frames=0,300,600,800 --image-format=png`

成片：[`out/deep-space-reel.mp4`](./out/deep-space-reel.mp4)（H.264 · 1920×1080 · 30fps · 900 帧 · 30.0 秒 · 约 12 MB）。在云端容器（无 GPU，SwiftShader）里完整渲染约 5.5 分钟。

## 字体

所有字体都放在 `public/fonts/`，渲染时不访问网络（也避免了无头 Chrome 不信任代理证书导致 Google Fonts 加载失败的问题）。由 `npm run fonts`（`scripts/fetch-fonts.mjs`）从 Google Fonts 生成：

- IBM Plex Mono 200 / 300 / 400：latin 子集，每个 ~15KB。
- Noto Serif SC 300 / 400：**子集**，只包含 `src/` 中出现过的字符（约 220 个字形，每个 ~35KB）。
  改动中文文案后必须重新运行 `npm run fonts`（代理环境：`NODE_USE_ENV_PROXY=1 npm run fonts`）。

两款字体均为 SIL Open Font License 1.1。

## 项目结构

```
src/
  Root.tsx              成片 + 各场景的 Composition 注册
  DeepSpaceReel.tsx     主时间线：星场 → 场景（TransitionSeries）→ 暗角 → HUD
  theme.ts              颜色 / 时间曲线 / 场景时长常量（与 CLAUDE.md 同步）
  fonts.ts              字体加载
  data/facts.ts         屏幕上出现的所有数字（每条对应下方来源编号）
  components/           Starfield · HudFrame · Label · ChapterTitle · Vignette
  scenes/               Prologue · VoyagerScene · LightDayScene · MarsScene · Outro
  scenes/mars/          程序化火星纹理 + Three.js 球体
scripts/fetch-fonts.mjs 生成 Noto Serif SC 子集
```

## 数据与来源

原则：所有年份、距离、时延先联网核实再上屏；拿不准的不用。编号与 `src/data/facts.ts` 注释一一对应。

> 核实方式说明：本次制作环境的出口策略拦截了 nasa.gov / jpl.nasa.gov / wikipedia.org 等站点的直接抓取，数字是通过网络搜索结果中对这些页面的引用交叉核对的。下表链接为原始出处，建议发布前点开抽查。

| 编号 | 屏幕上的内容 | 数值 | 来源 |
|---|---|---|---|
| V1 | 旅行者1号发射 | 1977.09.05 | [NASA · Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/) · [NASA · Interstellar Mission](https://science.nasa.gov/mission/voyager/interstellar-mission/) |
| V2 | 飞掠木星（最近点） | 1979.03.05 | [NASA · 40 Years Ago: Voyager 1 Explores Jupiter](https://www.nasa.gov/history/40-years-ago-voyager-1-explores-jupiter/) · [NASA · Voyager Fact Sheet](https://science.nasa.gov/mission/voyager/fact-sheet/) |
| V3 | 飞掠土星（最近点） | 1980.11.12 | [NASA · 40 Years Ago: Voyager 1 Explores Saturn](https://www.nasa.gov/history/40-years-ago-voyager-1-explores-saturn/) |
| V4 | 回望地球：暗淡蓝点 | 1990.02.14；距太阳约 60 亿公里（屏幕：6 BILLION KM）；示意图上按 40.5 AU 放置（探测器—地球 40.47 AU） | [NASA · The Pale Blue Dot](https://science.nasa.gov/resource/voyager-pale-blue-dot-download/) · [Wikipedia · Pale Blue Dot](https://en.wikipedia.org/wiki/Pale_Blue_Dot) |
| V5 | 穿越日球层顶、进入星际空间 | 2012.08.25；约 121 AU；距太阳 181 亿公里（NASA：18.11 billion km） | [NASA · Interstellar Mission](https://science.nasa.gov/mission/voyager/interstellar-mission/) · [JHU APL · Voyager 1 Reaches Interstellar Space](https://www.jhuapl.edu/news/news-releases/130912-voyager-1-reaches-interstellar-space) |
| V6 | 预计距地球一光日 | 2026.11.18（NASA：2:16:07 a.m. PST）；一光日 = 25,902,068,356 km；单程信号 24 小时；首个抵达此距离的人造物体 | [NASA · Voyager 1: What Is a Light-Day](https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/) · [CNN, 2025-12-09](https://www.cnn.com/2025/12/09/science/voyager-1-light-day-earth) |
| M1 | 地火单程通信时延 | 3–22 分钟 | [NASA · Mars Communications Disruption and Delay (PDF)](https://www.nasa.gov/wp-content/uploads/2024/01/mars-communications-disruption-and-delay.pdf) · [ESA · Time delay between Mars and Earth](https://blogs.esa.int/mex/2012/08/05/time-delay-between-mars-and-earth/) |
| M2 | 水手4号首次近距离拍摄火星 | 1965 | [NASA · 55 Years Ago: Mariner 4 First to Explore Mars](https://www.nasa.gov/history/55-years-ago-mariner-4-first-to-explore-mars/) · [NASA · First TV Image of Mars](https://science.nasa.gov/photojournal/first-tv-image-of-mars/) |
| M6 | 海盗1号着陆克律塞平原 | 1976（1976.07.20） | [NASA · Viking Project](https://science.nasa.gov/mission/viking/) · [NASA NSSDCA · Viking 1 Lander](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C) |
| M3 | 好奇号着陆盖尔撞击坑（Bradbury Landing） | 2012（2012.08.06 05:17 UTC）；4.5895°S 137.4417°E（屏幕：4.6°S 137.4°E） | [NASA JPL · Curiosity](https://www.jpl.nasa.gov/missions/mars-science-laboratory-curiosity-rover-msl/) · [Wikipedia · Bradbury Landing](https://en.wikipedia.org/wiki/Bradbury_Landing) |
| M4 | 毅力号着陆耶泽罗撞击坑（Octavia E. Butler Landing） | 2021（2021.02.18）；18.4447°N 77.4508°E（屏幕：18.4°N 77.5°E） | [NASA · Welcome to Octavia E. Butler Landing](https://science.nasa.gov/resource/welcome-to-octavia-e-butler-landing/) · [Wikipedia · Octavia E. Butler Landing](https://en.wikipedia.org/wiki/Octavia_E._Butler_Landing) |
| M5 | 天问一号着陆乌托邦平原，祝融号 | 2021（2021.05.15）；25.066°N 109.925°E（屏幕：25.1°N 109.9°E） | [CNSA · Tianwen-1 mission marks 1st year on Mars](https://www.cnsa.gov.cn/english/n6465652/n6465653/c6840321/content.html) · [Nature Astronomy · Zhurong landing site](https://www.nature.com/articles/s41550-021-01519-5) |
| P1 | 行星轨道圈（示意） | 平均日距 AU：地球 1、火星 1.52、木星 5.2、土星 9.57、天王星 19.17、海王星 30.18 | [NASA NSSDCA · Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) |

**关于示意内容：**

- 01 章的日心图使用对数距离尺度，轨迹走向和行星在轨道上的位置是示意，画面右下角已注明「对数距离尺度 · 示意轨迹」。右下读数中的 YEAR / DISTANCE 只在上表的关键点（1 AU / 木星 / 土星 / 40.5 AU / 121 AU）与史实对应，中间值为插值动画。
- 02 章火星表面是程序化生成的示意纹理，不对应真实地貌，画面底部已注明；只有三个着陆点的位置按上表坐标标注。

**核实后决定不用的数字：**

- 旅行者1号的速度：常见的 17 km/s（61,000 km/h）是相对太阳；相对地球的数值会随季节变化（部分报道给出 128,700 km/h），参考系容易混淆，不上屏。
- 旅行者1号当前距离：实时变化，且本环境无法访问 JPL Horizons 取得指定日期的星历，不上屏；改用 NASA 公布的"一光日"时间点。
- 海盗1号着陆点坐标：不同来源给出 22.27°N 312.05°E 与 22.48°N 47.94°W，存在出入，只写年份和地名，不在球面上标注。
- 水手4号飞掠日期：美国时间 7 月 14 日、UTC 为 7 月 15 日，只写年份。
- 地火距离（公里数）：随轨道变化，范围值的来源口径不一，只用 NASA 的时延范围。

## 技术栈

`remotion` 4.0.529 · `@remotion/three` + `three` + `@react-three/fiber`（火星）· `@remotion/transitions`（溶解转场）· `@remotion/paths`（轨道绘制）· `@remotion/fonts`（本地字体加载）。
Remotion 官方 Agent Skills 安装在 `.claude/skills/`（`npx skills add remotion-dev/skills`）。
