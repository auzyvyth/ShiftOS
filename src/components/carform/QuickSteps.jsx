import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";

// The engine behind the quick listing form: one question per screen, a tap
// answers it and slides (180ms) to the next. Each CarForm stage (Car,
// Technical, Pricing, Details) hands it a list of screens; this file owns
// everything they share — navigation, the slide, progress, Back/Continue,
// Enter, and the summary a returning seller lands on.
//
// A screen is:
//   { key, title, render(ctx),
//     required?, answered?   — required + !answered disables Continue
//     filled?                — optional screens read "Skip" until filled
//     skip?                  — true = not shown at all (e.g. recon-only)
//     primaryLabel?, primaryIcon?: "check"
//     enter?: "pass"         — let CarForm's Enter walk a multi-input screen
//     onEnter?(ctx)          — custom Enter (search screens)
//     focus?: "always" | "fine" — focus ctx.inputRef on arrival (fine = desktop only) }
//
// Every answer is written straight into CarForm's `form` through setForm, so
// validation, drafts and publish never know this layout exists.

export const ADVANCE_MS = 120; // long enough to see the tap land, short enough not to wait

// Defined OUTSIDE any component: a component declared inside render is a new
// type every render, so React remounts it and an input inside loses focus on
// every keystroke.
export function Tile({ selected, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-colors active:scale-[0.98] ${selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"} ${className}`}
    >
      {children}
    </button>
  );
}

export function Custom({ value, onUse }) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="w-full px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-700 text-left hover:border-gray-400"
    >
      Not listed — use "<span className="font-semibold">{value}</span>"
    </button>
  );
}

export const fmtNum = (v) => (v === "" || v == null ? "" : Number(String(v).replace(/\D/g, "")).toLocaleString("en-MY"));

