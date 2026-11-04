"""How much of each frame is white, red, black (the 60/30/10 theme check).
   python3 tools/palette.py <dir of jpg stills>
White = light + low colour, red = clearly red, black = dark. Anything else (photos, app UI greys,
other hues) is 'other'. Ratios are of the whole frame."""
import sys, os, glob
import numpy as np
from PIL import Image

def classify(path):
    a = np.asarray(Image.open(path).convert('RGB').resize((270, 480))).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    white = (mn > 215) & (mx - mn < 25)
    red = (r > 120) & (r - g > 70) & (r - b > 60)
    black = (mx < 60)
    n = r.size
    return white.sum() / n, red.sum() / n, black.sum() / n

files = sorted(glob.glob(os.path.join(sys.argv[1], '*.jpg')), key=lambda p: float(os.path.basename(p).split('-', 1)[1][:-4]))
tot = np.zeros(3)
for p in files:
    w, r, k = classify(p)
    tot += (w, r, k)
    print(f"{os.path.basename(p):>14}  white {w:4.0%}  red {r:4.0%}  black {k:4.0%}  other {1-w-r-k:4.0%}")
w, r, k = tot / len(files)
print(f"{'AVERAGE':>14}  white {w:4.0%}  red {r:4.0%}  black {k:4.0%}  other {1-w-r-k:4.0%}   (target 60 / 30 / 10)")
