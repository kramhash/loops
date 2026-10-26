import type { UniformSource } from "@frapx/fx-passes";
import { easeOutCubic, type SongShape } from "../../shared/song-shape";

/** Orbiting speed in the drop, relative to the calm's. */
const DROP_SPEED = 1.6;

/**
 * The mass's way through a song: `drop`, `orbit` (how far the camera has
 * circled it through the loop, 0–1), `split` (how far this action kick throws
 * it apart: out fast, merged again by the next beat), `splitAxis` (one more
 * for every kick, so each goes its own way), and `form`, which each bar of the
 * drop splits it into: 0 four lobes thrown out (bar 5), 1 a flat ring that
 * spins a quarter turn (`spin`, bar 6), 2 a stretch into two halves (bar 7).
 * Every form is back together by the next beat, so switching between them
 * never jumps.
 */
export const nucleusMotion = (shape: SongShape): UniformSource => {
  const { seconds, beatSeconds, dropBeat, dropAt, dropIntegral, isActionBeat, actionsBefore, songTime } = shape;
  const loopCruise = seconds + (DROP_SPEED - 1) * dropIntegral(seconds);
  return {
    get(time) {
      const { t, beat, sinceBeat } = songTime(time);
      const action = isActionBeat(beat);
      const x = sinceBeat / beatSeconds;
      return {
        drop: dropAt(t),
        orbit: (t + (DROP_SPEED - 1) * dropIntegral(t)) / loopCruise,
        split: action ? Math.sin(Math.PI * (1 - (1 - x) ** 3)) ** 2 : 0,
        splitAxis: actionsBefore(beat),
        form: action ? Math.floor((beat - dropBeat) / 4) : 0,
        spin: action ? easeOutCubic(sinceBeat / (0.6 * beatSeconds)) : 0
      };
    }
  };
};
