import React from 'react';
import { Composition } from 'remotion';
import { Ad } from './Ad';
import { FPS, W, H, DUR, sec } from './lib';
import { RenewalsAd, R_DUR } from './renewals/Renewals';
import { Sizzle, S_FPS, S_DUR } from './sizzle/Sizzle';
import { CalcAd, C_FPS, C_DUR } from './calc2/CalcAd';
import { Counts, N_FPS, N_DUR } from './counts/Counts';
import { DashPan, D_FPS, D_DUR } from './dash/DashPan';
import { LoanScene, L_FPS, L_DUR } from './loan/LoanScene';
import { BrokerScene, B_FPS, B_DUR } from './broker/BrokerScene';
import { MiniScene, M_FPS, M_DUR } from './mini/MiniScene';
import { LiveScene, V_FPS, V_DUR } from './live/LiveScene';

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
    <Composition id="Loan-ms" component={LoanScene} durationInFrames={L_DUR} fps={L_FPS} width={1080} height={1920} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Loan-en" component={LoanScene} durationInFrames={L_DUR} fps={L_FPS} width={1080} height={1920} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Broker-ms" component={BrokerScene} durationInFrames={B_DUR} fps={B_FPS} width={1080} height={1920} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Broker-en" component={BrokerScene} durationInFrames={B_DUR} fps={B_FPS} width={1080} height={1920} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Mini-ms" component={MiniScene} durationInFrames={M_DUR} fps={M_FPS} width={1080} height={1920} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Mini-en" component={MiniScene} durationInFrames={M_DUR} fps={M_FPS} width={1080} height={1920} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="Live-ms" component={LiveScene} durationInFrames={V_DUR} fps={V_FPS} width={1080} height={1920} defaultProps={{ lang: 'ms', audio: true }} />
    <Composition id="Live-en" component={LiveScene} durationInFrames={V_DUR} fps={V_FPS} width={1080} height={1920} defaultProps={{ lang: 'en', audio: true }} />
    <Composition id="CalcAd-vo" component={CalcAd} durationInFrames={C_DUR} fps={C_FPS} width={1080} height={1920} defaultProps={{ audio: true, vo: true }} />
  </>
);
