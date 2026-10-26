// Every song in music/, by name. A work plays its own song unless the page's
// `?song=<name>` picks another, which is how `pnpm song:preview` tries a new
// song on an existing work.
import type { UniformSource } from "@frapx/fx-passes";
import { songChannels as liminalVeinChannels } from "../music/liminal-vein/rhythm";
import { musicUrl as liminalVeinMusic, song as liminalVeinSong } from "../music/liminal-vein/song";
import { arrangementFromJson, bandUniforms, drumUniforms, type SongJson } from "./song-json";
import { createSongShape, type SongShape } from "./song-shape";

export type Song = {
  name: string;
  shape: SongShape;
  /** The song the browser plays. */
  musicUrl: string;
  /** Its tracks as uniforms (see song-json.ts for the names). */
  channels: UniformSource[];
};

const jsons = import.meta.glob<SongJson>("../music/*/song.json", { eager: true, import: "default" });
const musics = import.meta.glob<string>("../music/*/music.m4a", { eager: true, query: "?url", import: "default" });

const nameOf = (path: string): string => path.split("/").at(-2) ?? path;

const songs = new Map<string, () => Song>([
  // The first song, written by hand before song.json existed.
  [
    "liminal-vein",
    () => ({
      name: "liminal-vein",
      shape: createSongShape(liminalVeinSong),
      musicUrl: liminalVeinMusic,
      channels: [liminalVeinChannels]
    })
  ]
]);

for (const [path, json] of Object.entries(jsons)) {
  const name = nameOf(path);
  const musicUrl = Object.entries(musics).find(([musicPath]) => nameOf(musicPath) === name)?.[1];
  if (!musicUrl) throw new Error(`music/${name} has song.json but no music.m4a`);
  songs.set(name, () => {
    const arrangement = arrangementFromJson(json);
    const shape = createSongShape(arrangement);
    return { name, shape, musicUrl, channels: [drumUniforms(arrangement), bandUniforms(json, shape.seconds)] };
  });
}

/** The song `?song=<name>` names, or `fallback`. */
export const selectSong = (fallback: string): Song => {
  const name = new URLSearchParams(window.location.search).get("song") ?? fallback;
  const load = songs.get(name);
  if (!load) throw new Error(`No song "${name}" in music/ (have: ${[...songs.keys()].join(", ")})`);
  return load();
};
