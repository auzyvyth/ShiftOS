# Sound for the dashboard pan (DashPan): an original beat mixed TO the picture. Every hit is cued from
# src/dash/timeline.json (frames), and the music grid is the same 112.5 bpm the picture is
# built on, so each slam, chip, scan and digit roll lands on a beat. Writes public/audio/dash.wav.
import json, wave, numpy as np
TL = json.load(open('src/dash/timeline.json'))
FPS = TL['fps']; BEAT = 60 / TL['bpm']; SR = 48000
DUR = TL['dur'] / FPS; N = int(SR * (DUR + 1.5))
mus = np.zeros(N); fx = np.zeros(N); rng = np.random.default_rng(7)
T = lambda fr: fr / FPS
def put(buf, sig, t, g=1.0):
    i = int(t * SR); n = min(len(sig), N - i)
    if n > 0 and i >= 0: buf[i:i + n] += sig[:n] * g
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)
def tone(f, dur, a=.004, d=.3, harm=(1, .35, .12)):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm)) * env(n, a, d)
def lp(x, c):
    y = np.zeros_like(x); a = 0.0
    for i in range(len(x)): a += c * (x[i] - a); y[i] = a
    return y
def hp(x, c): return x - lp(x, c)
def noise(dur, a, d): n = int(dur * SR); return rng.standard_normal(n) * env(n, a, d)
def kick(g=1):
    n = int(.4 * SR); t = np.arange(n) / SR; f = 45 + 120 * np.exp(-t * 32)
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .14)) * g
def clap(): return hp(sum(np.roll(noise(.18, .001, .05), int(k * .011 * SR)) for k in range(3)), .3)
def hat(o=False): return hp(noise(.12 if o else .04, .0005, .05 if o else .012), .6)
def whoosh(dur, up=True):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.linspace(0, 1, n); y = np.zeros(n); a = 0.0
    for i in range(n):
        c = .01 + .3 * (t[i] if up else 1 - t[i]); a += c * (x[i] - a); y[i] = a
    return y * (t ** 2 if up else (1 - t) ** 2) * 3
def boom(f0=42, dur=1.4): n = int(dur * SR); t = np.arange(n) / SR; f = f0 + 70 * np.exp(-t * 14); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .45)
def tick(f=2400): return tone(f, .03, .0005, .008, (1,))
def blip(f): return tone(f, .16, .001, .05, (1, .4, .2))

# ---------- music: darker and wider for the dark 3D world. A minor: Am F C G, one chord a bar ----------
CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
ROOT = [55, 43.65, 65.4, 49]
B0 = TL['boxes'][0]; PB = TL['pullback']
nbeats = int(T(TL['logo']) / BEAT) + 1
for b in range(nbeats):
    t = b * BEAT; fr = t * FPS; bar = b // 4; inb = b % 4; ch = CH[bar % 4]
    sec = 0 if fr < B0 else 2 if fr < PB else 1               # intro, the tour, the pull-back build
    if inb == 0:
        pad = sum(tone(f, 4 * BEAT + .4, .35, 2.0, (1, .5, .25)) for f in ch) / 3
        put(mus, lp(pad, .04 if sec == 0 else .1), t, .34)
    if sec == 2 or inb == 0: put(mus, kick(), t, .5 if sec == 2 else .35)
    if sec == 2 and inb in (1, 3): put(mus, clap(), t, .18)
    if sec >= 1:
        put(mus, lp(tone(ROOT[bar % 4] * 2, BEAT * .9, .005, .35, (1, .6, .3)), .2), t, .45)
        put(mus, lp(tone(ROOT[bar % 4] * 2, BEAT * .4, .005, .15, (1, .6, .3)), .2), t + BEAT * .75, .25)
    for h in range(4 if sec == 1 else 2):
        if sec == 0 and h == 0: continue
        put(mus, hat(sec == 2 and h == 1), t + h * BEAT / (4 if sec == 1 else 2), .05)
    arp = [ch[0] * 2, ch[2] * 2, ch[1] * 2, ch[2] * 2]
    for k in range(2): put(mus, tone(arp[(b * 2 + k) % 4], .3, .002, .1), t + k * BEAT / 2, .06 if sec else .035)

# ---------- effects, each cued to the camera ----------
put(fx, whoosh(T(TL['overview']) + .2, True), 0, .35)                 # the page rises out of the dark
put(fx, boom(40, 1.4), T(TL['overview']), .45)
for i, d in enumerate(TL['boxes']):
    put(fx, lp(whoosh(T(TL['travel']) + .1, True), .5), T(d - TL['travel']), .55)   # the glide
    put(fx, boom(46, .9), T(d), .7); put(fx, clap(), T(d), .2)                    # arrival = downbeat
    for k, f in enumerate([1318.5, 1568, 2093]): put(fx, tone(f * (1 + .03 * i), .5, .002, .18, (1, .3)), T(d + 4) + k * .05, .07)  # outline draws
    for w in range(5): put(fx, blip(880 + 110 * w), T(d - 6 + 5 * w), .045)                 # caption words
put(fx, whoosh(T(TL['travel']) + .1, False), T(PB - TL['travel']), .45)
for i in range(5): put(fx, tone(784 * 2 ** (i / 12 * 2), .25, .002, .07, (1, .3)), T(PB + i * 8), .1)   # every box lights, rising
put(fx, whoosh(.9, True), T(TL['logo']) - .9, .4)
put(fx, boom(34, 2.4), T(TL['logo']), 1.0); put(fx, clap(), T(TL['logo']), .35)
for f in [220, 261.6, 329.6, 440, 523.3, 659.3]: put(mus, tone(f, 4.5, .01, 1.6, (1, .3)), T(TL['logo']), .14)

for d in TL['boxes'] + [TL['logo']]:
    i0, i1 = int(T(d) * SR), int((T(d) + .35) * SR); mus[i0:i1] *= np.linspace(.5, 1, i1 - i0)
end = int(T(TL['logo'] + 30) * SR); mus[end:] *= np.exp(-np.arange(N - end) / SR / 1.4)
out = np.tanh(1.1 * (mus + fx)); out = out[:int(DUR * SR)]
out /= max(1e-9, np.abs(out).max()) / .89
st = np.stack([out, np.roll(out, 24)], 1)
with wave.open('public/audio/dash-raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('ok', DUR)
