// LIMINAL VEIN: 128 BPM, 4/4, 8 bars = 15 s. Bars 1–4 are the calm, bars 5–8
// the drop. The hats and the bar loudness come from the WAV
// (scripts/analyze-wav.py writes analysis.json); the kick is four on the floor,
// written here because the mix hides it from analysis.
import { createArrangement, createProject, type SequenceProject } from "@vixeq/core";
import analysis from "./analysis.json";
import musicUrl from "./music.m4a?url";

export { musicUrl };

const BPM = 128;
const BARS = 8;
const SECTION_BARS = 4;
const STEPS = SECTION_BARS * 16;

export const LOOP_SECONDS = (BARS * 4 * 60) / BPM;

/** Bars `[firstBar, firstBar + SECTION_BARS)` of the song as one pattern. */
const section = (firstBar: number): SequenceProject =>
  createProject({
    bpm: BPM,
    stepCount: STEPS,
    stepsPerBeat: 4,
    tracks: [
      { id: "kick", name: "kick", steps: Array.from({ length: STEPS }, (_, i) => (i % 4 === 0 ? 1 : 0)) },
      { id: "hat", name: "hat", steps: analysis.hat.slice(firstBar * 16, (firstBar + SECTION_BARS) * 16) },
      {
        id: "energy",
        name: "energy",
        steps: analysis.energy.slice(firstBar, firstBar + SECTION_BARS).flatMap((value) => Array<number>(16).fill(value))
      }
    ]
  });

export const song = createArrangement({
  timing: { bpm: BPM },
  durationBeats: BARS * 4,
  patterns: { calm: section(0), drop: section(SECTION_BARS) },
  sections: [
    { id: "calm", patternId: "calm", startBeat: 0, endBeat: 16 },
    { id: "drop", patternId: "drop", startBeat: 16, endBeat: 32 }
  ]
});
