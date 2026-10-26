"""Bring a song exported from FL Studio into loops (see docs/song-workflow.md).

Usage: python3 -I scripts/import-song.py <name> <export-dir> [--master F] [--kick F] [--snare F] [--hat F] [--force]

<export-dir> holds FL's "Split mixer tracks" export: the master and the
KICK / SNARE / HAT stems (found by those words in the file names, or named
with the flags). It checks the master against the loops spec, then writes
music/<name>/: music.wav (the master), music.m4a (for the browser),
song.json (the drum hits per 16th, the bar loudness and four bands per
frame) and song.svg (a picture of it all, to check by eye).

Checks that stop it (unless --force): not 48 kHz; not exactly 8 bars at
120, 128 or 144 BPM; true peak over -1 dBTP; the beat grid more than 2 ms
off sample 0 (FL's plugin delay compensation shifts it; turn on
"Trim PDC silence"). Loudness away from -14 LUFS only warns.
"""

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

check = import_module("check-wav")

RATE = 48000
FPS = 60
BARS = 8
BPMS = (120, 128, 144)
LUFS_TARGET = -14.0
LUFS_TOLERANCE = 2.0
TRUE_PEAK_MAX = -1.0
GRID_TOLERANCE_MS = 2.0
# A 16th counts as a hit when the stem rises by this ratio into it, within
# this many dB of the stem's loudest hit.
RISE = 1.8
HIT_RANGE_DB = 30.0
ENERGY_MIN = 0.2
# Bands follow a rise within a frame or two and fall over this many seconds,
# so they swell with the music instead of flickering frame to frame.
BAND_ATTACK = 0.6
BAND_RELEASE_SECONDS = 0.12
BANDS = {
    "low": "lowpass=f=150",
    "lowMid": "highpass=f=150,lowpass=f=600",
    "highMid": "highpass=f=600,lowpass=f=4000",
    "high": "highpass=f=4000",
}
REPO = Path(__file__).resolve().parent.parent


class Problems:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, message):
        self.errors.append(message)
        print(f"  ERROR {message}")

    def warn(self, message):
        self.warnings.append(message)
        print(f"  WARN  {message}")


def rms(samples, t0, t1):
    i0, i1 = max(0, int(t0 * RATE)), min(len(samples), int(t1 * RATE))
    segment = samples[i0:i1]
    return math.sqrt(sum(x * x for x in segment) / max(1, len(segment)))


def db(value):
    return 20 * math.log10(value + 1e-9)


def find_files(folder, overrides):
    wavs = sorted(p for p in Path(folder).iterdir() if p.suffix.lower() == ".wav")
    found = {}
    for role in ("kick", "snare", "hat"):
        if overrides.get(role):
            found[role] = Path(overrides[role])
            continue
        matches = [p for p in wavs if re.search(role, p.stem, re.IGNORECASE)]
        if len(matches) > 1:
            sys.exit(f"Several files look like the {role} stem: {[p.name for p in matches]}; name one with --{role}")
        found[role] = matches[0] if matches else None
    if overrides.get("master"):
        found["master"] = Path(overrides["master"])
    else:
        masters = [p for p in wavs if re.search("master", p.stem, re.IGNORECASE)]
        rest = [p for p in wavs if p not in found.values()]
        if len(masters) == 1:
            found["master"] = masters[0]
        elif len(rest) == 1:
            found["master"] = rest[0]
        else:
            sys.exit(f"Cannot tell the master among {[p.name for p in rest]}; name it with --master")
    return found


def loudness(path):
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    summary = out[out.rfind("Summary:"):]
    integrated = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    true_peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    return integrated, true_peak


