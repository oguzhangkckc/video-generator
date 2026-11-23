# /// script
# requires-python = ">=3.10"
# dependencies = ["praat-parselmouth>=0.4.4,<0.5", "numpy>=1.26"]
# ///
"""Final intonation of sentences (STYLE.md "Anlatım"), called by scripts/lib/speech.mjs through `uv run`.

stdin:  {"limits": {"window": 0.4, "riseSt": 2, "decayS": 0.06},
         "items": [{"id": ..., "wav": path, "start": s, "end": s, "kind": "statement" | "wh-question" | ...,
                    "quietDb": dBFS}]}
        start/end are the sentence's acoustic bounds (speech.mjs): `end` is where the speaking stops; quietDb is
        the level of silence in that file.
stdout: [{"id": ..., "rise": semitones | null, "decay": s | null, "flags": ["rise", "decay"]}]

rise:  F0 over the last `window` s of voicing (a devoiced final syllable would leave nothing to measure), kept
       within −15…+10 semitones of the speaker's median and in voiced runs of at least 30 ms (breath and fricatives
       read as 600 Hz "pitch" otherwise), smoothed; the median of the final 60 ms of voicing minus the 10th
       percentile before it. A falling end gives ≤ 0.
decay: from where the last syllable's level drops 10 dB below its peak to where it reaches quietDb (searched up to
       0.5 s past `end`). A cut-off ending gives ~0.
"""
import json
import sys

import numpy as np
import parselmouth

CHECKED = {"statement", "wh-question"}


def level_db(samples, sr, t0, t1):
    win = int(sr * 0.01)
    hop = win // 2
    a, b = max(0, int(t0 * sr)), min(len(samples), int(t1 * sr))
    seg = samples[a:b]
    if len(seg) < win:
        return np.array([]), np.array([])
    frames = np.lib.stride_tricks.sliding_window_view(seg, win)[::hop]
    db = 10 * np.log10(np.mean(frames * frames, axis=1) + 1e-12)
    # 25 ms smoothing, so syllable peaks are not lost among single-window ripples
    db = np.convolve(db, np.ones(5) / 5, mode="same")
    times = a / sr + (np.arange(len(db)) * hop + win / 2) / sr
    return times, db


STEP = 0.01
MIN_RUN = 3
LOOK_BACK = 1.0


def speaker_median(sound):
    f0 = sound.to_pitch_ac(time_step=STEP, pitch_floor=75, pitch_ceiling=600).selected_array["frequency"]
    voiced = f0[f0 > 0]
    return 12 * np.log2(np.median(voiced) / 100.0) if len(voiced) else None


def final_rise(sound, median, start, end, window):
    if median is None:
        return None
    lo = max(start, end - LOOK_BACK)
    part = sound.extract_part(from_time=max(0.0, lo - 0.05), to_time=end + 0.02, preserve_times=True)
    pitch = part.to_pitch_ac(time_step=STEP, pitch_floor=75, pitch_ceiling=600)
    f0 = pitch.selected_array["frequency"]
    ts = pitch.xs()
    st = np.where(f0 > 0, 12 * np.log2(np.maximum(f0, 1) / 100.0), np.nan)
    ok = (ts >= lo) & (ts <= end) & ~np.isnan(st) & (st >= median - 15) & (st <= median + 10)
    runs, run = [], []
    for i in range(len(ts)):
        if ok[i]:
            run.append(i)
        elif run:
            runs.append(run)
            run = []
    if run:
        runs.append(run)
    idx = [i for r in runs if len(r) >= MIN_RUN for i in r]
    if not idx:
        return None
    idx = [i for i in idx if ts[i] >= ts[idx[-1]] - window]
    if len(idx) < 2 * MIN_RUN:
        return None
    ts, st = ts[idx], st[idx]
    st = np.array([np.median(st[max(0, i - 2) : i + 3]) for i in range(len(st))])
    last = ts[-1] - 0.06
    end_value = float(np.median(st[ts >= last]))
    before = st[ts < last]
    return end_value - float(np.percentile(before, 10)) if len(before) else 0.0


def decay(samples, sr, start, end, window, quiet_db):
    times, db = level_db(samples, sr, max(start, end - window), end + 0.5)
    spoken = times <= end
    if spoken.sum() < 3:
        return None
    head = db[spoken]
    loudest = head.max()
    peaks = [k for k in range(1, len(head) - 1) if head[k] >= head[k - 1] and head[k] >= head[k + 1] and head[k] >= loudest - 15]
    k = peaks[-1] if peaks else int(np.argmax(head))
    below = np.nonzero(db[k:] <= db[k] - 10)[0]
    if not len(below):
        return None
    fall = k + below[0]
    # Silence that lasts (as speech.mjs MIN_PAUSE), so a stop closure inside the last word does not end the decay.
    hold = 10
    quiet = db[fall:] <= quiet_db
    stop = next((i for i in range(len(quiet) - hold + 1) if quiet[i : i + hold].all()), len(quiet) - 1)
    return max(0.0, float(times[fall + stop] - times[fall]))


def main():
    job = json.load(sys.stdin)
    limits = job["limits"]
    sounds = {}
    out = []
    for item in job["items"]:
        wav = item["wav"]
        if wav not in sounds:
            snd = parselmouth.Sound(wav)
            if snd.n_channels > 1:
                snd = snd.convert_to_mono()
            sounds[wav] = (snd, speaker_median(snd))
        snd, median = sounds[wav]
        samples = snd.values[0]
        sr = snd.sampling_frequency
        rise = final_rise(snd, median, item["start"], item["end"], limits["window"])
        dec = decay(samples, sr, item["start"], item["end"], limits["window"], item["quietDb"])
        flags = []
        if item.get("kind") in CHECKED:
            if rise is not None and rise > limits["riseSt"]:
                flags.append("rise")
            if dec is not None and dec < limits["decayS"]:
                flags.append("decay")
        out.append({
            "id": item["id"],
            "rise": None if rise is None else round(rise, 2),
            "decay": None if dec is None else round(dec, 3),
            "flags": flags,
        })
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
