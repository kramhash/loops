// Tries a song on the works: builds the site, renders each work with
// `?song=<name>` at 540 × 960 and 4 samples, with the song muxed in, and
// opens the videos. See docs/song-workflow.md.
//
// Usage: pnpm song:preview <name> [work ...]   (all works by default)
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [name, ...picked] = process.argv.slice(2);
if (!name) {
  console.error("Usage: pnpm song:preview <name> [work ...]");
  process.exit(1);
}
const audio = join(root, "music", name, "music.wav");
if (!existsSync(join(root, "music", name, "song.json"))) {
  console.error(`music/${name}/song.json is missing; run pnpm song:import ${name} <export-dir> first`);
  process.exit(1);
}
const works = picked.length > 0
  ? picked
  : readdirSync(join(root, "works"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: "inherit" });

run("pnpm", ["exec", "vite", "build", "--logLevel", "warn"]);
const videos = [];
for (const work of works) {
  const out = join(root, "renders", "preview", name, work);
  rmSync(out, { recursive: true, force: true });
  console.log(`\n${work} with ${name}`);
  run("pnpm", [
    "exec", "frapx-render", "dist",
    "--path", `/works/${work}/?song=${name}`,
    "--out", out,
    "--resolution", "540x960",
    "--set", "spp=4",
    "--encode", "h264",
    "--audio", audio,
    "--strict-audio"
  ]);
  videos.push(join(out, `${work}.mp4`));
}
console.log(`\nPreviews:\n${videos.join("\n")}`);
if (process.platform === "darwin") execFileSync("open", videos);