def drum_hits(samples, bpm, steps, loop_seconds):
    step = 60 / bpm / 4

    def before(t):
        # The first 16th's "before" lies at the loop's end.
        return rms(samples, loop_seconds - 0.015, loop_seconds - 0.002) if t < 0.015 else rms(samples, t - 0.015, t - 0.002)

    afters = [rms(samples, i * step + 0.001, i * step + 0.03) for i in range(steps)]
    loudest = db(max(afters))
    if loudest < -60:
        return None
    hits = []
    for i, after in enumerate(afters):
        level = db(after)
        rising = after / (before(i * step) + 1e-6) > RISE
        if rising and level > loudest - HIT_RANGE_DB:
            hits.append(round(0.2 + 0.8 * min(1.0, (level - (loudest - HIT_RANGE_DB)) / HIT_RANGE_DB), 3))
        else:
            hits.append(0.0)
    return hits


def bands(master_path, frames):
    window = RATE // FPS
    out = {}
    for name, chain in BANDS.items():
        samples = check.decode(str(master_path), RATE, chain)
        levels = [db(math.sqrt(sum(x * x for x in samples[i * window:(i + 1) * window]) / window)) for i in range(frames)]
        ordered = sorted(levels)
        floor, top = ordered[len(ordered) // 10], ordered[-1]
        values = [min(1.0, max(0.0, (level - floor) / ((top - floor) or 1))) for level in levels]
        out[name] = [round(v, 3) for v in envelope(values)]
    return out


def envelope(values):
    """Fast rise, slow fall, around the loop: the second pass starts from the
    first pass's end, so the last frame leads into the first."""
    release = math.exp(-1 / (FPS * BAND_RELEASE_SECONDS))
    level = 0.0
    out = list(values)
    for _ in range(2):
        for i, value in enumerate(values):
            level = level + BAND_ATTACK * (value - level) if value > level else level * release + value * (1 - release)
            out[i] = level
    return out


def svg(song, path):
    width, row = 1280, 40
    steps = len(song["tracks"]["kick"])
    frames = len(song["bands"]["low"])
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{row * 3 + 260}" font-family="monospace" font-size="12">',
             f'<rect width="100%" height="100%" fill="#06090d"/>']
    sx = (width - 80) / steps
    for bar in range(BARS + 1):
        x = 70 + bar * 16 * sx
        parts.append(f'<line x1="{x:.1f}" y1="0" x2="{x:.1f}" y2="{row * 3 + 250}" stroke="#1c2a33"/>')
    for r, name in enumerate(("kick", "snare", "hat")):
        y = 10 + r * row
        parts.append(f'<text x="8" y="{y + 22}" fill="#9fb3bf">{name}</text>')
        for i, value in enumerate(song["tracks"][name]):
            if value > 0:
                h = (row - 8) * value
                parts.append(f'<rect x="{70 + i * sx:.1f}" y="{y + row - 8 - h:.1f}" width="{max(sx - 2, 1):.1f}" height="{h:.1f}" fill="#4dd9f2"/>')
    top = row * 3 + 20
    lane = 56
    for r, (name, values) in enumerate(song["bands"].items()):
        y = top + r * lane
        parts.append(f'<text x="8" y="{y + 30}" fill="#9fb3bf">{name}</text>')
        points = " ".join(f"{70 + i * (width - 80) / frames:.1f},{y + lane - 6 - (lane - 12) * v:.1f}" for i, v in enumerate(values))
        parts.append(f'<polyline points="{points}" fill="none" stroke="#4dd9f2" stroke-width="1.2"/>')
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("export_dir")
    for role in ("master", "kick", "snare", "hat"):
        parser.add_argument(f"--{role}")
    parser.add_argument("--force", action="store_true", help="write the song even when a check fails")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", args.name):
        sys.exit("The name must be lowercase letters, digits and hyphens, e.g. night-drift")

    files = find_files(args.export_dir, vars(args))
    for role, path in files.items():
        print(f"{role:7s} {path.name if path else '(none: silent)'}")
    problems = Problems()

    info = check.probe(str(files["master"]))
    rate, samples_count = int(info["sample_rate"]), int(info["duration_ts"])
    if rate != RATE:
        problems.error(f"master is {rate} Hz; export at {RATE} Hz")
    bpm = next((b for b in BPMS if abs(samples_count - rate * BARS * 4 * 60 / b) < 1), None)
    if bpm is None:
        candidates = ", ".join(f"{b} BPM = {rate * BARS * 4 * 60 // b} samples" for b in BPMS)
        problems.error(f"master is {samples_count} samples, not {BARS} bars at {candidates}")
        bpm = min(BPMS, key=lambda b: abs(samples_count - rate * BARS * 4 * 60 / b))
    loop_seconds = BARS * 4 * 60 / bpm
    print(f"bpm     {bpm} ({loop_seconds:.3f} s, {round(loop_seconds * FPS)} frames at {FPS} fps)")

    integrated, true_peak = loudness(files["master"])
    print(f"level   {integrated:.1f} LUFS, true peak {true_peak:.1f} dBTP")
    if true_peak > TRUE_PEAK_MAX + 0.05:
        problems.error(f"true peak {true_peak:.1f} dBTP is over {TRUE_PEAK_MAX} dBTP; lower the limiter's ceiling")
    if abs(integrated - LUFS_TARGET) > LUFS_TOLERANCE:
        problems.warn(f"{integrated:.1f} LUFS is far from {LUFS_TARGET} LUFS")

    grid_source = next((files[r] for r in ("kick", "hat", "snare") if files.get(r)), files["master"])
    hop_ms = 5
    strength = check.onset_strength(check.decode(str(grid_source), RATE), int(RATE * hop_ms / 1000))
    offset = check.grid_offset_ms(strength, hop_ms, 60000 / bpm / 4)
    print(f"grid    {offset:+.0f} ms off sample 0 (from {grid_source.name})")
    if abs(offset) > GRID_TOLERANCE_MS:
        problems.error(f"the beat grid is {offset:+.0f} ms off sample 0; turn on Trim PDC silence and export again")

    if problems.errors and not args.force:
        sys.exit(f"{len(problems.errors)} check(s) failed; fix the export, or pass --force to write it anyway")

    steps = BARS * 16
    tracks = {}
    for role in ("kick", "snare", "hat"):
        hits = drum_hits(check.decode(str(files[role]), RATE), bpm, steps, loop_seconds) if files.get(role) else None
        tracks[role] = hits or [0.0] * steps
        print(f"{role:7s} {sum(1 for v in tracks[role] if v > 0)}/{steps} sixteenths hit")

    master = check.decode(str(files["master"]), RATE)
    bar_seconds = loop_seconds / BARS
    levels = [db(rms(master, b * bar_seconds, (b + 1) * bar_seconds)) for b in range(BARS)]
    low, high = min(levels), max(levels)
    energy = [round(ENERGY_MIN + (1 - ENERGY_MIN) * (level - low) / ((high - low) or 1), 3) for level in levels]
    frames = round(loop_seconds * FPS)
    song = {
        "source": files["master"].name,
        "bpm": bpm,
        "bars": BARS,
        "fps": FPS,
        "lufs": round(integrated, 1),
        "tracks": tracks,
        "energy": energy,
        "bands": bands(files["master"], frames),
    }

    out = REPO / "music" / args.name
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(files["master"], out / "music.wav")
    (out / "song.json").write_text(json.dumps(song, separators=(",", ":")) + "\n")
    svg(song, out / "song.svg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "music.wav"), "-c:a", "aac_at", "-b:a", "160k",
                    "-movflags", "+faststart", str(out / "music.m4a")], check=True)
    print(f"wrote   music/{args.name}/ (music.wav, music.m4a, song.json, song.svg)")
    if problems.errors or problems.warnings:
        print(f"        with {len(problems.errors)} failed check(s) and {len(problems.warnings)} warning(s)")


if __name__ == "__main__":
    main()
