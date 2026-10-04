import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { CAR_DATA } from "../../data/carData";
import { specYearRange } from "../../utils/carSpecs";
import {
  BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, CC_PRESETS, POPULAR_BRANDS, COLOURS, CONDITION_COPY,
} from "../../utils/carFormOptions";

// The Car step for NEW listings: one question per screen, a tap answers it and
// slides to the next one. Anything the catalogue already knows is filled for
// the seller and its screens are skipped (a catalogue match turns four spec
// screens into one "Looks right" card). Typing is kept for the things only the
// seller can know: mileage, and the optional extras at the end.
//
// It writes the SAME `form` fields the classic layout writes, through the
// parent's setForm, so validation, drafts, the spec lookup effect and publish
// are all unchanged. Edits and the dealer intake path keep the classic layout
// (CarForm decides): walking ten screens to fix one typo is the wrong shape.

const ALL_BRANDS = Object.keys(CAR_DATA).sort();
const REQUIRED = ["brand", "model", "year", "condition", "mileage", "colour", "body", "fuel"];
const ADVANCE_MS = 120; // long enough to see the tap land, short enough not to wait

const TITLES = {
  brand: "What's the brand?",
  model: "Which model?",
  year: "What year?",
  condition: "Used, recon or new?",
  mileage: "How many km on it?",
  colour: "What colour?",
  variant: "Which variant?",
  specs: "We filled in the specs",
  body: "Body type?",
  fuel: "Fuel type?",
  transmission: "Gearbox?",
  cc: "Engine size?",
  extras: "Anything else? (optional)",
  summary: "Your car",
};

const fmtNum = (v) => (v === "" || v == null ? "" : Number(String(v).replace(/\D/g, "")).toLocaleString("en-MY"));

