# Making a song for loops

Every song is **8 bars**: bars 1–4 the calm, bars 5–8 the drop. The works
are built on that shape: the drop's first three bars each move the picture
their own way, its last bar settles back so the loop wraps, and a making-of
shows one stage per bar.

**Tempo: 120, 128 or 144 BPM.** At 60 fps the loop has to be a whole number
of frames for its end to meet its start exactly, and 8 bars is 115200 ÷ BPM
frames: 960 (16 s), 900 (15 s) or 800 (13.3 s). Other tempos land between
frames.

## The FL Studio template (once per tempo)

- 8 bars in the Playlist with loop markers around them; patterns `calm` and
  `drop`.
- **Mixer inserts 1–3 are KICK, SNARE and HAT**, and nothing else goes to
  them. Every other sound goes to insert 4 or later. Those three stems are
  how the picture knows when a drum hits; a song without one of them leaves
  it silent.
- Master: Fruity Limiter last, ceiling −1 dB, aiming at about −14 LUFS
  (what YouTube plays at).
- Project general settings: *Store data relative to the project file* and
  *Copy used samples to the project folder* on, so the project folder
  holds everything.
- Keep projects outside this repository, in
  `~/works/music/loops/<song>/`. Only the master, its m4a and the analysis
  come here: stems and samples may not be ours to share.

Export (`Ctrl+R`):

| Setting | Value | Why |
| --- | --- | --- |
| Format | WAV, 48 kHz, 24-bit | video audio is 48 kHz |
| Mode | Song | |
| Tail | **Wrap remainder** | reverb and delay tails wrap to the start, so the loop is seamless |
| Split mixer tracks | **on** | writes the master and the KICK / SNARE / HAT stems in one go |
| Trim PDC silence | **on** | without it plugin delay compensation shifted earlier exports ~29 ms off the grid |

## Three sittings, about an hour each

1. **Sketch** — the drop's 4 bars: drums on inserts 1–3, a bass, one
   hook.
2. **Build** — the calm, by taking things out of the drop; lay out the 8
   bars and export a rough mix:
   ```sh
   pnpm song:import <song> ~/works/music/loops/<song>/export
   pnpm song:preview <song>
   ```
   `song:preview` renders every work with the new song at 540 × 960, with
   the sound, and opens the videos.
3. **Finish** — fix what the preview showed, mix, export the final, run
   `song:import` again and commit `music/<song>/`.

## What `song:import` does

`pnpm song:import <song> <export-dir>` finds the master and the
KICK / SNARE / HAT stems by name (or take `--master`, `--kick`, `--snare`,
`--hat`), then:

- **checks** the master and stops on a failure (`--force` writes anyway):
  48 kHz; exactly 8 bars at 120, 128 or 144 BPM; true peak at most −1 dBTP;
  the beat grid within 2 ms of sample 0. Loudness away from −14 LUFS only
  warns.
- **reads the drums**: on each 16th, whether the stem rises into a hit,
  and how hard (0.2–1).
- **measures four bands** of the master (under 150 Hz, 150–600 Hz,
  600 Hz–4 kHz, over 4 kHz) for every frame at 60 fps, rising fast and
  falling over ~120 ms, around the loop.
- writes `music/<song>/`: `music.wav`, `music.m4a` (what the browser plays),
  `song.json` and `song.svg`, a picture of the hits and bands to check by eye.

## In the works

`shared/songs.ts` loads every `music/*/song.json` as a vixeq arrangement
(`calm` and `drop` sections) and gives a work its uniforms:

| Uniform | From | |
| --- | --- | --- |
| `flash`, `pulse` | kick | the hit (gone in ~80 ms) and its afterglow |
| `snare`, `hat` | snare, hat | decaying since the hit |
| `energy` | master | the bar's loudness, 0.2–1 |
| `bandLow`, `bandLowMid`, `bandHighMid`, `bandHigh` | master | 0–1 per band, between frames |

A work plays its own song; `?song=<name>` on its page plays another.
