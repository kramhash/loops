import type { UniformSource } from "@frapx/fx-passes";
import { songTime } from "../../music/liminal-vein/rhythm";

/**
 * Which stage of the frame the making-of shows, switching on each bar's
 * downbeat through the calm, then the finished frame through the drop:
 * - `stage` for the scene pass: 1 the shape, 2 its normals, 3 the light,
 *   0 the finished frame (see works/liminal-vein/scene.glsl.ts)
 * - `bloomGain`: the bloom, from the fourth bar on
 * - `caption`: which caption panel (0–4) shows
 */
export const makingStages: UniformSource = {
  get(time) {
    const bar = Math.floor(songTime(time).beat / 4);
    return {
      stage: bar < 3 ? bar + 1 : 0,
      bloomGain: bar < 3 ? 0 : 1,
      caption: Math.min(bar, 4)
    };
  }
};
