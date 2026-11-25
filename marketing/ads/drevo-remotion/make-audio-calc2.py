# Sound for the calculator ad v2: original music bed + effects, all cued from src/calc2/timeline.json
# and the recorded taps. Writes public/audio/calc2.wav. Run: python3 make-audio-calc2.py
import json, wave, numpy as np
TL = json.load(open('src/calc2/timeline.json'))
B = {b[0]: b[1] for b in TL['beats']}; H = TL['hits']
SR = 48000; N = int(SR * TL['dur']) + SR; mus = np.zeros(N); fx = np.zeros(N)
rng = np.random.default_rng(3)
def put(buf, sig, t, g=1.0):
    i = int(t * SR); n = min(len(sig), N - i)
    if n > 0: buf[i:i + n] += sig[:n] * g
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)
def tone(f, dur, a=0.005, d=0.3, harm=(1, .35, .12)):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm)) * env(n, a, d)
def lp(x, c):
    y = np.zeros_like(x); a = 0.0
    for i in range(len(x)): a += c * (x[i] - a); y[i] = a
    return y
def noise(dur, a, d): n = int(dur * SR); return rng.standard_normal(n) * env(n, a, d)
def kick():
    n = int(.35 * SR); t = np.arange(n) / SR; f = 48 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .12)
def whoosh(dur, up=True):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.linspace(0, 1, n); y = np.zeros(n); a = 0.0
    for i in range(n):
        c = 0.015 + 0.22 * (t[i] if up else 1 - t[i]); a += c * (x[i] - a); y[i] = a
    return y * np.sin(np.pi * t) ** 2 * 3
def boom(f0=50, dur=1.0): n = int(dur * SR); t = np.arange(n) / SR; f = f0 + 90 * np.exp(-t * 20); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .3)
def pop(f=900): return tone(f, .12, .001, .03, (1, .2))
def click(): return lp(noise(.03, .0005, .006), .5)

# ---- music: 104 bpm, Am F C G; sparse in the Excel act, full from the phone, dips on transitions
bpm = 104; beat = 60 / bpm
chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
t = 0.0; k = 0
while t < TL['dur'] - 0.2:
    bar = int(t / (4 * beat)); ch = chords[bar % 4]; inbar = k % 4
    full = t >= H['phone'] and t < H['wipe']
    if inbar == 0:
        pad = sum(tone(f * 0.5, 4 * beat, .25, 1.6, (1, .5, .25, .1)) for f in ch) / 3
        put(mus, lp(pad, .08), t, .5 if full else .35)
    if full or t > B['retype']:
        put(mus, kick(), t, .55 if full else .3)
    if full and inbar in (1, 3): put(mus, lp(noise(.08, .001, .02), .9) - lp(noise(.08, .001, .02), .2), t + beat / 2, .08)
    arp = ch[(k * 2) % 3] * (2 if full else 1)
    put(mus, tone(arp, .3, .002, .09), t, .10); put(mus, tone(ch[(k * 2 + 1) % 3] * 2, .3, .002, .09), t + beat / 2, .07 if full else .04)
    t += beat; k += 1
# end sting: big chord on the logo, music out under it
for f in [220, 277.2, 329.6, 440, 554.4, 659.3]: put(mus, tone(f, 3.2, .01, 1.2, (1, .3)), H['logo'], .12)
for d in [H['crumple'], H['flip'], H['wipe']]:  # ducks
    i0, i1 = int((d - .15) * SR), int((d + .5) * SR); mus[i0:i1] *= np.linspace(.35, 1, i1 - i0)
mus[int(H['wipe'] * SR):] *= np.exp(-np.arange(N - int(H['wipe'] * SR)) / SR / 2.5)

