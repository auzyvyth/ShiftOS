# Drevo Premium ad (BM + EN, 47.5 s, 1080x1920, 30 fps)

`sh build.sh /tmp/drevo-ad` renders both cuts: drevo-premium-ms.mp4, drevo-premium-en.mp4.

- `index.html` + `film.js`: the picture. `render(t)` draws any frame; open index.html in a browser to watch it loop. All words (BM + EN) are in `COPY` at the top of film.js.
- `score.py`: the original 120 BPM score + sound effects, placed from the picture's cue list (`window.EV`).
- `render.cjs`: Playwright frame capture (`stills`, `frames`, `events`).
- Timeline: hook split-screen 0-4 s, calculator 4-8, budget/DSR 8-12, leads 12-20, listings 20-23, Studio 23-31, posters 31-35, mini page 35-41, devices 41-43, CTA 43-47.5.
