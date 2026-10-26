import type { UniformSource } from "@frapx/fx-passes";
import { LOOP_SECONDS, song } from "../../music/liminal-vein/song";
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
import { beatAt, lastTrigger } from "../../shared/song-uniforms";

/** Climbing and orbiting speed in the drop, relative to the calm's. */
const DROP_SPEED = 1.8;
/** Seconds a kick takes to turn the layers a step (must match scene.glsl.ts). */
export const TURN_SECONDS = 0.18;
const STEP_SECONDS = BEAT_SECONDS / 4;
const LOOP_CRUISE = LOOP_SECONDS + (DROP_SPEED - 1) * dropIntegral(LOOP_SECONDS);

/** Eased kicks of bar `group` (0–2) of the drop, 0–4. */
const groupTurns = (group: number, beat: number, sinceBeat: number): number => {
  const done = Math.min(Math.max(actionsBefore(beat) - 4 * group, 0), 4);
  const inGroup = isActionBeat(beat) && Math.floor((beat - DROP_BEAT) / 4) === group;
  return done + (inGroup ? easeOutCubic(sinceBeat / TURN_SECONDS) : 0);
};

/**
 * The column's way through the song. Each bar of the drop moves it its own
 * way, a twelfth of a circle per kick:
 * - bar 5 (`turnsA`): alternate layers turn opposite ways
 * - bar 6 (`waveDone`, `waveSince`): all turn one way, in a wave climbing the
 *   column (the shader delays each layer by its height)
 * - bar 7 (`turnsC`, `spread`): every third layer turns back, and the layers
 *   spring apart on each kick
 * Every layer has turned a multiple of a sixth of a circle by the last bar, so
 * the hexagons wrap to where they began. `climb` is how far the camera has
 * risen and orbited through the loop (0–1), `hatLayer` the 16th of the last hat.
 */
export const spineMotion: UniformSource = {
  get(time) {
    const { t, beat, sinceBeat } = songTime(time);
    const inWave = isActionBeat(beat) && Math.floor((beat - DROP_BEAT) / 4) === 1;
    const inSpread = isActionBeat(beat) && Math.floor((beat - DROP_BEAT) / 4) === 2;
    const hat = lastTrigger(song, beatAt(song, t), "hat");
    const hatStep = hat ? Math.round((t - hat.elapsed) / STEP_SECONDS) : 0;
    return {
      drop: dropAt(t),
      climb: (t + (DROP_SPEED - 1) * dropIntegral(t)) / LOOP_CRUISE,
      turnsA: groupTurns(0, beat, sinceBeat),
      waveDone: Math.min(Math.max(actionsBefore(beat) - 4, 0), 4),
      waveSince: inWave ? sinceBeat : -1,
      turnsC: groupTurns(2, beat, sinceBeat),
      spread: inSpread ? Math.sin(Math.PI * (1 - (1 - sinceBeat / BEAT_SECONDS) ** 3)) ** 2 : 0,
      hatLayer: hatStep
    };
  }
};
