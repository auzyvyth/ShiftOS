# Poster filter, matched to the reference skits (owner, 2026-11-22: the old ink-line toon "looks burnt"):
# smooth flat bands of colour, bright + saturated, NO lines inside the car, one thin outline round it.
# python3 -I tools/toon.py in.(webp|png|jpg) out.png [--scale 4]
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

src, out = sys.argv[1], sys.argv[2]
S = int(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 4

raw = Image.open(src).convert('RGBA')
raw = raw.resize((raw.width * S, raw.height * S), Image.LANCZOS)
alpha = np.asarray(raw)[..., 3]
im = Image.new('RGB', raw.size, (255, 255, 255)); im.paste(raw, mask=raw.split()[3])
h, w = alpha.shape

# cut-out: the photo's own transparency, else near-white connected to the border
if alpha.min() < 128:
    keep = alpha >= 128
else:
    a = np.asarray(im).astype(int)
    nw = (a.min(axis=2) > 225) & (a.max(axis=2) - a.min(axis=2) < 25)
    bg = np.zeros((h, w), bool)
    q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and not bg[y, x] and nw[y, x]:
            bg[y, x] = True; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    keep = ~bg

# smooth away photo noise but keep shapes, then flatten into bands
sm = im.filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.MedianFilter(5))
sm = ImageEnhance.Color(sm).enhance(1.35)
sm = ImageEnhance.Brightness(sm).enhance(1.08)
sm = ImageEnhance.Contrast(sm).enhance(1.08)
flat = sm.quantize(colors=28, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
flat = flat.filter(ImageFilter.ModeFilter(5))
flat = Image.blend(flat, sm, 0.18)  # a little of the photo back, so it reads as a real car

m = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.MedianFilter(5))
mk = np.asarray(m) > 127
ring = (np.asarray(m.filter(ImageFilter.MaxFilter(5))) > 127) & ~mk
rgba = np.zeros((h, w, 4), 'uint8')
rgba[..., :3] = np.asarray(flat)
rgba[..., 3] = mk * 255
rgba[ring] = [22, 24, 29, 255]
Image.fromarray(rgba).save(out)
print('ok', w, h)
