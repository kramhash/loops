import type { UniformSource } from "@frapx/fx-passes";
import { easeOutCubic, type SongShape } from "../../shared/song-shape";
import { beatAt, lastTrigger } from "../../shared/song-uniforms";

/** Climbing and orbiting speed in the drop, relative to the calm's. */
const DROP_SPEED = 1.8;
/** Seconds a kick takes to turn the layers a step (must match scene.glsl.ts). */
export const TURN_SECONDS = 0.18;

/**
 * The column's way through a song. Each bar of the drop moves it its own
 * way, a twelfth of a circle per action kick:
 * - bar 5 (`turnsA`): alternate layers turn opposite ways
 * - bar 6 (`waveDone`, `waveSince`): all turn one way, in a wave climbing the
 *   column (the shader delays each layer by its height)
 * - bar 7 (`turnsC`, `spread`): every third layer turns back, and the layers
 *   spring apart on each kick
 * Every layer has turned a multiple of a sixth of a circle by the last bar, so
 * the hexagons wrap to where they began. `climb` is how far the camera has
 * risen and orbited through the loop (0–1), `hatLayer` the 16th of the last hat.
 */
export const spineMotion = (shape: SongShape): UniformSource => {
  const { song, seconds, beatSeconds, dropBeat, dropAt, dropIntegral, isActionBeat, actionsBefore, songTime } = shape;
  const loopCruise = seconds + (DROP_SPEED - 1) * dropIntegral(seconds);
  const barOf = (beat: number): number => Math.floor((beat - dropBeat) / 4);
  /** Eased action kicks of drop bar `group` (0–2), 0–4. */
  const groupTurns = (group: number, beat: number, sinceBeat: number): number => {
    const done = Math.min(Math.max(actionsBefore(beat) - 4 * group, 0), 4);
    return done + (isActionBeat(beat) && barOf(beat) === group ? easeOutCubic(sinceBeat / TURN_SECONDS) : 0);
  };
  return {
    get(time) {
      const { t, beat, sinceBeat } = songTime(time);
      const hat = lastTrigger(song, beatAt(song, t), "hat");
      const inWave = isActionBeat(beat) && barOf(beat) === 1;
      const inSpread = isActionBeat(beat) && barOf(beat) === 2;
      return {
        drop: dropAt(t),
        climb: (t + (DROP_SPEED - 1) * dropIntegral(t)) / loopCruise,
        turnsA: groupTurns(0, beat, sinceBeat),
        waveDone: Math.min(Math.max(actionsBefore(beat) - 4, 0), 4),
        waveSince: inWave ? sinceBeat : -1,
        turnsC: groupTurns(2, beat, sinceBeat),
        spread: inSpread ? Math.sin(Math.PI * (1 - (1 - sinceBeat / beatSeconds) ** 3)) ** 2 : 0,
        hatLayer: hat ? Math.round((t - hat.elapsed) / (beatSeconds / 4)) : 0
      };
    }
  };
};
