import { beatToMs } from "@vixeq/core";
import type { UniformSource } from "@frapx/fx-passes";
import { LOOP_SECONDS, song } from "../../music/liminal-vein/song";
import { beatAt, songUniforms, wrap } from "../../shared/song-uniforms";

/**
 * The song's own tracks: `flash` (the kick, gone in ~80 ms), `pulse` (its
 * afterglow, gone by the middle of the beat), `hat`, and `energy`, the bar's
 * loudness.
 */
export const songChannels: UniformSource = songUniforms(song, {
  flash: { track: "kick", mode: "pulse", decay: 35 },
  pulse: { track: "kick", mode: "pulse", decay: 9 },
  hat: { track: "hat", mode: "pulse", decay: 30 },
  energy: { track: "energy", mode: "hold" }
});

const dropSection = song.sections.find((section) => section.id === "drop")!;
const BEATS = song.durationBeats;
const DROP_BEAT = dropSection.startBeat;
/** The drop's last bar eases back to calm, so the loop wraps without a jump. */
const SETTLE_BEAT = dropSection.endBeat - 4;
const secondsAt = (beat: number): number => beatToMs(song.timing, beat) / 1000;
const BEAT_SECONDS = secondsAt(1);
const DROP_SECONDS = secondsAt(DROP_BEAT);
const SETTLE_SECONDS = secondsAt(SETTLE_BEAT);

/** Cruising speed in the drop, relative to the calm's. */
const DROP_SPEED = 2.2;
/** How far each kick of the drop throws the camera forward, in beats of drop cruising. */
const LUNGE_BEATS = 0.5;
/** How fast a lunge settles, per second. */
const LUNGE_RATE = 10;
/** Seconds a kick takes to turn the cross-section into the next shape. */
const MORPH_SECONDS = 0.16;
/** Roll of a kick's swing, in radians. */
const KICK_ROLL = 0.07;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** The integral of smoothstep(edge0, edge1, x) from 0 to x, for 0 ≤ edge0. */
const smoothstepIntegral = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return (edge1 - edge0) * (t * t * t - (t * t * t * t) / 2) + Math.max(x - edge1, 0);
};

// The drop: rises through the last beat of the calm, settles over the last bar.
const RISE_START = DROP_SECONDS - BEAT_SECONDS;
const dropAt = (t: number): number =>
  smoothstep(RISE_START, DROP_SECONDS, t) - smoothstep(SETTLE_SECONDS, LOOP_SECONDS, t);
const dropIntegral = (t: number): number =>
  smoothstepIntegral(RISE_START, DROP_SECONDS, t) - smoothstepIntegral(SETTLE_SECONDS, LOOP_SECONDS, t);

// Kicks of the drop that lunge and turn the cross-section: all but the last bar's.
const isActionBeat = (beat: number): boolean => beat >= DROP_BEAT && beat < SETTLE_BEAT;
const ACTION_BEATS = SETTLE_BEAT - DROP_BEAT;
const LUNGE = LUNGE_BEATS * DROP_SPEED * BEAT_SECONDS;
const LUNGE_SPAN = 1 - Math.exp(-LUNGE_RATE * BEAT_SECONDS);
const LOOP_TRAVEL = LOOP_SECONDS + (DROP_SPEED - 1) * dropIntegral(LOOP_SECONDS) + ACTION_BEATS * LUNGE;

/**
 * How far the camera has come through the loop, 0–1: cruising at the calm's
 * speed, faster through the drop, and thrown forward by each of its kicks.
 * Exactly one loop's distance, so the end meets the start.
 */
const travelAt = (t: number, beat: number, sinceBeat: number): number => {
  const cruise = t + (DROP_SPEED - 1) * dropIntegral(t);
  const lunges = Math.min(Math.max(beat - DROP_BEAT, 0), ACTION_BEATS);
  const lunge = isActionBeat(beat) ? (1 - Math.exp(-LUNGE_RATE * sinceBeat)) / LUNGE_SPAN : 0;
  return (cruise + (lunges + lunge) * LUNGE) / LOOP_TRAVEL;
};

const easeOutCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;

/**
 * Which cross-section the tunnel has, 0–3: 0 a circle, 1 a hexagon, 2 a star,
 * then back to the circle at 3. Each kick of the drop turns it into the next;
 * twelve kicks come round to the circle before the last bar.
 */
const shapeAt = (beat: number, sinceBeat: number): number => {
  const turned = Math.min(Math.max(beat - DROP_BEAT, 0), ACTION_BEATS);
  const turning = isActionBeat(beat) ? easeOutCubic(sinceBeat / MORPH_SECONDS) : 0;
  return wrap(turned + turning, 3);
};

/** A kick's swing: up fast, back down to 0 by the next beat. */
const swing = (beat: number, sinceBeat: number): number => {
  if (!isActionBeat(beat)) return 0;
  const x = sinceBeat / BEAT_SECONDS;
  const direction = beat % 2 === 0 ? 1 : -1;
  return direction * Math.sin(Math.PI * (1 - (1 - x) ** 2));
};

/**
 * The tunnel's way through the song, worked out from its beats: `drop` (0 in
 * the calm, 1 in the drop), `travel`, `shape` and `kickRoll`.
 */
export const tunnelMotion: UniformSource = {
  get(time) {
    const t = wrap(time, LOOP_SECONDS);
    const beat = Math.min(Math.floor(beatAt(song, t)), BEATS - 1);
    const sinceBeat = t - secondsAt(beat);
    return {
      drop: dropAt(t),
      travel: travelAt(t, beat, sinceBeat),
      shape: shapeAt(beat, sinceBeat),
      kickRoll: KICK_ROLL * swing(beat, sinceBeat)
    };
  }
};
