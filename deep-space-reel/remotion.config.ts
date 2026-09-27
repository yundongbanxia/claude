/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// The Mars scene is WebGL. SwiftShader via ANGLE works on machines without a GPU
// (CI, cloud containers). Locally you can pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
// Dark gradients band easily; spend a few more bits on the encode.
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
