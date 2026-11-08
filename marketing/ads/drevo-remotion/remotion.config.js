import path from 'path';
import { Config } from '@remotion/cli/config';

// This machine already has Playwright's Chromium; Remotion would otherwise try to download one.
Config.setBrowserExecutable('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer('swangle');

// The coach scene renders the app's REAL components (src/components/coach, src/utils/carCoach.js).
// Those files sit outside this project and the repo root has no node_modules, so they borrow ours.
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: { ...c.resolve, alias: { ...(c.resolve?.alias || {}), react: path.resolve('node_modules/react') } },
}));
