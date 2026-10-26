import type { UniformSource } from "@frapx/fx-passes";
import { easeOutCubic, type SongShape } from "../../shared/song-shape";
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

/**
 * The tunnel's way through a song: `drop`, `travel` (how far the camera has
 * come through the loop, 0–1: cruising at the calm's speed, faster through
 * the drop, thrown forward by each action kick, exactly one loop's distance),
 * `shape` (the cross-section, 0 a circle, 1 a hexagon, 2 a star, 3 the circle
 * again: each action kick turns it into the next, and twelve come round) and
 * `kickRoll` (an action kick's swing, up fast and back to 0 by the next beat).
 */
export const tunnelMotion = (shape: SongShape): UniformSource => {
  const { seconds, beatSeconds, actionBeats, dropAt, dropIntegral, isActionBeat, actionsBefore, songTime } = shape;
  const lunge = LUNGE_BEATS * DROP_SPEED * beatSeconds;
  const lungeSpan = 1 - Math.exp(-LUNGE_RATE * beatSeconds);
  const loopTravel = seconds + (DROP_SPEED - 1) * dropIntegral(seconds) + actionBeats * lunge;
  return {
    get(time) {
      const { t, beat, sinceBeat } = songTime(time);
      const action = isActionBeat(beat);
      const cruise = t + (DROP_SPEED - 1) * dropIntegral(t);
      const thrown = action ? (1 - Math.exp(-LUNGE_RATE * sinceBeat)) / lungeSpan : 0;
      const turning = action ? easeOutCubic(sinceBeat / MORPH_SECONDS) : 0;
      const swing = action
        ? (beat % 2 === 0 ? 1 : -1) * Math.sin(Math.PI * (1 - (1 - sinceBeat / beatSeconds) ** 2))
        : 0;
      return {
        drop: dropAt(t),
        travel: (cruise + (actionsBefore(beat) + thrown) * lunge) / loopTravel,
        shape: wrap(actionsBefore(beat) + turning, 3),
        kickRoll: KICK_ROLL * swing
      };
    }
  };
};
