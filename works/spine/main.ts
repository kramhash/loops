import { songChannels } from "../../music/liminal-vein/rhythm";
import { LOOP_SECONDS, musicUrl } from "../../music/liminal-vein/song";
import { finishPasses } from "../../shared/finish";
import { startWork } from "../../shared/work";
import { spineMotion } from "./rhythm";
import { scene } from "./scene.glsl";

startWork({
  passes: [
    { name: "scene", fragment: scene, accumulate: true, format: "rgba32f", filter: "nearest" },
    ...finishPasses({ loopSeconds: LOOP_SECONDS })
  ],
  sources: [songChannels, spineMotion],
  music: { url: musicUrl, seconds: LOOP_SECONDS }
});
