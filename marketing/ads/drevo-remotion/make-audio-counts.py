# Sound for the Counts scene: an original beat mixed TO the picture. Every hit is cued from
# src/counts/timeline.json (frames), and the music grid is the same 112.5 bpm the picture is
# built on, so each slam, chip, scan and digit roll lands on a beat. Writes public/audio/counts.wav.
import json, wave, numpy as np
TL = json.load(open('src/counts/timeline.json'))
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

# ---------- music: F minor, Fm Db Ab Eb, one chord a bar (a bar = 64 frames = 4 beats) ----------
CH = [[174.6, 207.7, 261.6], [138.6, 174.6, 207.7], [207.7, 261.6, 311.1], [155.6, 196, 233.1]]
ROOT = [43.65, 34.65, 51.9, 38.9]
nbeats = int(T(TL['logo']) / BEAT) + 1
for b in range(nbeats):
    t = b * BEAT; fr = t * FPS; bar = b // 4; inb = b % 4; ch = CH[bar % 4]
    sec = 0 if fr < TL['chips'][0] else 1 if fr < TL['pill'] else 2     # intro, build, drop
    if inb == 0:
        pad = sum(tone(f, 4 * BEAT + .3, .3, 1.8, (1, .5, .2)) for f in ch) / 3
        put(mus, lp(pad, .05 if sec == 0 else .12), t, .32)
    if sec >= 1 or inb in (0, 2): put(mus, kick(), t, .5 if sec == 2 else .32)
    if sec == 2 and inb in (1, 3): put(mus, clap(), t, .22)
    if sec == 2:
        put(mus, lp(tone(ROOT[bar % 4] * 2, BEAT * .9, .005, .35, (1, .6, .3)), .2), t, .5)
        put(mus, lp(tone(ROOT[bar % 4] * 2, BEAT * .4, .005, .15, (1, .6, .3)), .2), t + BEAT * .75, .3)
    for h in range(2 if sec == 0 else 4 if sec == 1 else 2):          # 16ths in the build
        if sec == 0 and h == 0: continue
        put(mus, hat(sec == 2 and h == 1), t + h * BEAT / (4 if sec == 1 else 2), .05 + (.04 if sec == 1 else .02))
    arp = [ch[0] * 2, ch[2] * 2, ch[1] * 2, ch[2] * 2]
    for k in range(2): put(mus, tone(arp[(b * 2 + k) % 4], .25, .002, .08), t + k * BEAT / 2, .06 if sec else .04)

# ---------- effects, each cued to the picture ----------
put(fx, whoosh(.35, False), 0, .5)                                     # the opening blocks uncover
for w in TL['words']: put(fx, blip(880 + 40 * w % 200), T(w), .08)    # word pops
for c in TL['chips']:
    for k in range(14):                                                # scramble: a run of tiny ticks
        put(fx, tick(1800 + rng.integers(0, 1600)), T(c + k), .07)
    put(fx, tone(1318, .2, .001, .06, (1, .3)), T(c + 14), .12)          # settle
for i, s in enumerate(TL['scan']): put(fx, blip([523.3, 659.3, 784][i] * 2), T(s), .16)  # scan rises C E G
put(fx, whoosh(T(TL['pill']) - T(TL['lines']) + .25, True), T(TL['lines']) - .25, .45)    # riser into the slam
put(fx, boom(), T(TL['pill']), .9); put(fx, clap(), T(TL['pill']), .4)                  # THE SLAM
put(fx, hp(noise(1.2, .002, .35), .4), T(TL['pill']), .14)                               # crash
# count-up: one tick every time the shown number changes, so the ticks slow down with the digits
from math import pow
def ease(x):  # cubic-bezier(.05,.7,.1,1) approximated by solving numerically
    lo, hi = 0.0, 1.0
    for _ in range(30):
        m = (lo + hi) / 2; bx = 3*(1-m)**2*m*.05 + 3*(1-m)*m**2*.1 + m**3
        lo, hi = (m, hi) if bx < x else (lo, m)
    m = (lo + hi) / 2; return 3*(1-m)**2*m*.7 + 3*(1-m)*m**2*1 + m**3
rate = round(212 / 3410 * 1000) / 10; last = None; a0, a1 = TL['pill'] + 4, TL['countEnd']
for k in range(int((a1 - a0) / FPS * SR / 400)):
    tt = a0 / FPS + k * 400 / SR; x = (tt * FPS - a0) / (a1 - a0)
    if x > 1: break
    v = round(rate * ease(max(0, x)) * 10)
    if v != last: put(fx, tick(2600), tt, .1); last = v
for f, g in [(1046.5, .2), (1318.5, .15), (1568, .12)]: put(fx, tone(f, 1.2, .002, .4, (1, .25)), T(a1), g)  # landed
for wi in [TL['wipeStats'], TL['wipeEnd']]: put(fx, whoosh(.38, True), T(wi), .5)
for i, s in enumerate(TL['stats']):
    put(fx, boom(48, .8), T(s), .6); put(fx, clap(), T(s), .25)
    put(fx, lp(whoosh(.45, False), .6), T(s), .35)                     # odometer whir
    put(fx, tone([784, 880, 988, 1175][i], .5, .002, .15, (1, .3)), T(s + 12), .12)  # digits lock
put(fx, boom(36, 2.2), T(TL['logo']), 1.0); put(fx, clap(), T(TL['logo']), .4)
for k in range(12): put(fx, tone(2093 * (1 + k * .06), .3, .001, .08, (1,)), T(TL['logo']) + k * .015, .05)  # dot burst
for f in [174.6, 207.7, 261.6, 349.2, 523.3, 622.3]: put(mus, tone(f, 4, .01, 1.4, (1, .3)), T(TL['logo']), .14)
for w in TL['tagline']: put(fx, blip(1046.5), T(w), .07)

# ducks: music dips under every slam so the hit reads
for d in [TL['pill'], TL['logo']] + TL['stats']:
    i0, i1 = int(T(d) * SR), int((T(d) + .35) * SR); mus[i0:i1] *= np.linspace(.45, 1, i1 - i0)
end = int(T(TL['logo'] + 30) * SR); mus[end:] *= np.exp(-np.arange(N - end) / SR / 1.2)
out = np.tanh(1.1 * (mus + fx)); out = out[:int(DUR * SR)]
out /= max(1e-9, np.abs(out).max()) / .89
st = np.stack([out, np.roll(out, 24)], 1)
with wave.open('public/audio/counts-raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('ok', DUR)
