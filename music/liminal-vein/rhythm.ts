// LIMINAL VEIN's tracks as uniforms. Its shape in time (beats, drop, action
// kicks) is shared/song-shape.ts, like every other song's.
import type { UniformSource } from "@frapx/fx-passes";
import { songUniforms } from "../../shared/song-uniforms";
import { song } from "./song";

/**
 * `flash` (the kick, gone in ~80 ms), `pulse` (its afterglow, gone by the
 * middle of the beat), `hat`, and `energy`, the bar's loudness.
 */
export const songChannels: UniformSource = songUniforms(song, {
  flash: { track: "kick", mode: "pulse", decay: 35 },
  pulse: { track: "kick", mode: "pulse", decay: 9 },
  hat: { track: "hat", mode: "pulse", decay: 30 },
  energy: { track: "energy", mode: "hold" }
});
