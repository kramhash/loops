import type { UniformSource } from "@frapx/fx-passes";
import { LOOP_SECONDS } from "../../music/liminal-vein/song";
import {
  ACTION_BEATS,
  BEAT_SECONDS,
  actionsBefore,
  dropAt,
  dropIntegral,
  easeOutCubic,
  isActionBeat,
  songTime
} from "../../music/liminal-vein/rhythm";
import { wrap } from "../../shared/song-uniforms";

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
  const lunge = isActionBeat(beat) ? (1 - Math.exp(-LUNGE_RATE * sinceBeat)) / LUNGE_SPAN : 0;
  return (cruise + (actionsBefore(beat) + lunge) * LUNGE) / LOOP_TRAVEL;
};

/**
 * Which cross-section the tunnel has, 0–3: 0 a circle, 1 a hexagon, 2 a star,
 * then back to the circle at 3. Each kick of the drop turns it into the next;
 * twelve kicks come round to the circle before the last bar.
 */
const shapeAt = (beat: number, sinceBeat: number): number => {
  const turning = isActionBeat(beat) ? easeOutCubic(sinceBeat / MORPH_SECONDS) : 0;
  return wrap(actionsBefore(beat) + turning, 3);
};

/** A kick's swing: up fast, back down to 0 by the next beat. */
const swing = (beat: number, sinceBeat: number): number => {
  if (!isActionBeat(beat)) return 0;
  const x = sinceBeat / BEAT_SECONDS;
  const direction = beat % 2 === 0 ? 1 : -1;
  return direction * Math.sin(Math.PI * (1 - (1 - x) ** 2));
};

/** The tunnel's way through the song: `drop`, `travel`, `shape` and `kickRoll`. */
export const tunnelMotion: UniformSource = {
  get(time) {
    const { t, beat, sinceBeat } = songTime(time);
    return {
      drop: dropAt(t),
      travel: travelAt(t, beat, sinceBeat),
      shape: shapeAt(beat, sinceBeat),
      kickRoll: KICK_ROLL * swing(beat, sinceBeat)
    };
  }
};
