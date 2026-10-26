// What every work set to this song shares: its tracks as uniforms, and the
// shape of the song in time (the beats, the drop and its kicks).
import { beatToMs } from "@vixeq/core";
import type { UniformSource } from "@frapx/fx-passes";
import { beatAt, songUniforms, wrap } from "../../shared/song-uniforms";
import { LOOP_SECONDS, song } from "./song";

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

const dropSection = song.sections.find((section) => section.id === "drop")!;
export const BEATS = song.durationBeats;
export const DROP_BEAT = dropSection.startBeat;
/** The drop's last bar eases back to calm, so the loop wraps without a jump. */
export const SETTLE_BEAT = dropSection.endBeat - 4;
export const secondsAt = (beat: number): number => beatToMs(song.timing, beat) / 1000;
export const BEAT_SECONDS = secondsAt(1);
const DROP_SECONDS = secondsAt(DROP_BEAT);
const SETTLE_SECONDS = secondsAt(SETTLE_BEAT);

export const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** The integral of smoothstep(edge0, edge1, x) from 0 to x, for 0 ≤ edge0. */
const smoothstepIntegral = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return (edge1 - edge0) * (t * t * t - (t * t * t * t) / 2) + Math.max(x - edge1, 0);
};

export const easeOutCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;

// The drop: rises through the last beat of the calm, settles over the last bar.
const RISE_START = DROP_SECONDS - BEAT_SECONDS;
/** 0 in the calm, 1 in the drop, eased between. */
export const dropAt = (t: number): number =>
  smoothstep(RISE_START, DROP_SECONDS, t) - smoothstep(SETTLE_SECONDS, LOOP_SECONDS, t);
/** The integral of dropAt from 0 to t, for speeds that rise with the drop. */
export const dropIntegral = (t: number): number =>
  smoothstepIntegral(RISE_START, DROP_SECONDS, t) - smoothstepIntegral(SETTLE_SECONDS, LOOP_SECONDS, t);

/** Kicks of the drop that act (lunge, turn, split): all but the last bar's. */
export const isActionBeat = (beat: number): boolean => beat >= DROP_BEAT && beat < SETTLE_BEAT;
export const ACTION_BEATS = SETTLE_BEAT - DROP_BEAT;
/** Action kicks fired up to `beat`, not counting `beat` itself. */
export const actionsBefore = (beat: number): number => Math.min(Math.max(beat - DROP_BEAT, 0), ACTION_BEATS);

/** Where `time` is in the song: wrapped seconds, the beat, and seconds since it. */
export const songTime = (time: number): { t: number; beat: number; sinceBeat: number } => {
  const t = wrap(time, LOOP_SECONDS);
  const beat = Math.min(Math.floor(beatAt(song, t)), BEATS - 1);
  return { t, beat, sinceBeat: t - secondsAt(beat) };
};
