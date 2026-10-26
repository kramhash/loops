import type { UniformSource } from "@frapx/fx-passes";
import { LOOP_SECONDS } from "../../music/liminal-vein/song";
import {
  BEAT_SECONDS,
  DROP_BEAT,
  actionsBefore,
  dropAt,
  dropIntegral,
  easeOutCubic,
  isActionBeat,
  songTime
} from "../../music/liminal-vein/rhythm";

/** Orbiting speed in the drop, relative to the calm's. */
const DROP_SPEED = 1.6;
const LOOP_CRUISE = LOOP_SECONDS + (DROP_SPEED - 1) * dropIntegral(LOOP_SECONDS);

/**
 * How far apart a kick of the drop throws the lobes, 0–1: out fast on the
 * kick, merged again by the next beat.
 */
const splitAt = (beat: number, sinceBeat: number): number => {
  if (!isActionBeat(beat)) return 0;
  const x = sinceBeat / BEAT_SECONDS;
  return Math.sin(Math.PI * (1 - (1 - x) ** 3)) ** 2;
};

/**
 * The mass's way through the song: `drop`, `orbit` (how far the camera has
 * circled it through the loop, 0–1), `split` (how far this kick throws it
 * apart), `splitAxis` (one more for every kick, so each goes its own way),
 * and `form`, which each bar of the drop splits it into: 0 four lobes thrown
 * out (bar 5), 1 a flat ring that spins a quarter turn (`spin`, bar 6), 2 a
 * stretch into two halves (bar 7). Every form is back together by the next
 * beat, so switching between them never jumps.
 */
export const nucleusMotion: UniformSource = {
  get(time) {
    const { t, beat, sinceBeat } = songTime(time);
    const action = isActionBeat(beat);
    return {
      drop: dropAt(t),
      orbit: (t + (DROP_SPEED - 1) * dropIntegral(t)) / LOOP_CRUISE,
      split: splitAt(beat, sinceBeat),
      splitAxis: actionsBefore(beat),
      form: action ? Math.floor((beat - DROP_BEAT) / 4) : 0,
      spin: action ? easeOutCubic(sinceBeat / (0.6 * BEAT_SECONDS)) : 0
    };
  }
};
