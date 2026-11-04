import React from 'react';
import { Composition } from 'remotion';
import { Ad } from './Ad';
import { FPS, W, H, DUR, sec } from './lib';
import { RenewalsAd, R_DUR } from './renewals/Renewals';
import { IntroAd, I_DUR } from './intro/Intro';
import { RatesAd, R_DUR } from './rates/Rates';
import { LiveAd, L_DUR, LP_DUR } from './live/Live';

export const Root = () => (
  <>
    <Composition id="DrevoAd-ms" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="DrevoAd-en" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="LivePromote-ms" component={LiveAd} durationInFrames={sec(LP_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true, promote: true }} />
    <Composition id="LivePromote-en" component={LiveAd} durationInFrames={sec(LP_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true, promote: true }} />
    <Composition id="Renewals-ms" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Renewals-en" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Intro-ms" component={IntroAd} durationInFrames={sec(I_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Intro-en" component={IntroAd} durationInFrames={sec(I_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Rates-ms" component={RatesAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Rates-en" component={RatesAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Live-ms" component={LiveAd} durationInFrames={sec(L_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Live-en" component={LiveAd} durationInFrames={sec(L_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
  </>
);
