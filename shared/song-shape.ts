// The shape of a loops song in time, whatever its notes: 8 bars, the calm
// (bars 1–4) and the drop (bars 5–8), whose first three bars carry the
// "action" kicks and whose last bar settles back so the loop wraps.
import { beatToMs, type ArrangementProject } from "@vixeq/core";
import { beatAt, songSeconds, wrap } from "./song-uniforms";

export const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** The integral of smoothstep(edge0, edge1, x) from 0 to x, for 0 ≤ edge0. */
const smoothstepIntegral = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return (edge1 - edge0) * (t * t * t - (t * t * t * t) / 2) + Math.max(x - edge1, 0);
};

export const easeOutCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;

export type SongShape = {
  song: ArrangementProject;
  /** Seconds in one loop. */
  seconds: number;
  beats: number;
  beatSeconds: number;
  dropBeat: number;
  /** The drop's last bar, which eases back to the calm. */
  settleBeat: number;
  /** Action kicks in the drop (all but its last bar's). */
  actionBeats: number;
  secondsAt(beat: number): number;
  /** 0 in the calm, 1 in the drop: rising through the calm's last beat, settling over the last bar. */
  dropAt(t: number): number;
  /** The integral of dropAt from 0 to t, for speeds that rise with the drop. */
  dropIntegral(t: number): number;
  isActionBeat(beat: number): boolean;
  /** Action kicks fired before `beat`, not counting `beat` itself. */
  actionsBefore(beat: number): number;
  /** Where `time` is in the loop: wrapped seconds, the beat, and seconds since it. */
  songTime(time: number): { t: number; beat: number; sinceBeat: number };
};

/** The shape of `song`, which has a section named "drop". */
export const createSongShape = (song: ArrangementProject): SongShape => {
  const drop = song.sections.find((section) => section.id === "drop");
  if (!drop) throw new Error('A loops song needs a section named "drop".');
  const seconds = songSeconds(song);
  const beats = song.durationBeats;
  const secondsAt = (beat: number): number => beatToMs(song.timing, beat) / 1000;
  const beatSeconds = secondsAt(1);
  const dropBeat = drop.startBeat;
  const settleBeat = drop.endBeat - 4;
  const actionBeats = settleBeat - dropBeat;
  const dropSeconds = secondsAt(dropBeat);
  const settleSeconds = secondsAt(settleBeat);
  const riseStart = dropSeconds - beatSeconds;
  return {
    song,
    seconds,
    beats,
    beatSeconds,
    dropBeat,
    settleBeat,
    actionBeats,
    secondsAt,
    dropAt: (t) => smoothstep(riseStart, dropSeconds, t) - smoothstep(settleSeconds, seconds, t),
    dropIntegral: (t) =>
      smoothstepIntegral(riseStart, dropSeconds, t) - smoothstepIntegral(settleSeconds, seconds, t),
    isActionBeat: (beat) => beat >= dropBeat && beat < settleBeat,
    actionsBefore: (beat) => Math.min(Math.max(beat - dropBeat, 0), actionBeats),
    songTime(time) {
      const t = wrap(time, seconds);
      const beat = Math.min(Math.floor(beatAt(song, t)), beats - 1);
      return { t, beat, sinceBeat: t - secondsAt(beat) };
    }
  };
};
