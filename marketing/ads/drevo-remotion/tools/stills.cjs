// One still per moment, from one bundle (seconds, not frames). Much faster than `remotion still` per frame.
//   node tools/stills.cjs <Composition-prefix> <lang> <outDir> <sec...>
//   node tools/stills.cjs Renewals ms out/stills 3.5 6.5 10.5
//   node tools/stills.cjs DrevoAd en out/stills 2 12
// Then: python3 tools/palette.py out/stills   (the 60/30/10 check)
const path = require('path');
const fs = require('fs');
const dir = path.resolve(__dirname, '..');
const { bundle } = require(path.join(dir, 'node_modules/@remotion/bundler'));
const { selectComposition, renderStill } = require(path.join(dir, 'node_modules/@remotion/renderer'));
(async () => {
  const [, , comp, lang, out, ...secs] = process.argv;
  if (!comp || !lang || !out || !secs.length) { console.error('usage: node tools/stills.cjs <Comp> <lang> <outDir> <sec...>'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  // the same React alias as remotion.config.js (the repo root has no node_modules)
  const serveUrl = await bundle({ entryPoint: path.join(dir, 'src/index.js'), publicDir: path.join(dir, 'public'),
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias || {}), react: path.join(dir, 'node_modules/react') } } }) });
  const browserExecutable = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
  const inputProps = { lang, audio: false };
  const composition = await selectComposition({ serveUrl, id: `${comp}-${lang}`, inputProps, browserExecutable });
  for (const s of secs) {
    await renderStill({ serveUrl, composition, frame: Math.round(+s * 30), output: path.join(out, `${comp}-${lang}-${s}.jpg`),
      imageFormat: 'jpeg', jpegQuality: 85, inputProps, browserExecutable, chromiumOptions: { gl: 'swangle' } });
    console.log('still', comp, lang, s);
  }
})().catch((e) => { console.error(e); process.exit(1); });
