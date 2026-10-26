// A song made the loops way (see docs/song-workflow.md): song.json, written by
// scripts/import-song.py from FL Studio's master and drum stems, becomes a
// vixeq arrangement and frapx uniforms.
import { createArrangement, createProject, type ArrangementProject, type SequenceProject } from "@vixeq/core";
import type { UniformSource } from "@frapx/fx-passes";
import { songUniforms, wrap } from "./song-uniforms";

export type SongJson = {
  bpm: number;
  bars: number;
  /** Frames per second of `bands`. */
  fps: number;
  /** Per 16th, 0–1: how hard each drum stem hit there (0 for no hit). */
  tracks: { kick: number[]; snare: number[]; hat: number[] };
  /** Per bar, 0.2–1: the master's loudness. */
  energy: number[];
  /** Per frame, 0–1: the master's level in four bands. */
  bands: { low: number[]; lowMid: number[]; highMid: number[]; high: number[] };
};

const DRUMS = ["kick", "snare", "hat"] as const;

/** The song as a vixeq arrangement: bars 1–4 the calm, 5–8 the drop. */
export const arrangementFromJson = (json: SongJson): ArrangementProject => {
  const half = json.bars / 2;
  const steps = half * 16;
  const section = (firstBar: number): SequenceProject =>
    createProject({
      bpm: json.bpm,
      stepCount: steps,
      stepsPerBeat: 4,
      tracks: [
        ...DRUMS.map((id) => ({ id, name: id, steps: json.tracks[id].slice(firstBar * 16, firstBar * 16 + steps) })),
        {
          id: "energy",
          name: "energy",
          steps: json.energy.slice(firstBar, firstBar + half).flatMap((value) => Array<number>(16).fill(value))
        }
      ]
    });
  return createArrangement({
    timing: { bpm: json.bpm },
    durationBeats: json.bars * 4,
    patterns: { calm: section(0), drop: section(half) },
    sections: [
      { id: "calm", patternId: "calm", startBeat: 0, endBeat: half * 4 },
      { id: "drop", patternId: "drop", startBeat: half * 4, endBeat: json.bars * 4 }
    ]
  });
};

/**
 * The drums as decaying pulses (`flash`, the kick itself; `pulse`, its
 * afterglow; `snare`; `hat`) and `energy`, the bar's loudness.
 */
export const drumUniforms = (song: ArrangementProject): UniformSource =>
  songUniforms(song, {
    flash: { track: "kick", mode: "pulse", decay: 35 },
    pulse: { track: "kick", mode: "pulse", decay: 9 },
    snare: { track: "snare", mode: "pulse", decay: 14 },
    hat: { track: "hat", mode: "pulse", decay: 30 },
    energy: { track: "energy", mode: "hold" }
  });

/**
 * `bandLow`, `bandLowMid`, `bandHighMid` and `bandHigh`, 0–1, read between
 * the frames they were measured at, so a sample within the shutter gets its
 * own value and the loop wraps from the last frame to the first.
 */
export const bandUniforms = (json: SongJson, seconds: number): UniformSource => {
  const { fps, bands } = json;
  const frames = bands.low.length;
  const at = (values: number[], position: number): number => {
    const i = Math.floor(position);
    const f = position - i;
    const a = values[i % frames] ?? 0;
    const b = values[(i + 1) % frames] ?? 0;
    return a + (b - a) * f;
  };
  return {
    get(time) {
      const position = wrap(time, seconds) * fps;
      return {
        bandLow: at(bands.low, position),
        bandLowMid: at(bands.lowMid, position),
        bandHighMid: at(bands.highMid, position),
        bandHigh: at(bands.high, position)
      };
    }
  };
};
