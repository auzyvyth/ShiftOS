import React from 'react';
import { Composition } from 'remotion';
import { Ad } from './Ad';
import { FPS, W, H, DUR, sec } from './lib';
import { RenewalsAd, R_DUR } from './renewals/Renewals';
import { LiveAd, L_DUR } from './live/Live';

export const Root = () => (
  <>
    <Composition id="DrevoAd-ms" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="DrevoAd-en" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Renewals-ms" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms' }} />
    <Composition id="Renewals-en" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' }} />
    <Composition id="Live-ms" component={LiveAd} durationInFrames={sec(L_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: false }} />
    <Composition id="Live-en" component={LiveAd} durationInFrames={sec(L_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: false }} />
  </>
);
