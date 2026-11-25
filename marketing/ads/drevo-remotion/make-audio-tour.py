# Sound for the map tour (Tour-ms / Tour-en): ONE music bed for the whole ad (no restarts at the joins), each
# clip's own effects (public/audio/<scene>-fx.wav, from its make-audio-<scene>.py) laid in where it plays, and
# tuned hits for the logo, the map, every outline and every arrival. Timing: src/tour/timeline.json.
import json, wave, numpy as np
TL = json.load(open('src/tour/timeline.json'))
FPS = TL['fps']; BEAT = 60 / TL['bpm']
# the same plan as Tour.jsx
c = TL['start']; PARTS = []
for p in TL['parts']:
    o = c; i0 = o + TL['outline']; play = i0 + TL['zoomIn']; out0 = play + p['clip']; back = out0 + TL['zoomOut']
    PARTS.append(dict(p, outline=o, inStart=i0, play=play, outStart=out0, back=back)); c = back
END = c; DURF = END + TL['endLen']; DUR = DURF / FPS
SR = 48000; N = int(SR * (DUR + 2))

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


def read(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32767
        return x.reshape(-1, w.getnchannels()).mean(1)
def playing(fr): return any(p['play'] <= fr < p['outStart'] for p in PARTS)

# ---------- one music bed: A minor, Am F C G; breathes on the map, full inside a clip ----------
CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
ROOT = [55, 43.65, 65.4, 49]
for b in range(int(DUR / BEAT) + 1):
    t = b * BEAT; fr = t * FPS; bar = b // 4; inb = b % 4; ch = CH[bar % 4]
    full = playing(fr); intro = fr < TL['start']
    if inb == 0:
        pad = sum(tone(f, 4 * BEAT + .4, .35, 2.0, (1, .5, .25)) for f in ch) / 3
        put(mus, lp(pad, .04 if intro else .1), t, .34)
    if full or inb == 0: put(mus, kick(), t, .5 if full else .33)
    if full and inb in (1, 3): put(mus, clap(), t, .17)
    if not intro:
        put(mus, lp(tone(ROOT[bar % 4] * 2, BEAT * .9, .005, .35, (1, .6, .3)), .2), t, .42 if full else .25)
    for h in range(2):
        if intro and h == 0: continue
        put(mus, hat(full and h == 1), t + h * BEAT / 2, .05 if full else .03)
    arp = [ch[0] * 2, ch[2] * 2, ch[1] * 2, ch[2] * 2]
    for k in range(2): put(mus, tone(arp[(b * 2 + k) % 4], .3, .002, .1), t + k * BEAT / 2, .06 if not intro else .035)

# ---------- the clips' own effects, cut where they play ----------
for p in PARTS:
    x = read(f"public/audio/{p['id']}-fx.wav"); a = int(p['o'] / FPS * SR); n = int(p['clip'] / FPS * SR)
    seg = x[a:a + n].copy(); r = int(.02 * SR); seg[:r] *= np.linspace(0, 1, r); seg[-r:] *= np.linspace(1, 0, r)
    put(fx, seg, p['play'] / FPS, .72 if p['id'] == 'dash' else 1.0)   # the dashboard's hits ran ~2 dB hot

# ---------- the shot's own moments ----------
NOTES = [659.3, 784, 880, 1046.5, 1174.7]
put(fx, swell(220, .5), T(TL['logo']) - .5, .2); put(fx, thock(55, 1.0), T(TL['logo']), .9); put(fx, boom(34, 1.6), T(TL['logo']), .5)
for f0 in [220, 329.6, 440, 659.3]: put(fx, bell(f0 * 2, 2.0), T(TL['logo']), .04)
for i in range(5): put(fx, tick(2200 + 200 * i), T(TL['mapLines'] + 4 * i), .05)         # branches draw
for i, at in enumerate(TL['mapNodes']): put(fx, bell(NOTES[i], .7), T(at), .1); put(fx, thock(NOTES[i] / 4, .7), T(at), .35)  # parts pop
for i, p in enumerate(PARTS):
    put(fx, bell(NOTES[i], .9), T(p['outline']), .12); put(fx, thock(NOTES[i] / 2, .6), T(p['outline']), .3)   # outlined
    put(fx, swell(NOTES[i] / 2, T(TL['zoomIn'])), T(p['inStart']), .16)                                        # glide in
    put(fx, thock(NOTES[i] / 4), T(p['play']), .7)                                                              # land inside
    put(fx, swell(NOTES[i], T(TL['zoomOut']))[::-1] * .6, T(p['outStart']), .12)                                # glide out: the swell undone
put(fx, swell(220, .6), T(END) - .6, .2); put(fx, thock(55, 1.0), T(END), 1.0); put(fx, boom(34, 2.4), T(END), .55)
for f0 in [220, 261.6, 329.6, 440, 523.3, 659.3]: put(mus, tone(f0, 4.0, .01, 1.5, (1, .3)), T(END), .12)
for w in range(4): put(fx, bloop(1200 + 90 * w), T(END + 8 + 3 * w), .035)
for d in [p['play'] for p in PARTS] + [END]:
    i0, i1 = int(T(d) * SR), int((T(d) + .35) * SR); mus[i0:i1] *= np.linspace(.5, 1, i1 - i0)
e = int(T(END + 40) * SR); mus[e:] *= np.exp(-np.arange(N - e) / SR / 1.2)
out = np.tanh(1.1 * (mus + fx)); out = out[:int(DUR * SR)]; out /= max(1e-9, np.abs(out).max()) / .89
st = np.stack([out, np.roll(out, 24)], 1)
with wave.open('public/audio/tour-raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('ok', DUR)
