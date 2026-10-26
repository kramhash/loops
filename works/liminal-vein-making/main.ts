import { finishPasses } from "../../shared/finish";
import { selectSong } from "../../shared/songs";
import { startWork } from "../../shared/work";
import { tunnelMotion } from "../liminal-vein/rhythm";
import { scene } from "../liminal-vein/scene.glsl";
import { CAPTIONS, PANEL_HEIGHT, PANEL_WIDTH, drawCaptions } from "./captions";
import { makingStages } from "./stages";

// LIMINAL VEIN, built up stage by stage through the calm (shape, normals,
// light, bloom), then finished through the drop, with the code under each.
const song = selectSong("liminal-vein");

startWork({
  passes: [
    { name: "scene", fragment: scene(song.shape.seconds), accumulate: true, format: "rgba32f", filter: "nearest" },
    ...finishPasses({
      loopSeconds: song.shape.seconds,
      caption: { texture: "captions", panels: CAPTIONS.length, aspect: PANEL_WIDTH / PANEL_HEIGHT }
    })
  ],
  sources: [...song.channels, tunnelMotion(song.shape), makingStages(song.shape)],
  textures: { captions: { source: drawCaptions(), filter: "linear" } },
  music: { url: song.musicUrl, seconds: song.shape.seconds }
});
