import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame } from 'remotion';
import { TL, FPS, OV, OVERLAP, sec } from './lib';
import { Ambient } from './ui';
import { HookCalc, Budget } from './scenes/Presenter';
import { Leads, Stats, Studio, Posters, Page, Devices, Cta, OfferPill } from './scenes/Features';

const S = ({ k, children }) => {
  const ov = OVERLAP.includes(k) ? OV : 0;
  return <Sequence from={sec(TL[k][0] - ov)} durationInFrames={sec(TL[k][1] - TL[k][0] + ov)} name={k}>{children}</Sequence>;
};

export const Ad = ({ lang = 'ms', audio = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#050608', overflow: 'hidden' }}>
      <Ambient />
      <Sequence from={0} durationInFrames={sec(TL.calc[1])} name="hook+calc"><HookCalc lang={lang} /></Sequence>
      <S k="budget"><Budget lang={lang} /></S>
      <S k="leads"><Leads lang={lang} /></S>
      <S k="stats"><Stats lang={lang} /></S>
      <S k="studio"><Studio lang={lang} /></S>
      <S k="posters"><Posters lang={lang} /></S>
      <S k="page"><Page lang={lang} /></S>
      <S k="devices"><Devices lang={lang} /></S>
      <S k="cta"><Cta lang={lang} /></S>
      <OfferPill lang={lang} t={f / FPS} />
      {audio && <Audio src={staticFile(`audio/mix-${lang}.wav`)} />}
    </AbsoluteFill>
  );
};
