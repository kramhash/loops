// Bridge from a vixeq arrangement to frapx uniforms, as a pure function of
// time. Ported from frapx-vixeq-lab until vixeq ships its own pure queries
// (vixeq#5): every helper here that walks steps by hand stands in for one.
import {
  beatToMs,
  msToBeat,
  resolveArrangementStep,
  sampleArrangement,
  type ArrangementProject,
  type EasingFunction
} from "@vixeq/core";
import type { UniformSource } from "@frapx/fx-passes";

/**
 * How one track becomes one uniform.
 * - `value`: vixeq's interpolation from the step's value to the next one
 * - `hold`: the step's value, held for the whole step
 * - `pulse`: the last non-zero step's value, decaying exponentially since it fired
 */
export type Channel =
  | { track: string; mode: "value"; easing?: EasingFunction }
  | { track: string; mode: "hold" }
  | { track: string; mode: "pulse"; decay: number };

/** Uniform name (without `u_`) -> channel. Tracks are matched by id. */
export type ChannelMap = Record<string, Channel>;

// vixeq ships no hold easing; one that never leaves 0 keeps the step's value.
const holdEasing: EasingFunction = () => 0;

export const wrap = (x: number, length: number): number => ((x % length) + length) % length;

/** Seconds in one pass of the arrangement. */
export const songSeconds = (song: ArrangementProject): number =>
  beatToMs(song.timing, song.durationBeats) / 1000;

/** The beat at `time`, wrapped into the song. */
export const beatAt = (song: ArrangementProject, time: number): number =>
  msToBeat(song.timing, wrap(time, songSeconds(song)) * 1000);

/**
 * The last non-zero step of `trackId` at or before `beat`, and the seconds
 * since it, walking back through sections, gaps and the loop point.
 */
export const lastTrigger = (
  song: ArrangementProject,
  beat: number,
  trackId: string,
  maxSteps = 512
): { value: number; elapsed: number } | null => {
  const { durationBeats, timing } = song;
  const nowMs = beatToMs(timing, beat);
  let cursor = beat;
  let wrappedMs = 0;
  for (let i = 0; i < maxSteps; i++) {
    const resolved = resolveArrangementStep(song, cursor);
    if (resolved) {
      const pattern = song.patterns[resolved.section.patternId];
      const stepBeats = 1 / (pattern?.stepsPerBeat ?? 4);
      const stepStart = cursor - resolved.phase * stepBeats;
      const track = pattern?.tracks.find((candidate) => candidate.id === trackId);
      const value = track?.enabled ? (track.steps[resolved.stepIndex] ?? 0) : 0;
      if (value > 0) {
        return { value, elapsed: (nowMs + wrappedMs - beatToMs(timing, stepStart)) / 1000 };
      }
      cursor = stepStart - 1e-6;
    } else {
      // A gap: step back a sixteenth until a section is found.
      cursor -= 0.25;
    }
    if (cursor < 0) {
      cursor += durationBeats;
      wrappedMs += beatToMs(timing, durationBeats);
    }
  }
  return null;
};

/** The arrangement as uniforms, looping, a pure function of time. */
export const songUniforms = (song: ArrangementProject, channels: ChannelMap): UniformSource => ({
  get(time) {
    const beat = beatAt(song, time);
    const out: Record<string, number> = {};
    for (const [uniform, channel] of Object.entries(channels)) {
      if (channel.mode === "pulse") {
        const hit = lastTrigger(song, beat, channel.track);
        out[uniform] = hit ? hit.value * Math.exp(-channel.decay * hit.elapsed) : 0;
        continue;
      }
      const easing = channel.mode === "hold" ? holdEasing : channel.easing;
      out[uniform] = sampleArrangement(song, beat, easing, [channel.track])[channel.track] ?? 0;
    }
    return out;
  }
});
