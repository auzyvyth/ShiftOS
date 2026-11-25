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

# ---------- effects: no noise whooshes. Every hit is a TUNED sound that sits in the key ----------
def thock(f, g=1.0):
    """A solid, satisfying tap: a pitched body that drops into place, a click on top, a little weight under."""
    n = int(.22 * SR); t = np.arange(n) / SR
    fr = f * (1 + .5 * np.exp(-t * 70)); body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / .05)
    clk = hp(noise(.012, .0002, .002), .5)[:n]; out = body.copy(); out[:len(clk)] += clk * .6
    sub = np.sin(2 * np.pi * np.cumsum(f / 4 * (1 + np.exp(-t * 40))) / SR) * np.exp(-t / .09)
    return (out + .7 * sub) * g
def bell(f, dur=1.1):
    """Glassy pluck (FM): bright on the strike, rings out pure."""
    n = int(dur * SR); t = np.arange(n) / SR; idx = 2.2 * np.exp(-t * 9)
    return np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 2.0 * t)) * env(n, .001, dur / 3.2)
def swell(f, dur=.3):
    """A reversed bell that swells INTO the hit, so the ear expects it."""
    x = bell(f, dur)[::-1]; return x * np.linspace(0, 1, len(x)) ** 2
def bloop(f): n = int(.05 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(f * (1 + .6 * t / .05)) / SR) * np.exp(-t / .015)

NOTES = [659.3, 784, 880, 1046.5, 1174.7]                 # A minor pentatonic, one step up per box
put(fx, swell(440, .6), T(TL['overview']) - .6, .25); put(fx, thock(110), T(TL['overview']), .55); put(fx, bell(440, 1.6), T(TL['overview']), .14)
for i, d in enumerate(TL['boxes']):
    n0 = NOTES[i]
    put(fx, swell(n0, T(TL['travel'])), T(d) - T(TL['travel']), .16)   # glide = a swell, not a whoosh
    put(fx, thock(n0 / 4), T(d), .75)                                  # the box lands
    put(fx, bell(n0), T(d), .17); put(fx, bell(n0 * 1.5, .7), T(d + 3), .06)   # the outline rings
    for w in range(5): put(fx, bloop(1200 + 90 * w), T(d - TL['travel'] + 3 * w), .035)  # caption words
for i in range(5): put(fx, bell(NOTES[i] * 2, .6), T(TL['pullback'] + i * 4), .08); put(fx, thock(NOTES[i] / 2), T(TL['pullback'] + i * 4), .25)
put(fx, swell(220, .8), T(TL['logo']) - .8, .25)
put(fx, thock(55, 1.0), T(TL['logo']), 1.0); put(fx, boom(34, 2.0), T(TL['logo']), .5)
for f in [220, 261.6, 329.6, 440, 523.3, 659.3]: put(mus, tone(f, 4.5, .01, 1.6, (1, .3)), T(TL['logo']), .14); put(fx, bell(f * 2, 2.5), T(TL['logo']), .03)

for d in TL['boxes'] + [TL['logo']]:
    i0, i1 = int(T(d) * SR), int((T(d) + .35) * SR); mus[i0:i1] *= np.linspace(.5, 1, i1 - i0)
end = int(T(TL['logo'] + 30) * SR); mus[end:] *= np.exp(-np.arange(N - end) / SR / 1.4)
out = np.tanh(1.1 * (mus + fx)); out = out[:int(DUR * SR)]
out /= max(1e-9, np.abs(out).max()) / .89
st = np.stack([out, np.roll(out, 24)], 1)
with wave.open('public/audio/dash-raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('ok', DUR)
