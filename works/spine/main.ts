import { finishPasses } from "../../shared/finish";
import { selectSong } from "../../shared/songs";
import { startWork } from "../../shared/work";
import { spineMotion } from "./rhythm";
import { scene } from "./scene.glsl";

// Plays its own song unless `?song=<name>` picks another (pnpm song:preview).
const song = selectSong("liminal-vein");

startWork({
  passes: [
    { name: "scene", fragment: scene(song.shape.seconds), accumulate: true, format: "rgba32f", filter: "nearest" },
    ...finishPasses({ loopSeconds: song.shape.seconds })
  ],
  sources: [...song.channels, spineMotion(song.shape)],
  music: { url: song.musicUrl, seconds: song.shape.seconds }
});
