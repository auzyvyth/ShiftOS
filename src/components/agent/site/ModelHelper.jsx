import React, { useMemo, useState } from 'react';
import { helperModels, monthlyBands, buildQuestions, recommend, pickFacts, modelRm as rm } from '../../../utils/modelPick';

// "Not sure which model?" (PAGE-SITE 2): a few questions, then ONE model to look at
// first. The questions are built from THIS advisor's lineup (buildQuestions): the
// shapes they really sell, the fuel types they really have, a budget band cut from
// their own prices; a question the data cannot answer is not asked. The pick shows
// from the first answer and refines as the buyer answers more. Rules are in
// modelPick.js: shape, fuel and people are rules, the budget is a rule on the monthly
// estimate, "what matters most" only orders what is left, and every line under the
// pick quotes the model's own facts. Never "best", never an approval.

const LABELS = { body: 'shape', fuel: 'fuel', people: 'people' };

export default function ModelHelper({ cars, infos, firstName, hasWa, waUrlFor, onWhatsApp, onShow }) {
  const models = useMemo(() => helperModels(cars, infos), [cars, infos]);
  const bands = useMemo(() => monthlyBands(models), [models]);
  const questions = useMemo(() => buildQuestions(models, bands), [models, bands]);
  const [a, setA] = useState({});
  const answered = questions.filter((q) => a[q.id]).length;
  const res = useMemo(() => (answered ? recommend(models, a, bands) : null), [answered, models, a, bands]);
  if (models.length < 3 || questions.length < 2) return null;
  // Tapping the chosen answer again clears it.
  const set = (id) => (v) => setA((x) => ({ ...x, [id]: x[id] === v ? undefined : v }));
  const said = questions.filter((q) => a[q.id]).map((q) => `${q.q.replace(/\?$/, '')}: ${q.options.find((o) => o.id === a[q.id])?.label}`);
  return (
    <div className="ps-card ps-help" id="ap-model-help">
      <div className="ps-help-h">
        <p className="ps-lbl">Not sure which model?</p>
        <h3>Answer a few questions.</h3>
        <p>We point you to one model to look at first, from {firstName}'s list. Answer as many as you like.</p>
      </div>
      {questions.map((q) => (
        <div className="ps-q" key={q.id}>
          <p className="ps-q-l">{q.label}</p>
          <div>
            <p className="ps-q-t">{q.q}</p>
            <div className="ps-q-o" role="radiogroup" aria-label={q.q}>
              {q.options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={a[q.id] === o.id} onClick={() => set(q.id)(o.id)}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <div className="ps-help-r" aria-live="polite">
        {!res && <p className="ps-fine" style={{ margin: 0 }}>Tap an answer to see a model.</p>}
        {res?.none && (
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            None of {firstName}'s models matches all of that.
            {res.fixes?.length > 0 && <> Try changing your answer for {res.fixes.map((k) => LABELS[k]).join(' or ')}.</>}
            {' '}Or ask {firstName} what else is available.
          </p>
        )}
        {res?.pick && (
          <>
            <p className="ps-lbl">{answered < questions.length ? `Start with (from ${answered} answer${answered === 1 ? '' : 's'})` : 'Start with'}</p>
            <p className="ps-help-pick">{res.pick.name}</p>
            <p className="ps-help-facts">{pickFacts(res.pick).join(' · ')}</p>
            <p className="ps-help-price">from {rm(res.pick.from)}{res.pick.monthly ? <small> · about {rm(res.pick.monthly)} a month at 10% deposit over 7 years. An estimate: the bank decides.</small> : null}</p>
            {res.pick.electric && <p className="ps-fine" style={{ marginTop: 6 }}>An electric car needs charging at home or work. Ask {firstName} what to expect.</p>}
            {res.relaxed && <p className="ps-fine" style={{ marginTop: 6 }}>Nothing matching your other answers fits that budget, so this is the lowest-priced one that does.</p>}
            <div className="ps-btns" style={{ marginTop: 12 }}>
              <button type="button" className="ps-ghost" onClick={() => onShow(res.pick.id)}>See this model</button>
              {hasWa && (
                <a className="ps-wa" href={waUrlFor(`Hi ${firstName}, I answered the model questions on your page${said.length ? ` (${said.join('; ').toLowerCase()})` : ''}.\nIt pointed me to the ${res.pick.name}. Can you tell me more?`)}
                  target="_blank" rel="noopener noreferrer" onClick={() => onWhatsApp?.('model_helper', cars.find((c) => c.id === res.pick.id))}>
                  Ask {firstName} about it
                </a>
              )}
            </div>
            {res.others.length > 0 && (
              <p className="ps-fine" style={{ marginTop: 12 }}>Also look at: {res.others.map((m, i) => (
                <React.Fragment key={m.id}>{i ? ', ' : ''}<button type="button" className="ps-ask" onClick={() => onShow(m.id)}>{m.name}</button></React.Fragment>
              ))}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
