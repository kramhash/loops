# loops

Looping sound and picture by kramhash: short, seamless loops where the picture
follows its own song, drawn with [frapx](https://github.com/kramhash/frapx) and
sequenced with [vixeq](https://www.npmjs.com/package/@vixeq/core). Posted as
YouTube Shorts.

| Work | Song |
| --- | --- |
| [LIMINAL VEIN](works/liminal-vein/) | `music/liminal-vein` (128 BPM, 8 bars) |
| [SPINE](works/spine/) | `music/liminal-vein` |
| [NUCLEUS](works/nucleus/) | `music/liminal-vein` |
| [LIMINAL VEIN, the making](works/liminal-vein-making/) | `music/liminal-vein` |

## Making a song

Songs are made in FL Studio to a fixed shape (8 bars at 120, 128 or 144 BPM)
and brought in with `pnpm song:import`; `pnpm song:preview` tries one on
every work. See [docs/song-workflow.md](docs/song-workflow.md).

## How a work is made

- `music/<song>/` holds the song: `music.wav` (the master), `music.m4a` (what
  the browser plays), `analysis.json` (hats and bar loudness from
  `scripts/analyze-wav.py`) and `song.ts`, the song as a vixeq arrangement.
- `shared/song-uniforms.ts` turns the arrangement into frapx uniforms (pulses
  that decay since their step, held values) as a pure function of time, so any
  frame renders the same however it is reached.
- `shared/work.ts` sets up a work's page: the passes, the song as its clock
  (the **Sound** button), `?frame=N` to hold a frame, and the render target
  for `frapx-render`, vertical 1080 × 1920 at 60 fps by default.
- `works/<name>/` is one work: its shaders and how it moves with the song.

```sh
pnpm install
pnpm dev                       # http://127.0.0.1:5173/works/<name>/
python3 -I scripts/check-wav.py music/<song>/music.wav
python3 -I scripts/analyze-wav.py music/<song>/music.wav music/<song>/analysis.json
```

## Rendering

```sh
pnpm build
pnpm render --path /works/liminal-vein/ --out renders/liminal-vein \
  --encode h264 --audio music/liminal-vein/music.wav --strict-audio
```

`--set spp=N` changes the samples per frame (default 32), `--set shutter=F`
the motion blur, and `--resolution WxH` the size.

## License

The code is under the MIT License. The music is by kramhash under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): use it in your own
videos with credit. See `music/LICENSE`.
