import React, { useMemo, useState } from 'react';
import { helperModels, monthlyBands, recommend, pickFacts, PEOPLE, USES, modelRm as rm } from '../../../utils/modelPick';

// "Not sure which model?" (PAGE-SITE 2): three questions about who rides along, how
// the car is used and the monthly budget, then ONE model to look at first. The rules
// are in modelPick.js: seats and the budget band are rules, the use only orders what
// is left, and every line under the pick quotes the model's own facts. Never "best",
// never an approval: the money line is the page's usual estimate. The budget bands
// come from this advisor's own models, so they fit a Perodua or a Toyota list alike.

function Row({ label, q, options, value, onPick }) {
  return (
    <div className="ps-q">
      <p className="ps-q-l">{label}</p>
      <div>
        <p className="ps-q-t">{q}</p>
        <div className="ps-q-o" role="radiogroup" aria-label={q}>
          {options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onPick(o.id)}>{o.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ModelHelper({ cars, infos, firstName, hasWa, waUrlFor, onWhatsApp, onShow }) {
  const models = useMemo(() => helperModels(cars, infos), [cars, infos]);
  const bands = useMemo(() => monthlyBands(models), [models]);
  const [a, setA] = useState({});
  const ready = a.people && a.use && (!bands || a.budget);
  const res = useMemo(() => (ready ? recommend(models, a, bands) : null), [ready, models, a, bands]);
  if (models.length < 3) return null;
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v }));
  const bandLabel = bands?.find((b) => b.id === a.budget)?.label;
  const words = `${PEOPLE.find((p) => p.id === a.people)?.label || ''}, ${(USES.find((u) => u.id === a.use)?.label || '').toLowerCase()}${bandLabel ? `, budget ${bandLabel.toLowerCase()} a month` : ''}`;
  return (
    <div className="ps-card ps-help" id="ap-model-help">
      <div className="ps-help-h">
        <p className="ps-lbl">Not sure which model?</p>
        <h3>Answer three questions.</h3>
        <p>We point you to one model to look at first, from {firstName}'s list.</p>
      </div>
      <Row label="Who rides" q="Who is usually in the car?" options={PEOPLE} value={a.people} onPick={set('people')} />
      <Row label="Use" q="What is the car mostly for?" options={USES} value={a.use} onPick={set('use')} />
      {bands && <Row label="Budget" q="Your monthly budget?" options={bands} value={a.budget} onPick={set('budget')} />}
      <div className="ps-help-r" aria-live="polite">
        {!ready && <p className="ps-fine" style={{ margin: 0 }}>Pick one answer in each row.</p>}
        {res?.none && <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>None of {firstName}'s models has enough seats for that. Ask {firstName} what else is available.</p>}
        {res?.pick && (
          <>
            <p className="ps-lbl">Start with</p>
            <p className="ps-help-pick">{res.pick.name}</p>
            <p className="ps-help-facts">{pickFacts(res.pick).join(' · ')}</p>
            <p className="ps-help-price">from {rm(res.pick.from)}{res.pick.monthly ? <small> · about {rm(res.pick.monthly)} a month at 10% deposit over 7 years. An estimate: the bank decides.</small> : null}</p>
            {res.relaxed && <p className="ps-fine" style={{ marginTop: 6 }}>Nothing in that budget has the seats you need, so this is the lowest-priced one that does.</p>}
            <div className="ps-btns" style={{ marginTop: 12 }}>
              <button type="button" className="ps-ghost" onClick={() => onShow(res.pick.id)}>See this model</button>
              {hasWa && (
                <a className="ps-wa" href={waUrlFor(`Hi ${firstName}, I answered your model questions: ${words}.\nYour page pointed me to the ${res.pick.name}. Can you tell me more?`)}
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
