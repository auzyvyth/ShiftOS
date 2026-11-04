import React from 'react';
import { Composition } from 'remotion';
import { Ad } from './Ad';
import { FPS, W, H, DUR, sec } from './lib';
import { RenewalsAd, R_DUR } from './renewals/Renewals';
import { IntroAd, I_DUR } from './intro/Intro';

export const Root = () => (
  <>
    <Composition id="DrevoAd-ms" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="DrevoAd-en" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Renewals-ms" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Renewals-en" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Intro-ms" component={IntroAd} durationInFrames={sec(I_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Intro-en" component={IntroAd} durationInFrames={sec(I_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
  </>
);