// Defined OUTSIDE the component: a component declared inside render is a new
// type every render, so React remounts it and an input inside loses focus on
// every keystroke.
function Tile({ selected, onClick, children, className = "" }) {
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

function Custom({ value, onUse }) {
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

export default function QuickCarFlow({ form, setForm, specLock, specsLocked, unlockSpecs, onExitBack, onDone, renderExtras }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const order = useMemo(() => [
    "brand", "model", "year", "condition", "mileage", "colour", "variant",
    ...(specsLocked ? ["specs"] : ["body", "fuel", "transmission", "cc"]),
    "extras",
  ], [specsLocked]);

  const answered = (k) => ({
    brand: !!form.brand,
    model: !!form.model,
    year: !!form.year,
    condition: !!form.condition,
    mileage: form.mileage !== "" && form.mileage != null,
    colour: !!form.colour,
    body: !!form.bodyType,
    fuel: !!form.fuelType,
  })[k] ?? true;
  const allRequired = REQUIRED.every(answered);

  // Landing: a fresh form starts at brand; coming back (Back from Technical, a
  // step-tab tap, Edit on Review, a resumed draft) lands on the summary when
  // everything required is there, else on the first gap.
  const [key, setKey] = useState(() => (allRequired ? "summary" : REQUIRED.find((k) => !answered(k)) || "brand"));
  const [dir, setDir] = useState("fwd");
  const [fromSummary, setFromSummary] = useState(false);
  const [query, setQuery] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Reset per-screen UI and bring the question into view. Focus the text box on
  // screens where typing IS the task; tap screens never pop the keyboard.
  useEffect(() => {
    setQuery("");
    setOtherOpen(false);
    const top = rootRef.current?.getBoundingClientRect().top;
    if (top != null && top < 0) rootRef.current.scrollIntoView({ block: "start" });
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (key === "mileage" || (fine && (key === "brand" || key === "model"))) {
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    }
  }, [key]);

  const goto = (k, d = "fwd") => {
    if (k === "summary") setFromSummary(false);
    setDir(d);
    setKey(k);
  };

  // `order` is read at call time, so a catalogue match that landed while the
  // seller was on an earlier screen is already reflected in what comes next.
  const next = (from = key) => {
    if (from === "summary") { onDone(); return; }
    if (fromSummary && allRequired) { goto("summary"); return; }
    const i = order.indexOf(from);
    const n = order[i + 1];
    if (n) goto(n); else onDone();
  };
  // The auto-advance timer fires after the tap's form update has rendered, and
  // calls the LATEST `next` — a closure from the tap's own render would still
  // see the old form (e.g. a model just picked from the summary not counted).
  const nextRef = useRef(next);
  nextRef.current = next;

  const back = () => {
    if (key === "summary") { onExitBack(); return; }
    if (fromSummary) { goto("summary", "back"); return; }
    const i = order.indexOf(key);
    if (i <= 0) onExitBack(); else goto(order[i - 1], "back");
  };

  // Tap = answer + advance. The value is written first; the slide follows a
  // beat later so the seller sees what they picked.
  const pick = (updates, then) => {
    setForm((f) => ({ ...f, ...updates }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (then ? then() : nextRef.current()), ADVANCE_MS);
  };

  const editFromSummary = (k) => { setFromSummary(true); goto(k); };

  // ── Variant suggestions: what other sellers called this model's trims ─────
  // There is no trim catalogue yet (TODO: schema 3.0 car_variants), so the
  // nearest real data is the variants already on live listings for this model.
  const [variants, setVariants] = useState([]);
  useEffect(() => {
    if (!form.brand || !form.model) { setVariants([]); return; }
    let live = true;
    supabase
      .from("public_car_listings")
      .select("variant")
      .eq("brand", form.brand)
      .ilike("model", form.model)
      .not("variant", "is", null)
      .limit(300)
      .then(({ data }) => {
        if (!live || !data) return;
        const count = new Map();
        for (const { variant } of data) {
          const v = (variant || "").trim();
          if (!v || v.length > 40) continue;
          const k = v.toLowerCase();
          const cur = count.get(k);
          count.set(k, { label: cur?.label || v, n: (cur?.n || 0) + 1 });
        }
        setVariants([...count.values()].sort((a, b) => b.n - a.n).slice(0, 10).map((x) => x.label));
      }, () => {});
    return () => { live = false; };
  }, [form.brand, form.model]);

  // ── Screens ─────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();

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

  function renderBrand() {
    const brands = q ? ALL_BRANDS.filter((b) => b.toLowerCase().includes(q)) : null;
    // Typing a MODEL here works too: "myvi" offers Perodua Myvi and one tap
    // fills both and skips the model screen.
    const models = q.length >= 2
      ? ALL_BRANDS.flatMap((b) => (CAR_DATA[b] || []).filter((m) => m.toLowerCase().includes(q)).map((m) => [b, m])).slice(0, 8)
      : [];
    const popular = POPULAR_BRANDS.filter((b) => CAR_DATA[b]);
    const exact = ALL_BRANDS.some((b) => b.toLowerCase() === q);
    return (
      <div className="space-y-4">
        {searchBox("Search brand or model (e.g. Myvi)")}
        {models.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {models.map(([b, m]) => (
              <Tile key={b + m} selected={form.brand === b && form.model === m} onClick={() => pick({ brand: b, model: m }, () => goto(fromSummary ? "summary" : "year"))}>
                {b} <span className="font-semibold">{m}</span>
              </Tile>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(brands || popular).map((b) => (
            <Tile key={b} selected={form.brand === b} onClick={() => pick(form.brand === b ? {} : { brand: b, model: "" })}>{b}</Tile>
          ))}
        </div>
        {q && !exact && !models.length && <Custom value={query.trim()} onUse={() => pick({ brand: query.trim(), model: "" })} />}
        {!q && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-1">All brands</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_BRANDS.filter((b) => !popular.includes(b)).map((b) => (
                <Tile key={b} selected={form.brand === b} onClick={() => pick(form.brand === b ? {} : { brand: b, model: "" })}>{b}</Tile>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderModel() {
    const all = CAR_DATA[form.brand] || [];
    const list = q ? all.filter((m) => m.toLowerCase().includes(q)) : all;
    const exact = all.some((m) => m.toLowerCase() === q);
    return (
      <div className="space-y-4">
        {searchBox(all.length ? `Search ${form.brand} models` : "Type the model")}
        {!all.length && (
          <p className="text-xs text-gray-500">We don't have a model list for {form.brand} yet — type it, then tap the suggestion.</p>
        )}
        {list.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {list.map((m) => <Tile key={m} selected={form.model === m} onClick={() => pick({ model: m })}>{m}</Tile>)}
          </div>
        )}
        {q && !exact && <Custom value={query.trim()} onUse={() => pick({ model: query.trim() })} />}
      </div>
    );
  }

  function renderYear() {
    const nowY = new Date().getFullYear();
    const range = specYearRange(form.brand, form.model);
    const to = range ? Math.min(range.to, nowY) : nowY;
    const from = range ? Math.max(range.from, to - 39) : nowY - 29;
    const years = [];
    for (let y = to; y >= from; y--) years.push(String(y));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {years.map((y) => (
            <Tile key={y} selected={String(form.year) === y} onClick={() => pick({ year: y })} className="text-center tabular-nums">{y}</Tile>
          ))}
        </div>
        {otherOpen ? (
          <input
            ref={inputRef}
            autoFocus
            inputMode="numeric"
            placeholder="Type the year, e.g. 1998"
            value={form.year}
            onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
          />
        ) : (
          <button type="button" onClick={() => setOtherOpen(true)} className="text-sm font-medium text-gray-500 underline underline-offset-2">
            Another year
          </button>
        )}
      </div>
    );
  }

  function renderCondition() {
    return (
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(CONDITION_COPY).map(([k, c]) => (
          <Tile key={k} selected={form.condition === k} onClick={() => pick({ condition: k, ...(k === "new" && !form.mileage ? { mileage: "0" } : {}) })} className="py-3.5">
            <span className="block font-semibold">{c.label}</span>
            <span className="block text-xs font-normal text-gray-500 mt-0.5">{c.hint}</span>
          </Tile>
        ))}
      </div>
    );
  }

  function renderMileage() {
    return (
      <div className="space-y-3">
        <div className="relative">
          <input
            ref={inputRef}
            inputMode="numeric"
            enterKeyHint="next"
            placeholder="e.g. 45,000"
            value={fmtNum(form.mileage)}
            onChange={(e) => set("mileage", e.target.value.replace(/\D/g, "").slice(0, 7))}
            className="w-full pl-4 pr-14 py-4 bg-white border border-gray-200 rounded-xl text-2xl font-semibold tabular-nums text-gray-900 placeholder-gray-300 focus:outline-none focus:border-blue-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium pointer-events-none">km</span>
        </div>
        <p className="text-xs text-gray-500">As shown on the odometer.</p>
      </div>
    );
  }

  function renderColour() {
    const known = COLOURS.some((c) => c.label === form.colour);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {COLOURS.map((c) => (
            <Tile key={c.label} selected={form.colour === c.label} onClick={() => pick({ colour: c.label })} className="flex flex-col items-center gap-1.5 text-center px-1">
              <span className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0" style={{ background: c.hex }} />
              <span className="text-xs">{c.label}</span>
            </Tile>
          ))}
        </div>
        {otherOpen || (form.colour && !known) ? (
          <input
            ref={inputRef}
            autoFocus={otherOpen}
            placeholder="e.g. Pearl White"
            value={form.colour}
            onChange={(e) => set("colour", e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
          />
        ) : (
          <button type="button" onClick={() => setOtherOpen(true)} className="text-sm font-medium text-gray-500 underline underline-offset-2">
            Other colour
          </button>
        )}
      </div>
    );
  }

  function renderVariant() {
    return (
      <div className="space-y-4">
        {variants.length > 0 && (
          <>
            <p className="text-xs text-gray-500">What other sellers list for the {form.brand} {form.model}:</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <Tile key={v} selected={form.variant === v} onClick={() => pick({ variant: v })}>{v}</Tile>
              ))}
            </div>
          </>
        )}
        <input
          ref={inputRef}
          placeholder="Or type it, e.g. 1.5 V"
          value={form.variant}
          onChange={(e) => set("variant", e.target.value)}
          enterKeyHint="next"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  function renderSpecs() {
    const rows = [
      ["Engine", form.engineCc && `${form.engineCc} cc`],
      ["Body", form.bodyType],
      ["Fuel", form.fuelType],
      ["Gearbox", form.transmission],
      ["Seats", form.seats],
      ["Power", form.horsepower && `${form.horsepower} hp`],
    ].filter(([, v]) => v);
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          From our catalogue for the {specLock?.make} {specLock?.model} {specLock ? `(${specLock.yearFrom}${specLock.yearTo >= 2099 ? " on" : `-${specLock.yearTo}`})` : ""}.
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 rounded-xl border border-gray-200 bg-gray-50">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-gray-400">{k}</dt>
              <dd className="text-sm font-semibold text-gray-900 tabular-nums truncate">{v}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => { unlockSpecs(); goto("body"); }}
          className="text-sm font-medium text-gray-500 underline underline-offset-2"
        >
          Not my car? Set the specs myself
        </button>
      </div>
    );
  }

  const pillScreen = (options, field) => (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => <Tile key={o} selected={form[field] === o} onClick={() => pick({ [field]: o })}>{o}</Tile>)}
    </div>
  );

  function renderCc() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {CC_PRESETS.map((cc) => (
            <Tile key={cc} selected={String(form.engineCc) === String(cc)} onClick={() => pick({ engineCc: String(cc) })} className="text-center tabular-nums">
              {(cc / 1000).toFixed(1)}L
            </Tile>
          ))}
        </div>
        <div className="relative">
          <input
            inputMode="numeric"
            placeholder="Or exact cc, e.g. 1497"
            value={form.engineCc}
            onChange={(e) => set("engineCc", e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">cc</span>
        </div>
      </div>
    );
  }

  function renderSummary() {
    const rows = [
      ["brand", "Brand", form.brand],
      ["model", "Model", form.model],
      ["year", "Year", form.year],
      ["condition", "Condition", CONDITION_COPY[form.condition]?.label || form.condition],
      ["mileage", "Mileage", form.mileage !== "" ? `${fmtNum(form.mileage)} km` : ""],
      ["colour", "Colour", form.colour],
      ["variant", "Variant", form.variant],
      [specsLocked ? "specs" : "body", "Specs", [form.engineCc && `${form.engineCc}cc`, form.bodyType, form.fuelType, form.transmission].filter(Boolean).join(" · ")],
      ["extras", "Plate & extras", [form.plate_number, form.listing_title && "title set"].filter(Boolean).join(" · ")],
    ];
    return (
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {rows.map(([k, label, v]) => (
          <button key={k} type="button" onClick={() => editFromSummary(k)} className="w-full flex items-center gap-3 px-4 py-3 text-left bg-white hover:bg-gray-50">
            <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
            <span className={`flex-1 min-w-0 truncate text-sm ${v ? "font-medium text-gray-900" : "text-gray-400"}`}>{v || "Add"}</span>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  const screens = {
    brand: renderBrand,
    model: renderModel,
    year: renderYear,
    condition: renderCondition,
    mileage: renderMileage,
    colour: renderColour,
    variant: renderVariant,
    specs: renderSpecs,
    body: () => pillScreen(BODY_TYPES, "bodyType"),
    fuel: () => pillScreen(FUEL_TYPES, "fuelType"),
    transmission: () => pillScreen(TRANSMISSIONS, "transmission"),
    cc: renderCc,
    extras: renderExtras,
    summary: renderSummary,
  };

  // Primary button: required + empty = disabled; optional + empty = Skip.
  const isRequired = REQUIRED.includes(key);
  const filled = answered(key) && !(key === "variant" && !form.variant) && !(key === "cc" && !form.engineCc);
  const optionalEmpty = !isRequired && !filled && key !== "specs" && key !== "summary" && key !== "extras";
  const primaryLabel = key === "specs" ? "Looks right" : key === "extras" ? "Done" : optionalEmpty ? "Skip" : "Continue";
  const primaryDisabled = isRequired && !answered(key);

  const idx = order.indexOf(key);
  const progress = key === "summary" ? 1 : (idx + 1) / order.length;

  const onKeyDown = (e) => {
    // The extras screen has several inputs; let CarForm's Enter-to-next-field
    // handler walk them. Everywhere else Enter answers the one question here.
    if (e.key !== "Enter" || key === "extras" || e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
    e.preventDefault();
    e.stopPropagation();
    if (key === "brand" || key === "model") {
      // Enter on a search picks the single obvious match, or the typed value.
      const val = query.trim();
      if (!val) return;
      if (key === "brand") {
        const hit = ALL_BRANDS.find((b) => b.toLowerCase() === val.toLowerCase());
        pick({ brand: hit || val, model: "" });
      } else {
        const hit = (CAR_DATA[form.brand] || []).find((m) => m.toLowerCase() === val.toLowerCase());
        pick({ model: hit || val });
      }
      return;
    }
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
          {(form.brand && key !== "brand" && key !== "summary") && (
            <p className="text-xs text-gray-400 truncate mb-0.5">{[form.year, form.brand, form.model].filter(Boolean).join(" ")}</p>
          )}
          <h3 className="text-xl font-semibold text-gray-900">{TITLES[key]}</h3>
        </div>
        {screens[key]?.()}
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
          {key === "specs" && <Check className="w-4 h-4" />}
          {primaryLabel}
          {key !== "specs" && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