// Big typed number (mileage, prices): numpad, thousands separators as you
// type, digits-only in the form so nothing downstream changes.
export function BigNumber({ inputRef, value, onChange, prefix, suffix, placeholder, maxDigits = 9 }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold pointer-events-none">{prefix}</span>}
      <input
        ref={inputRef}
        inputMode="numeric"
        enterKeyHint="next"
        placeholder={placeholder}
        value={fmtNum(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
        className={`w-full ${prefix ? "pl-14" : "pl-4"} ${suffix ? "pr-14" : "pr-4"} py-4 bg-white border border-gray-200 rounded-xl text-2xl font-semibold tabular-nums text-gray-900 placeholder-gray-300 focus:outline-none focus:border-blue-500`}
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium pointer-events-none">{suffix}</span>}
    </div>
  );
}

export default function QuickSteps({ setForm, screens, summaryRows, landOnSummary, contextLine, onExitBack, onDone }) {
  const live = screens.filter((s) => !s.skip);
  const byKey = (k) => screens.find((s) => s.key === k);
  const gaps = live.filter((s) => s.required && !s.answered);
  const allRequired = gaps.length === 0;

  const [key, setKey] = useState(() =>
    landOnSummary && summaryRows?.length
      ? (allRequired ? "summary" : gaps[0].key)
      : live[0]?.key,
  );
  const [dir, setDir] = useState("fwd");
  // Landing on a gap (returning seller, or a dealer whose intake already filled
  // most of the stage) counts as coming from the summary: answer the gap, then
  // straight on to the next gap or back to the summary — never a walk through
  // every screen that is already answered.
  const [fromSummary, setFromSummary] = useState(() => !!(landOnSummary && summaryRows?.length && !allRequired));
  const [query, setQuery] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const screen = key === "summary" ? null : byKey(key);

  // Reset per-screen UI and bring the question into view. Focus the text box on
  // screens where typing IS the task; tap screens never pop the keyboard.
  useEffect(() => {
    setQuery("");
    setOtherOpen(false);
    const top = rootRef.current?.getBoundingClientRect().top;
    if (top != null && top < 0) rootRef.current.scrollIntoView({ block: "start" });
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (screen?.focus === "always" || (fine && screen?.focus === "fine")) {
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const goto = (k, d = "fwd") => {
    if (k === "summary") setFromSummary(false);
    setDir(d);
    setKey(k);
  };

  // Reads `screens` at call time, so an answer that changes what comes next
  // (a catalogue match, picking Recon) is already reflected.
  const next = (from = key) => {
    if (from === "summary") { onDone(); return; }
    if (fromSummary) {
      const gap = gaps.find((s) => s.key !== from);
      if (allRequired || !gap) { goto("summary"); return; }
      setDir("fwd"); setKey(gap.key); return;
    }
    const i = screens.findIndex((s) => s.key === from);
    const n = screens.slice(i + 1).find((s) => !s.skip);
    if (n) goto(n.key); else onDone();
  };
  // The auto-advance timer fires after the tap's form update has rendered and
  // calls the LATEST `next` — the tap's own closure would still see the old form.
  const nextRef = useRef(next);
  nextRef.current = next;

  const back = () => {
    if (key === "summary") { onExitBack(); return; }
    if (fromSummary) { goto("summary", "back"); return; }
    const i = screens.findIndex((s) => s.key === key);
    const p = screens.slice(0, i).reverse().find((s) => !s.skip);
    if (p) goto(p.key, "back"); else onExitBack();
  };

  // Tap = answer + advance. The value is written first; the slide follows a
  // beat later so the seller sees what they picked.
  const pick = (updates, then) => {
    if (updates) setForm((f) => ({ ...f, ...updates }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (then ? then() : nextRef.current()), ADVANCE_MS);
  };

  const editFromSummary = (k) => { setFromSummary(true); goto(k); };

  const searchBox = (placeholder) => (
    <div className="relative">
      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
      />
    </div>
  );

  const ctx = {
    pick, next: () => next(), goto, editFromSummary, query, setQuery, q: query.trim().toLowerCase(),
    otherOpen, setOtherOpen, inputRef, searchBox, fromSummary,
  };

  function renderSummary() {
    return (
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {summaryRows.filter((r) => !byKey(r.key)?.skip).map((r) => (
          <button key={r.key + r.label} type="button" onClick={() => editFromSummary(r.key)} className="w-full flex items-center gap-3 px-4 py-3 text-left bg-white hover:bg-gray-50">
            <span className="text-xs text-gray-500 w-28 flex-shrink-0">{r.label}</span>
            <span className={`flex-1 min-w-0 truncate text-sm ${r.value ? "font-medium text-gray-900" : "text-gray-400"}`}>{r.value || "Add"}</span>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  const isSummary = key === "summary";
  const primaryDisabled = !isSummary && !!screen?.required && !screen?.answered;
  const primaryLabel = isSummary
    ? "Continue"
    : screen?.primaryLabel || (!screen?.required && !screen?.filled ? "Skip" : "Continue");

  const pos = live.findIndex((s) => s.key === key);
  const progress = isSummary ? 1 : (pos + 1) / Math.max(1, live.length);

  const onKeyDown = (e) => {
    if (e.key !== "Enter" || isSummary || screen?.enter === "pass") return;
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
    e.preventDefault();
    e.stopPropagation();
    if (screen?.onEnter) { screen.onEnter(ctx); return; }
    if (!primaryDisabled) next();
  };

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="qf-root">
      <style>{`
        @keyframes qfInFwd { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
        @keyframes qfInBack { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
        .qf-fwd { animation: qfInFwd 180ms cubic-bezier(.2,.8,.2,1); }
        .qf-back { animation: qfInBack 180ms cubic-bezier(.2,.8,.2,1); }
        @media (prefers-reduced-motion: reduce) { .qf-fwd, .qf-back { animation: none; } }
      `}</style>

      <div className="h-1 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full bg-red-600 transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div key={key} className={dir === "back" ? "qf-back" : "qf-fwd"}>
        <div className="mb-4">
          {contextLine && !isSummary && !screen?.hideContext && (
            <p className="text-xs text-gray-400 truncate mb-0.5">{contextLine}</p>
          )}
          <h3 className="text-xl font-semibold text-gray-900">{isSummary ? "Check and continue" : screen?.title}</h3>
        </div>
        {isSummary ? renderSummary() : screen?.render(ctx)}
      </div>

      <div
        className="sticky bottom-0 z-20 mt-6 -mx-1 px-1 pt-3 flex items-center gap-3 bg-white border-t border-gray-100"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))", boxShadow: "0 24px 0 0 #fff" }}
      >
        <button
          type="button"
          onClick={back}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all hover:border-gray-300"
        >
          <ChevronLeft className="w-4 h-4" />Back
        </button>
        <button
          type="button"
          onClick={() => next()}
          disabled={primaryDisabled}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {screen?.primaryIcon === "check" && !isSummary && <Check className="w-4 h-4" />}
          {primaryLabel}
          {!(screen?.primaryIcon === "check" && !isSummary) && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
