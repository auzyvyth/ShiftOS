# Toon filter: python3 -I toon.py in.webp out.png  (white-background car photo -> cartoon cut-out)
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
raw = Image.open(src).convert('RGBA')
S = 4
raw = raw.resize((raw.width * S, raw.height * S), Image.LANCZOS)
alpha = np.asarray(raw)[..., 3]
im = Image.new('RGB', raw.size, (255, 255, 255)); im.paste(raw, mask=raw.split()[3])
a = np.asarray(im).astype(int)
h, w, _ = a.shape

# background = near-white pixels connected to the border (flood fill), so white parts INSIDE the car stay
near_white = (a.min(axis=2) > 225) & (a.max(axis=2) - a.min(axis=2) < 25)
bg = np.zeros((h, w), bool)
q = deque() if alpha.min() < 128 else deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
while q:
    y, x = q.popleft()
    if 0 <= y < h and 0 <= x < w and not bg[y, x] and near_white[y, x]:
        bg[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
if alpha.min() < 128: bg = alpha < 128  # photo already cut out
mask = Image.fromarray((~bg * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MedianFilter(7))

# flat colours: smooth, then quantize to a small palette, push saturation a bit
sm = im.filter(ImageFilter.MedianFilter(11)).filter(ImageFilter.ModeFilter(9)).filter(ImageFilter.MedianFilter(7))
flat = sm.quantize(colors=10, method=Image.Quantize.MEDIANCUT).convert('RGB')
f = np.asarray(flat).astype(float)
grey = f.mean(axis=2, keepdims=True)
f = np.clip(grey + (f - grey) * 1.25, 0, 255)

# ink lines: edges of the flat image + the silhouette
edges = flat.convert('L').filter(ImageFilter.FIND_EDGES)
ink = (np.asarray(edges) > 45)
ink = np.asarray(Image.fromarray((ink * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
m = np.asarray(mask) > 127
outline = np.asarray(mask.filter(ImageFilter.MaxFilter(11))) > 127
f[ink] = [22, 24, 29]
rgba = np.zeros((h, w, 4), 'uint8')
rgba[..., :3] = f.astype('uint8')
rgba[..., 3] = (m * 255)
ring = outline & ~m
rgba[ring] = [22, 24, 29, 255]
Image.fromarray(rgba).save(out)
print('ok', w, h)
