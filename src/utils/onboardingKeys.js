// Enter advances the onboarding wizards.
//
// Neither DealerOnboarding nor SalesmanOnboarding uses a <form>, so there was
// nothing for Enter to submit: every step advanced only by clicking CONTINUE,
// and pressing Enter in a field did literally nothing. On a phone that is the
// "Go" key on the keyboard, so the most natural way to move through a signup
// was a no-op.
//
// It CLICKS THE STEP'S OWN BUTTON rather than calling the step's advance
// function. That matters: each step's CONTINUE carries its own validation in a
// `disabled` prop (`!form.state`, `!pwValid`, `!canSubContinue`, …), and a
// disabled button ignores .click(). So Enter inherits every rule for free and
// cannot drift from the button — duplicating those conditions here is exactly
// how the two would end up disagreeing about when a step is complete.
//
// Attach to the per-step container (`.eo-form`, which is keyed on `step`, so
// only one step's markup is ever mounted and the query can't reach another
// step's button).
export function advanceOnEnter(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

  const el = e.target;
  const tag = el?.tagName;
  // A textarea's Enter is a newline, and a checkbox's is the legal gate — let
  // both keep their own behaviour.
  if (tag !== 'INPUT' && tag !== 'SELECT') return;
  if (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) return;

  // `eo-btn` is the primary/advance button; `eo-ghost` is BACK, which Enter
  // must never trigger.
  const next = e.currentTarget.querySelector('button.eo-btn:not([disabled])');
  if (!next) return;

  e.preventDefault();
  next.click();
}
