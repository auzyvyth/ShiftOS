"""Original score + sound effects for the Drevo Premium ad. numpy only.

python3 score.py events.json out.wav
The picture exports every sound cue (window.EV) to events.json, so each click,
pop and whoosh sits on the frame it belongs to. The music is on a 120 BPM grid
(one beat = 0.5 s, one bar = 2 s), the same grid the picture's cuts land on.
"""
import json, sys, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)
ev_path, out_path = sys.argv[1], sys.argv[2]
DATA = json.load(open(ev_path))
DUR = DATA["dur"] + 1.5
N = int(DUR * SR)
music = np.zeros((N, 2))
fx = np.zeros((N, 2))
rev_send = np.zeros((N, 2))
BEAT = 0.5

def t_(d):
    return np.arange(int(d * SR)) / SR

def add(buf, x, at, gain=1.0, pan=0.0, send=0.0):
    i = int(at * SR)
    if i >= N or len(x) == 0:
        return
    x = x[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * l * 1.414
    buf[i:i + len(x), 1] += x * r * 1.414
    if send:
        rev_send[i:i + len(x), 0] += x * l * send
        rev_send[i:i + len(x), 1] += x * r * send

def band(x, lo, hi):
    """FFT band-pass with soft edges."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X = np.fft.rfft(x)
    m = np.clip((f - lo * 0.7) / (lo * 0.3 + 1e-9), 0, 1) * np.clip((hi * 1.3 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(X * m, n)

def env(n, a=0.002, d=0.2, curve=4.0):
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / max(a, 1e-4)) * np.exp(-curve * tt / max(d, 1e-4))
    return e

def saw(freq, d, harm=14):
    tt = t_(d)
    y = np.zeros_like(tt)
    for k in range(1, harm + 1):
        if freq * k > 16000:
            break
        y += ((-1) ** (k + 1)) * np.sin(2 * np.pi * freq * k * tt) / k
    return y * 0.6

def midi(n):
    return 440 * 2 ** ((n - 69) / 12)

# ---------------- instruments ----------------
def kick(g=1.0):
    tt = t_(0.45)
    f = 45 + 95 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-tt * 7.5)
    y[:240] += band(rng.standard_normal(240), 2000, 8000) * np.linspace(1, 0, 240) * 0.5
    return np.tanh(y * 1.6) * g

def clap():
    n = int(0.25 * SR)
    noise = band(rng.standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for k, o in enumerate([0, 0.011, 0.022]):
        i = int(o * SR)
        e[i:] += np.exp(-np.arange(n - i) / SR * (60 if k < 2 else 16))
    return noise * e * 0.6

def hat(open_=False):
    d = 0.22 if open_ else 0.04
    n = int(d * SR)
    return band(rng.standard_normal(n), 7000, 15000) * env(n, 0.001, d * 0.5, 3) * 0.35

def bass_note(n, d):
    f = midi(n)
    tt = t_(d)
    y = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.18 * saw(f, d, 6)
    e = np.minimum(1, tt / 0.004) * np.exp(-tt * 3.0)
    e *= np.clip((d - tt) / 0.02, 0, 1)
    return np.tanh(y * e * 1.4) * 0.55

def stab(notes, d=0.18):
    y = np.zeros(int(d * SR) + 1)
    for n in notes:
        for det in (-0.12, 0.0, 0.12):
            s = saw(midi(n) * 2 ** (det / 12), d, 10)
            y[:len(s)] += s
    tt = np.arange(len(y)) / SR
    return band(y, 200, 5000) * np.minimum(1, tt / 0.003) * np.exp(-tt * 14) * 0.13

def pluck(n, d=0.22):
    tt = t_(d)
    f = midi(n)
    y = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 20) + 0.25 * np.sign(np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 30))
    return y * np.exp(-tt * 13) * 0.16

def pad(notes, d):
    tt = t_(d)
    y = np.zeros_like(tt)
    for n in notes:
        for det in (-0.08, 0.07):
            y += saw(midi(n) * 2 ** (det / 12), d, 8)
    y = band(y, 150, 2500)
    e = np.minimum(1, tt / 0.6) * np.clip((d - tt) / 0.5, 0, 1)
    return y * e * 0.05

def riser(d):
    n = int(d * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    seg = 4096
    for i in range(0, n, seg):
        k = i / n
        out[i:i + seg] = band(rng.standard_normal(min(seg, n - i)), 400 + 6000 * k * k, 2000 + 12000 * k)
    return out * (tt / d) ** 2 * 0.35

# ---------------- arrangement ----------------
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
ROOTS = [33, 29, 36, 31]
SILENCE = (42.55, 43.0)
END = 47.0

def in_sil(x):
    return SILENCE[0] <= x < SILENCE[1]

beats = np.arange(0, END, BEAT)
for b in beats:
    if in_sil(b):
        continue
    bar = int(b // 2) % 4
    sec = b
    full = sec >= 4.0
    # kick every beat; quiet bars 20-23 (listings breath) halve it
    if not (20.0 <= sec < 22.5 and int(sec * 2) % 2):
        add(music, kick(1.0 if full else 0.8), b, 0.9)
    # clap on 2 and 4 once the drop lands
    if full and int(round(b / BEAT)) % 2 == 1:
        add(music, clap(), b, 0.55, 0.0, 0.25)
    # hats: 8ths, open hat on the off-beat
    add(music, hat(), b + 0.25, 0.5 if full else 0.35, 0.25)
    if full:
        add(music, hat(True), b + 0.25, 0.18, -0.25)
    if sec >= 12.0:
        add(music, hat(), b + 0.125, 0.18, 0.4)
        add(music, hat(), b + 0.375, 0.18, -0.4)
    # bass: 8th pulse on the root, ducked by the kick
    for o in (0.0, 0.25):
        if in_sil(b + o):
            continue
        g = 0.55 if o == 0 else 0.85
        add(music, bass_note(ROOTS[bar] + (12 if o and sec >= 23 else 0), 0.24), b + o, g * (0.7 if not full else 1))
    # offbeat chord stabs from the drop
    if full:
        add(music, stab(CHORDS[bar]), b + 0.25, 0.9, 0.0, 0.35)

# pads under the long sections
for s0 in np.arange(4.0, 42.0, 2.0):
    add(music, pad([n + 12 for n in CHORDS[int(s0 // 2) % 4]], 2.2), s0, 0.9, 0.0, 0.5)
# 16th arp in the leads + studio + mini page sections
ARP = [0, 2, 1, 2]
for s0, s1 in ((12.0, 20.0), (23.0, 31.0), (35.0, 42.5)):
    for k, b in enumerate(np.arange(s0, s1, 0.125)):
        ch = CHORDS[int(b // 2) % 4]
        add(music, pluck(ch[ARP[k % 4]] + 24), b, 0.8, 0.5 * np.sin(k * 0.7), 0.4)
# risers into the big moments
for at_, d in ((2.5, 1.5), (10.5, 1.5), (21.5, 1.5), (40.6, 1.95)):
    add(music, riser(d), at_, 0.9, 0.0, 0.3)
# ending: chord hits on the CTA, then a long tail
for i, b in enumerate([43.0, 44.0, 45.0, 46.0]):
    add(music, stab([57, 60, 64, 69], 0.5), b, 1.6, 0.0, 0.6)
add(music, pad([69, 72, 76], 4.4), 43.0, 1.6, 0.0, 0.7)
add(music, bass_note(33, 1.2), 46.0, 1.0)
add(music, kick(1.1), 46.0, 1.0)

# ---------------- sound effects ----------------
def click():
    tt = t_(0.05)
    return (np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 120) * 0.5 + band(rng.standard_normal(len(tt)), 2000, 9000) * np.exp(-tt * 200) * 0.6)

def key():
    tt = t_(0.06)
    return (np.sin(2 * np.pi * 180 * tt) * np.exp(-tt * 90) * 0.6 + band(rng.standard_normal(len(tt)), 1500, 6000) * np.exp(-tt * 160) * 0.5)

def pop(g=1.0):
    tt = t_(0.09)
    f = 500 + 900 * (1 - np.exp(-tt * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 45) * 0.45 * g

def whoosh(d=0.5, lo=300, hi=6000):
    n = int(d * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        k = i / n
        c = lo + (hi - lo) * np.sin(k * np.pi)
        out[i:i + seg] = band(rng.standard_normal(min(seg, n - i)), c * 0.6, c * 1.6)
    return out * np.sin(np.pi * tt / d) ** 2 * 0.5

def crumple():
    n = int(0.55 * SR)
    out = np.zeros(n)
    for _ in range(70):
        i = int(rng.uniform(0, n - 800))
        g = band(rng.standard_normal(600), 1500, 9000) * np.exp(-np.arange(600) / 90)
        out[i:i + 600] += g * rng.uniform(0.2, 1)
    return out * 0.45

def bell(freqs, d=0.9, g=0.3):
    tt = t_(d)
    y = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * (3 + i * 2)) / (i + 1) for i, f in enumerate(freqs))
    return y * g

def ticks(d=0.42):
    n = int(d * SR)
    out = np.zeros(n)
    for k in range(9):
        i = int(k / 9 * d * SR)
        tt = t_(0.012)
        out[i:i + len(tt)] += np.sin(2 * np.pi * 3200 * tt) * np.exp(-tt * 400) * (1 - k / 12)
    return out * 0.18

def impact():
    tt = t_(1.4)
    f = 38 + 60 * np.exp(-tt * 9)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.4)
    y += band(rng.standard_normal(len(tt)), 200, 6000) * np.exp(-tt * 9) * 0.4
    return np.tanh(y * 1.5) * 0.8

def scan():
    tt = t_(0.95)
    f = 600 + 1800 * tt / 0.95
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.05 * np.sin(np.pi * tt / 0.95) + whoosh(0.95, 2000, 7000) * 0.3

def sparkle():
    out = np.zeros(int(0.7 * SR))
    for k in range(10):
        i = int(k * 0.05 * SR)
        b = bell([rng.uniform(2500, 5000)], 0.25, 0.06)
        out[i:i + len(b)] += b
    return out

for e in DATA["ev"]:
    t, ty, g, pan = e["t"], e["type"], e.get("g", 1.0), e.get("pan", 0.0)
    if ty == "click": add(fx, click(), t, 0.55, pan, 0.1)
    elif ty == "key": add(fx, key(), t, 0.4 * g, pan + rng.uniform(-0.15, 0.15))
    elif ty == "pop": add(fx, pop(g), t, 0.5, rng.uniform(-0.2, 0.2), 0.15)
    elif ty == "whoosh": add(fx, whoosh(0.5), t - 0.2, 0.7, 0, 0.2)
    elif ty == "swish": add(fx, whoosh(0.3, 800, 7000), t - 0.12, 0.5, 0.3, 0.15)
    elif ty == "crumple": add(fx, crumple(), t, 0.8, -0.3, 0.2)
    elif ty == "ding": add(fx, bell([1568, 3136, 4704], 1.0, 0.25), t, 1, 0.2, 0.4)
    elif ty == "chime": add(fx, bell([1318, 1976], 0.6, 0.2), t, 1, 0, 0.3); add(fx, bell([1976, 2637], 0.6, 0.18), t + 0.09, 1, 0, 0.3)
    elif ty == "win":
        for k, f in enumerate([1047, 1319, 1568, 2093]): add(fx, bell([f, f * 2], 0.7, 0.16), t + k * 0.06, 1, -0.3 + k * 0.2, 0.4)
    elif ty == "tick": add(fx, ticks(), t, 1, 0.1)
    elif ty == "hop": add(fx, pluck(69 + [0, 2, 3, 5, 7, 8, 12][e.get("n", 0)], 0.3), t, 2.2, 0.3, 0.3)
    elif ty == "impact": add(fx, impact(), t, g, 0, 0.4)
    elif ty == "scan": add(fx, scan(), t, 1, 0)
    elif ty == "shutter": add(fx, click(), t, 0.8); add(fx, click(), t + 0.07, 0.6)
    elif ty == "sparkle": add(fx, sparkle(), t, 1, 0.2, 0.4)
    elif ty == "strike": add(fx, whoosh(0.28, 1500, 9000), t, 0.6, -0.2)

# ---------------- reverb send (FFT convolution with a decaying noise tail) ----------------
ir_n = int(1.6 * SR)
ir = rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / SR * 3.2)[:, None]
ir[:, 0] = band(ir[:, 0], 200, 7000); ir[:, 1] = band(ir[:, 1], 200, 7000)
L_ = N + ir_n
nfft = 1 << (L_ - 1).bit_length()
wet = np.zeros((N, 2))
for ch in range(2):
    wet[:, ch] = np.fft.irfft(np.fft.rfft(rev_send[:, ch], nfft) * np.fft.rfft(ir[:, ch], nfft), nfft)[:N]
wet *= 0.9 / (np.abs(wet).max() + 1e-9) * np.abs(rev_send).max()

# sidechain the music under each kick for the pump
pump = np.ones(N)
for b in beats:
    if in_sil(b): continue
    i = int(b * SR); n = int(0.22 * SR)
    seg = 1 - 0.45 * np.exp(-np.arange(n) / SR * 18)
    pump[i:i + n] = np.minimum(pump[i:i + n], seg[: max(0, min(n, N - i))])
mix = music * pump[:, None] * 0.8 + fx * 1.0 + wet * 0.6
# silence before the CTA: let only the fx tails ring
s0, s1 = int(SILENCE[0] * SR), int(SILENCE[1] * SR)
mix[s0:s1] *= np.linspace(1, 0.05, s1 - s0)[:, None]
# fade the very end
fe = int(1.0 * SR)
mix[-fe:] *= np.linspace(1, 0, fe)[:, None]
# master EQ: tame the sub (phones can't play it), lift presence so it reads on a phone speaker
F = np.fft.rfftfreq(N, 1 / SR)
def db(x): return 10 ** (x / 20)
LOGF = np.log10(np.maximum(F, 1))
curve = db(np.interp(LOGF, np.log10([20, 90, 160, 1000, 2500, 5000, 9000, 20000]), [-6, -4, -1, 0, 3, 3.5, 2.5, 1]))
curve *= np.where(F < 30, db(-18), 1)                     # nothing below 30 Hz
curve /= np.sqrt(1 + (70 / np.maximum(F, 1)) ** 2)        # gentle high-pass around 70 Hz
for ch in range(2):
    mix[:, ch] = np.fft.irfft(np.fft.rfft(mix[:, ch]) * curve, N)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.abs(mix).max() / 0.89
with wave.open(out_path, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", out_path, f"{DUR:.1f}s")
