import React from 'react';
import { Composition } from 'remotion';
import { Ad } from './Ad';
import { FPS, W, H, DUR, sec } from './lib';
import { RenewalsAd, R_DUR } from './renewals/Renewals';
import { Sizzle, S_FPS, S_DUR } from './sizzle/Sizzle';
import { CalcAd, C_FPS, C_DUR } from './calc2/CalcAd';
import { Counts, N_FPS, N_DUR } from './counts/Counts';
import { DashPan, D_FPS, D_DUR } from './dash/DashPan';

export const Root = () => (
  <>
    <Composition id="DrevoAd-ms" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="DrevoAd-en" component={Ad} durationInFrames={sec(DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Renewals-ms" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'ms' }} />
    <Composition id="Renewals-en" component={RenewalsAd} durationInFrames={sec(R_DUR)} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' }} />
    <Composition id="Sizzle" component={Sizzle} durationInFrames={S_DUR} fps={S_FPS} width={1080} height={1920} defaultProps={{ audio: true }} />
    <Composition id="CalcAd-ms" component={CalcAd} durationInFrames={C_DUR} fps={C_FPS} width={1080} height={1920} defaultProps={{ audio: true }} />
    <Composition id="Counts" component={Counts} durationInFrames={N_DUR} fps={N_FPS} width={1080} height={1920} defaultProps={{ audio: true }} />
    <Composition id="DashPan-ms" component={DashPan} durationInFrames={D_DUR} fps={D_FPS} width={1080} height={1920} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="DashPan-en" component={DashPan} durationInFrames={D_DUR} fps={D_FPS} width={1080} height={1920} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="CalcAd-vo" component={CalcAd} durationInFrames={C_DUR} fps={C_FPS} width={1080} height={1920} defaultProps={{ audio: true, vo: true }} />
  </>
);
