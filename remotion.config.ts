import { Config } from "@remotion/cli/config";

// Headless Chrome needs ANGLE for WebGL (three.js) on macOS.
Config.setChromiumOpenGlRenderer("angle");
// With several tabs, most WebGL canvases (8K Earth texture each) rendered blank white frames.
Config.setConcurrency(1);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
