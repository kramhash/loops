import { songChannels } from "../../music/liminal-vein/rhythm";
import { LOOP_SECONDS, musicUrl } from "../../music/liminal-vein/song";
import { finishPasses } from "../../shared/finish";
import { startWork } from "../../shared/work";
import { tunnelMotion } from "../liminal-vein/rhythm";
import { scene } from "../liminal-vein/scene.glsl";
import { CAPTIONS, PANEL_HEIGHT, PANEL_WIDTH, drawCaptions } from "./captions";
import { makingStages } from "./stages";

// LIMINAL VEIN, built up stage by stage through the calm (shape, normals,
// light, bloom), then finished through the drop, with the code under each.
startWork({
  passes: [
    { name: "scene", fragment: scene, accumulate: true, format: "rgba32f", filter: "nearest" },
    ...finishPasses({
      loopSeconds: LOOP_SECONDS,
      caption: { texture: "captions", panels: CAPTIONS.length, aspect: PANEL_WIDTH / PANEL_HEIGHT }
    })
  ],
  sources: [songChannels, tunnelMotion, makingStages],
  textures: { captions: { source: drawCaptions(), filter: "linear" } },
  music: { url: musicUrl, seconds: LOOP_SECONDS }
});
