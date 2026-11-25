# English voice-over for the calculator ad v2 (Kokoro, voice af_bella, Apache-2.0).
#   python3 make-vo-calc2.py <dir with kokoro-v1.0.onnx + voices-v1.0.bin>
# Writes public/audio/calc2-vo.wav (48 kHz, placed on the timeline) and prints each line's fit.
import sys, json, subprocess, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
TL = json.load(open('src/calc2/timeline.json')); B = {b[0]: b[1] for b in TL['beats']}
k = Kokoro(f"{sys.argv[1]}/kokoro-v1.0.onnx", f"{sys.argv[1]}/voices-v1.0.bin")
V, SR = 'af_bella', 24000
def say(t, sp=1.05):
    a, _ = k.create(t, voice=V, speed=sp, lang='en-us')
    i = np.where(np.abs(a) > 0.01)[0]; return a[max(0, i[0] - 200): i[-1] + 600]
def shift(a, semis, gain=1.0):
    if not semis: return a * gain
    r = 2 ** (semis / 12); sf.write('/tmp/_vo_i.wav', a, SR)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_vo_i.wav', '-af', f'asetrate={int(SR*r)},aresample={SR},atempo={1/r:.4f}', '/tmp/_vo_o.wav'], check=True)
    return sf.read('/tmp/_vo_o.wav')[0] * gain
gap = lambda s: np.zeros(int(s * SR))
def acted(parts): return np.concatenate([x for t, sp, se, g, p in parts for x in (shift(say(t, sp), se, g), gap(p))])
# (start, until, audio) — `until` is where the next line starts, so a line must end before it
LINES = [
    (0.15, B['excel2'], say('Still doing loans in Excel?')),
    (2.35, B['retype'], acted([('Whaaat?!', 0.75, 3, 1.5, 0.28), ('You paid three hundred ringgit', 1.15, 1, 1.1, 0.1), ('for an Excel file?!', 0.85, 2, 1.25, 0)])),
    (6.05, B['flood'], say('Every question, you type it all again.', 1.15)),
    (8.15, B['calc'], say('Viewers ask. Excel has no answer.')),
    (10.9, B['calc2'], say('With Drevo? One tap. Answered on the spot.')),
    (15.6, B['budget'], say('Insurance, NCD, total paid and interest. All there.')),
    (19.8, B['bands'], say("Type a viewer's pay, and the cars that fit pop up.")),
    (23.6, B['viewer'], say('Comfortable, tight, or too heavy. Sorted for you.')),
    (27.9, B['next'], say('Viewer mode. One name, one answer.')),
    (33.8, B['guide'], say('Next in the queue? Answered live.')),
    (37.75, B['plans'], say('A budget guide. The bank decides.', 1.15)),
    (40.0, B['cta'], say('Start free. The full version is in Premium.')),
    (44.9, TL['dur'], say('Try Premium free for seven days, at drevo dot my.')),
]
out = np.zeros(int(TL['dur'] * SR)); segs = []
for st, until, a in LINES:
    end = st + len(a) / SR
    print(f"{st:6.2f} -> {end:6.2f}  (room until {until:5.2f})  {'OK' if end <= until + 0.05 else 'TOO LONG'}")
    i = int(st * SR); n = min(len(a), len(out) - i); out[i:i + n] += a[:n]; segs.append([st, round(end, 2)])
out = out / np.max(np.abs(out)) * 0.95
sf.write('/tmp/_vo24.wav', out, SR)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_vo24.wav', '-ar', '48000', '-ac', '2', 'public/audio/calc2-vo.wav'], check=True)
json.dump(segs, open('public/audio/calc2-vo.json', 'w'))