# ---- optional licensed track replaces the synth bed: --track <file> [--track-start <sec>]
import sys as _s
if '--track' in _s.argv:
    import subprocess as _sp
    path = _s.argv[_s.argv.index('--track') + 1]
    st = float(_s.argv[_s.argv.index('--track-start') + 1]) if '--track-start' in _s.argv else 0.0
    raw = _sp.run(['ffmpeg', '-v', 'error', '-ss', str(st), '-i', path, '-t', str(TL['dur'] + 1), '-ac', '1', '-ar', str(SR),
                   '-af', 'loudnorm=I=-20', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    trk = np.frombuffer(raw, dtype='<f4').astype(float)
    mus = np.zeros(N); mus[:min(N, len(trk))] = trk[:N] * 1.6
    mus[:int(.4 * SR)] *= np.linspace(0, 1, int(.4 * SR))
    for d in [H['crumple'], H['flip'], H['wipe']]:  # same dips as the synth bed
        i0, i1 = int((d - .15) * SR), int((d + .5) * SR); mus[i0:i1] *= np.linspace(.4, 1, i1 - i0)
    e0 = int((TL['dur'] - 2.2) * SR); mus[e0:] *= np.linspace(1, 0, N - e0)

# ---- effects
put(fx, whoosh(.5, False), 0.0, .5); put(fx, boom(70, .7), H['drop'], .7); put(fx, click(), H['drop'], .5)
put(fx, whoosh(.3), H['tag'] - .3, .4); put(fx, lp(noise(.12, .001, .02), .6), H['tag'], 1.2); put(fx, boom(120, .3), H['tag'], .4)
for i in range(6): put(fx, pop(700 + i * 90), B['excel3'] + .1 + i * .18, .35)
for i in range(5): put(fx, click(), B['retype'] + i * .12, .9)
for i in range(6): put(fx, pop(500 + (i % 3) * 120), B['flood'] + .15 + i * .3, .45)
put(fx, lp(noise(.5, .01, .15), .3), H['crumple'], .9); put(fx, whoosh(.6, False), H['crumple'] + .1, .6)
put(fx, whoosh(.7), H['phone'] - .5, .7); put(fx, boom(55, 1.1), H['phone'] + .15, .8)
for take, at in TL['takes'].items():
    for c in json.load(open(f'src/calc2/{take}-ms.clicks.json'))['clicks']:
        put(fx, click(), at + c['t'], 1.0); put(fx, tone(1800, .05, .0005, .01, (1,)), at + c['t'], .12)
for at in [B['calc'] + .95, B['calc'] + 2.15, B['calc'] + 3.45, B['calc2'] + .3, B['budget'] + .7, B['budget'] + 2.7, B['viewer'] + .7, B['next'] + .9]:
    put(fx, whoosh(.18), at - .12, .25); put(fx, pop(1100), at, .4)
put(fx, whoosh(.8), H['flip'] - .3, .7); put(fx, whoosh(.4), H['swipe'] - .2, .5)
put(fx, whoosh(.5), B['plans'], .5); put(fx, whoosh(.5), B['plans'] + .35, .5)
put(fx, whoosh(.6), H['wipe'] - .3, .6); put(fx, boom(45, 1.6), H['logo'], 1.0)
for i in range(4): put(fx, tone(880 * 2 ** ([0, 4, 7, 12][i] / 12), .4, .002, .15), H['logo'] + .6 + i * .07, .1)

# optional English voice-over (make-vo-calc2.py): music ducks under each line, effects drop a little
import sys, os
VO = '--vo' in sys.argv
if VO:
    import soundfile as sf
    vo = sf.read('public/audio/calc2-vo.wav')[0][:, 0]
    vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
    duck = np.ones(N)
    for st, en in json.load(open('public/audio/calc2-vo.json')):
        i0, i1 = int((st - .12) * SR), int((en + .15) * SR)
        duck[max(0, i0):i1] = 0.28
    duck = np.convolve(duck, np.ones(2400) / 2400, mode='same')  # 50 ms fades
    out = mus * .55 * duck + fx * .6 * (0.55 + 0.45 * duck) + vo * 1.0
else:
    out = mus * .55 + fx * .6
out = out[:int(SR * TL['dur'])]; out /= np.max(np.abs(out)) * 1.05
pcm = (np.stack([out, out], 1) * 32767).astype('<i2')
w = wave.open(_s.argv[_s.argv.index('--out') + 1] if '--out' in _s.argv else ('public/audio/calc2-vo-mix.wav' if VO else 'public/audio/calc2.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
print('vo mix' if VO else 'music + fx', round(len(out) / SR, 2), 's')
