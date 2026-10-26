import type { UniformSource } from "@frapx/fx-passes";
import { LOOP_SECONDS, song } from "../../music/liminal-vein/song";
import {
  BEAT_SECONDS,
  actionsBefore,
  dropAt,
  dropIntegral,
  easeOutCubic,
  isActionBeat,
  songTime
} from "../../music/liminal-vein/rhythm";
import { beatAt, lastTrigger, wrap } from "../../shared/song-uniforms";

/** Climbing and orbiting speed in the drop, relative to the calm's. */
const DROP_SPEED = 1.8;
/** Seconds a kick takes to turn the layers a step. */
const TURN_SECONDS = 0.18;
const STEP_SECONDS = BEAT_SECONDS / 4;
const LOOP_CRUISE = LOOP_SECONDS + (DROP_SPEED - 1) * dropIntegral(LOOP_SECONDS);

/**
 * The column's way through the song:
 * - `climb`: how far the camera has risen and orbited through the loop, 0–1
 * - `turns`: kicks of the drop so far, eased, 0–12; each turns the layers a
 *   twelfth of a circle, alternate layers the other way, so twelve come round
 * - `hatLayer`: which 16th the last hat fell on, to pick the layer it lights
 */
export const spineMotion: UniformSource = {
  get(time) {
    const { t, beat, sinceBeat } = songTime(time);
    const turning = isActionBeat(beat) ? easeOutCubic(sinceBeat / TURN_SECONDS) : 0;
    const hat = lastTrigger(song, beatAt(song, t), "hat");
    const hatStep = hat ? Math.round((t - hat.elapsed) / STEP_SECONDS) : 0;
    return {
      drop: dropAt(t),
      climb: (t + (DROP_SPEED - 1) * dropIntegral(t)) / LOOP_CRUISE,
      // Wrapped, so the twelfth turn lands on 0 exactly and the loop wraps clean.
      turns: wrap(actionsBefore(beat) + turning, 12),
      hatLayer: hatStep
    };
  }
};
