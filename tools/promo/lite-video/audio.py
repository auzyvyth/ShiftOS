"""Sound bed for the promo, synthesised from events.json (no samples, no licence
issues). Usage: python3 -I audio.py out/events.json out/audio.wav"""
import json, sys, wave
import numpy as np

SR = 48000
ev = json.load(open(sys.argv[1]))
N = int(ev['duration'] * SR) + SR
L = np.zeros(N); R = np.zeros(N)
t = np.arange(N) / SR
rnd = np.random.default_rng(3)

def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); j = min(N, i + len(sig))
    if i >= N: return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def env(n, a, d):
    e = np.ones(n); ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai)
    return e * np.exp(-np.arange(n) / (d * SR))

def lowpass(x, cut):
    a = np.exp(-2 * np.pi * np.asarray(cut) / SR)
    y = np.zeros_like(x); prev = 0.0
    if np.ndim(a) == 0: a = np.full(len(x), a)
    for k in range(len(x)):
        prev = (1 - a[k]) * x[k] + a[k] * prev; y[k] = prev
    return y

# --- pad: Am F C G, crossfaded, gently detuned per channel ---
chords = [[110, 220, 261.63, 329.63], [87.31, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63], [98, 196, 246.94, 293.66]]
bar = 4.0
padL = np.zeros(N); padR = np.zeros(N)
for ci in range(int(N / SR / bar) + 2):
    ch = chords[ci % 4]; st = ci * bar
    n = int((bar + 1.5) * SR); tt = np.arange(n) / SR
    e = np.clip(tt / 0.8, 0, 1) * np.clip((bar + 1.5 - tt) / 1.2, 0, 1)
    for f in ch:
        for k, amp in ((1, 1), (2, .35), (3, .12)):
            ph = rnd.random() * 6.28
            sl = np.sin(2 * np.pi * f * k * 1.0015 * tt + ph) * amp * e
            sr_ = np.sin(2 * np.pi * f * k * 0.9985 * tt + ph) * amp * e
            i = int(st * SR); j = min(N, i + n)
            if i < N: padL[i:j] += sl[: j - i]; padR[i:j] += sr_[: j - i]
swell = 0.6 + 0.4 * np.clip(t / 3, 0, 1)
L += padL * 0.022 * swell; R += padR * 0.022 * swell

# --- beat: soft kick on the beat, shaker off-beat, until the CTA ---
beat = 0.5
kick_n = int(0.35 * SR); kt = np.arange(kick_n) / SR
kick = np.sin(2 * np.pi * (45 * kt + 60 * (1 - np.exp(-kt * 25)) / 25)) * np.exp(-kt * 9)
duck = np.ones(N)
b = 0.0
while b < 42.6:
    add(kick, b, 0.32)
    i = int(b * SR); dn = int(0.25 * SR); j = min(N, i + dn)
    duck[i:j] = np.minimum(duck[i:j], 0.55 + 0.45 * np.linspace(0, 1, j - i))
    sh = rnd.standard_normal(int(0.06 * SR)) * env(int(0.06 * SR), .002, .015)
    sh = sh - lowpass(sh, 4000)
    add(sh, b + beat / 2, 0.05, pan=0.3 if int(b / beat) % 2 else -0.3)
    b += beat
L *= duck; R *= duck

# --- hero impact: pitch-drop boom + air burst + shimmer ---
bn = int(0.9 * SR); bt = np.arange(bn) / SR
boom = np.sin(2 * np.pi * (48 * bt + 90 * (1 - np.exp(-bt * 18)) / 18)) * np.exp(-bt * 5)
air = rnd.standard_normal(bn) * np.exp(-bt * 22); air = lowpass(air, 2500)
shim = sum(np.sin(2 * np.pi * f * bt) for f in (1760, 2637, 3520)) * np.exp(-bt * 6) / 3
for h in ev['heroes']:
    add(boom, h, 0.55); add(air, h, 0.25); add(shim, h + 0.01, 0.035)

# --- word ticks ---
tn = int(0.03 * SR); tt_ = np.arange(tn) / SR
tick = np.sin(2 * np.pi * 1900 * tt_) * np.exp(-tt_ * 160)
for i, wt in enumerate(ev['words']):
    add(tick, wt, 0.05, pan=-0.2 if i % 2 else 0.2)

# --- whoosh on every scene wipe ---
wn = int(0.7 * SR); wt_ = np.arange(wn) / SR
shape = np.sin(np.pi * np.clip(wt_ / 0.6, 0, 1)) ** 2
noise = rnd.standard_normal(wn)
cut = 300 + 5000 * np.sin(np.pi * np.clip(wt_ / 0.6, 0, 1))
whoosh = lowpass(noise, cut) * shape
for w_ in ev['wipes']:
    add(whoosh, w_ - 0.15, 0.22, pan=0)

# --- notification dings + CTA tap ---
dn_ = int(0.9 * SR); dt = np.arange(dn_) / SR
ding = (np.sin(2 * np.pi * 1318.5 * dt) * np.exp(-dt * 5) + 0.6 * np.sin(2 * np.pi * 1760 * dt) * np.exp(-dt * 6) * (dt > 0.09))
for d in ev['dings']: add(ding, d, 0.16)
cn = int(0.05 * SR); ct = np.arange(cn) / SR
add(np.sin(2 * np.pi * 900 * ct) * np.exp(-ct * 90), ev['tap'], 0.35)
# final chord bloom at the CTA
fn = int(4 * SR); ft = np.arange(fn) / SR
bloom = sum(np.sin(2 * np.pi * f * ft) for f in (220, 261.63, 329.63, 440)) * np.clip(ft / 0.4, 0, 1) * np.exp(-ft * 0.6) / 4
add(bloom, 42.7, 0.18)

# fade out + master
fade = np.clip((ev['duration'] - t) / 1.2, 0, 1)
L *= fade; R *= fade
mx = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(L / mx * 1.4) / np.tanh(1.4) * 0.89; R = np.tanh(R / mx * 1.4) / np.tanh(1.4) * 0.89
out = np.stack([L, R], 1)[: int(ev['duration'] * SR)]
with wave.open(sys.argv[2], 'wb') as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[2])
