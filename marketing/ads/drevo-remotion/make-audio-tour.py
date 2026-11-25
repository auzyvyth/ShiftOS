# Sound for the joined Premium tour (Tour-ms / Tour-en): each scene's own mix (public/audio/<scene>.wav),
# cut on the same bar lines as src/tour/timeline.json, a short crossfade at every join, a hit for every red
# chapter card, and a sting on the end card. Run after every scene's make-audio-<scene>.py.
import json, wave, numpy as np
TL = json.load(open('src/tour/timeline.json'))
SR = 48000; FPS = TL['fps']; T = lambda fr: fr / FPS
total = sum(g['len'] for g in TL['segments']); N = int(T(total) * SR) + SR * 2
out = np.zeros((N, 2)); rng = np.random.default_rng(11)
def read(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32767
        return x.reshape(-1, w.getnchannels())
def put(sig, t, g=1.0):
    i = int(t * SR); sig = sig if sig.ndim == 2 else np.stack([sig, sig], 1); n = min(len(sig), N - i)
    out[i:i + n] += sig[:n] * g
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)
def tone(f, dur, a=.004, d=.3): n = int(dur * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * env(n, a, d)
def thock(f, g=1.0):
    n = int(.22 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + .5 * np.exp(-t * 70))) / SR) * np.exp(-t / .05)
    sub = np.sin(2 * np.pi * np.cumsum(f / 4 * (1 + np.exp(-t * 40))) / SR) * np.exp(-t / .09)
    return (body + .7 * sub) * g
def boom(f0=40, dur=1.2): n = int(dur * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(f0 + 70 * np.exp(-t * 14)) / SR) * env(n, .002, .4)
def bell(f, dur=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t * 9) * np.sin(4 * np.pi * f * t)) * env(n, .001, dur / 3.2)
def snap():  # the card's crack: a bright filtered click
    x = rng.standard_normal(int(.06 * SR)) * env(int(.06 * SR), .0005, .012); y = x - np.convolve(x, np.ones(6) / 6, 'same'); return y

at = 0; XF = int(.012 * SR)
for k, g in enumerate(TL['segments']):
    a, n = int(T(at) * SR), int(T(g['len']) * SR)
    if g['id'] != 'end':
        x = read(f"public/audio/{g['id']}.wav")[:n].copy()
        if k: x[:XF] *= np.linspace(0, 1, XF)[:, None]
        x[-XF:] *= np.linspace(1, 0, XF)[:, None]
        out[a:a + len(x)] += x
    if g['topic']:   # red chapter card: a hard, satisfying hit on the downbeat
        put(thock(55), T(at), .8); put(boom(38, .9), T(at), .45); put(snap(), T(at), .35); put(bell(880, .6), T(at), .1)
    at += g['len']
# end card: the logo lands, a chord blooms, the caption words pop
e = T(at - TL['segments'][-1]['len'])
put(thock(55), e, 1.0); put(boom(34, 2.4), e, .6)
for f in [220, 261.6, 329.6, 440, 523.3, 659.3]: put(tone(f, 3.2, .01, 1.3), e, .1); put(bell(f * 2, 2.2), e, .03)
for w in range(4): put(tone(1200 + 90 * w, .05, .001, .015), e + T(8 + 3 * w), .05)
out = np.tanh(out * 1.05); out /= np.abs(out).max() / .89
out = out[:int(T(total) * SR)]
with wave.open('public/audio/tour-raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('ok', T(total))
