import { LOOP_SECONDS, musicUrl } from "../../music/liminal-vein/song";
import { startWork } from "../../shared/work";
import { BLOOM, bloomPasses } from "./bloom.glsl";
import { songChannels, tunnelMotion } from "./rhythm";
import { display, scene } from "./scene.glsl";

startWork({
  passes: [
    { name: "scene", fragment: scene, accumulate: true, format: "rgba32f", filter: "nearest" },
    ...bloomPasses("scene"),
    { name: "display", fragment: display, inputs: ["scene", BLOOM], filter: "nearest" }
  ],
  sources: [songChannels, tunnelMotion],
  music: { url: musicUrl, seconds: LOOP_SECONDS }
});
