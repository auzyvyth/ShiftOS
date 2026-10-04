import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { CAR_DATA } from "../../data/carData";
import { specYearRange } from "../../utils/carSpecs";
import {
  BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, CC_PRESETS, POPULAR_BRANDS, COLOURS, CONDITION_COPY,
} from "../../utils/carFormOptions";
import QuickSteps, { Tile, Custom, BigNumber, fmtNum } from "./QuickSteps";

// The Car stage of the quick listing form (new listings only — CarForm
// decides). Anything the catalogue already knows is filled for the seller and
// its screens are skipped: a catalogue match turns four spec screens into one
// "Looks right" card. Typing is kept for what only the seller knows: mileage,
// and the optional extras at the end. Navigation lives in QuickSteps.

const ALL_BRANDS = Object.keys(CAR_DATA).sort();

export default function QuickCarFlow({ form, setForm, specLock, specsLocked, unlockSpecs, onExitBack, onDone, renderExtras }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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

  const linkBtn = "text-sm font-medium text-gray-500 underline underline-offset-2";
  const textCls = "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500";

  function renderBrand({ pick, goto, q, query, searchBox, fromSummary }) {
    const brands = q ? ALL_BRANDS.filter((b) => b.toLowerCase().includes(q)) : null;
    // Typing a MODEL here works too: "myvi" offers Perodua Myvi and one tap
    // fills both and skips the model screen.
    const models = q.length >= 2
      ? ALL_BRANDS.flatMap((b) => (CAR_DATA[b] || []).filter((m) => m.toLowerCase().includes(q)).map((m) => [b, m])).slice(0, 8)
      : [];
    const popular = POPULAR_BRANDS.filter((b) => CAR_DATA[b]);
    const exact = ALL_BRANDS.some((b) => b.toLowerCase() === q);
    const brandTile = (b) => (
      <Tile key={b} selected={form.brand === b} onClick={() => pick(form.brand === b ? null : { brand: b, model: "" })}>{b}</Tile>
    );
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{(brands || popular).map(brandTile)}</div>
        {q && !exact && !models.length && <Custom value={query.trim()} onUse={() => pick({ brand: query.trim(), model: "" })} />}
        {!q && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-1">All brands</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{ALL_BRANDS.filter((b) => !popular.includes(b)).map(brandTile)}</div>
          </>
        )}
      </div>
    );
  }

  function renderModel({ pick, q, query, searchBox }) {
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

  // Enter on a search picks the obvious match, or uses the typed value.
  const searchEnter = (field) => ({ pick, query }) => {
    const val = query.trim();
    if (!val) return;
    if (field === "brand") {
      const hit = ALL_BRANDS.find((b) => b.toLowerCase() === val.toLowerCase());
      pick({ brand: hit || val, model: "" });
    } else {
      const hit = (CAR_DATA[form.brand] || []).find((m) => m.toLowerCase() === val.toLowerCase());
      pick({ model: hit || val });
    }
  };

  function renderYear({ pick, otherOpen, setOtherOpen, inputRef }) {
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
            className={textCls}
          />
        ) : (
          <button type="button" onClick={() => setOtherOpen(true)} className={linkBtn}>Another year</button>
        )}
      </div>
    );
  }

  function renderCondition({ pick }) {
    return (
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(CONDITION_COPY).map(([k, c]) => (
          <Tile
            key={k}
            selected={form.condition === k}
            // isRecon drives the recon-only details (auction grade, import
            // country…) and what gets saved for them. It was a separate switch
            // on the Technical step, so a seller could pick Recon here, miss
            // the switch, and lose every recon detail on save. One answer now.
            onClick={() => pick({ condition: k, isRecon: k === "recon", ...(k === "new" && !form.mileage ? { mileage: "0" } : {}) })}
            className="py-3.5"
          >
            <span className="block font-semibold">{c.label}</span>
            <span className="block text-xs font-normal text-gray-500 mt-0.5">{c.hint}</span>
          </Tile>
        ))}
      </div>
    );
  }

  function renderMileage({ inputRef }) {
    return (
      <div className="space-y-3">
        <BigNumber inputRef={inputRef} value={form.mileage} onChange={(v) => set("mileage", v)} suffix="km" placeholder="e.g. 45,000" maxDigits={7} />
        <p className="text-xs text-gray-500">As shown on the odometer.</p>
      </div>
    );
  }

  function renderColour({ pick, otherOpen, setOtherOpen, inputRef }) {
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
          <input ref={inputRef} autoFocus={otherOpen} placeholder="e.g. Pearl White" value={form.colour} onChange={(e) => set("colour", e.target.value)} className={textCls} />
        ) : (
          <button type="button" onClick={() => setOtherOpen(true)} className={linkBtn}>Other colour</button>
        )}
      </div>
    );
  }

  function renderVariant({ pick, inputRef }) {
    return (
      <div className="space-y-4">
        {variants.length > 0 && (
          <>
            <p className="text-xs text-gray-500">What other sellers list for the {form.brand} {form.model}:</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => <Tile key={v} selected={form.variant === v} onClick={() => pick({ variant: v })}>{v}</Tile>)}
            </div>
          </>
        )}
        <input ref={inputRef} placeholder="Or type it, e.g. 1.5 V" value={form.variant} onChange={(e) => set("variant", e.target.value)} enterKeyHint="next" className={textCls} />
      </div>
    );
  }

  function renderSpecs({ goto }) {
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
        <button type="button" onClick={() => { unlockSpecs(); goto("body"); }} className={linkBtn}>
          Not my car? Set the specs myself
        </button>
      </div>
    );
  }

  const pillScreen = (options, field) => ({ pick }) => (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => <Tile key={o} selected={form[field] === o} onClick={() => pick({ [field]: o })}>{o}</Tile>)}
    </div>
  );

  function renderCc({ pick }) {
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
            className={`${textCls} pr-12`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">cc</span>
        </div>
      </div>
    );
  }

  const hasMileage = form.mileage !== "" && form.mileage != null;
  const screens = [
    { key: "brand", title: "What's the brand?", required: true, answered: !!form.brand, render: renderBrand, focus: "fine", hideContext: true, onEnter: searchEnter("brand") },
    { key: "model", title: "Which model?", required: true, answered: !!form.model, render: renderModel, focus: "fine", onEnter: searchEnter("model") },
    { key: "year", title: "What year?", required: true, answered: !!form.year, render: renderYear },
    { key: "condition", title: "Used, recon or new?", required: true, answered: !!form.condition, render: renderCondition },
    { key: "mileage", title: "How many km on it?", required: true, answered: hasMileage, render: renderMileage, focus: "always" },
    { key: "colour", title: "What colour?", required: true, answered: !!form.colour, render: renderColour },
    { key: "variant", title: "Which variant?", filled: !!form.variant, render: renderVariant },
    { key: "specs", title: "We filled in the specs", skip: !specsLocked, render: renderSpecs, primaryLabel: "Looks right", primaryIcon: "check" },
    { key: "body", title: "Body type?", skip: specsLocked, required: true, answered: !!form.bodyType, render: pillScreen(BODY_TYPES, "bodyType") },
    { key: "fuel", title: "Fuel type?", skip: specsLocked, required: true, answered: !!form.fuelType, render: pillScreen(FUEL_TYPES, "fuelType") },
    { key: "transmission", title: "Gearbox?", skip: specsLocked, filled: !!form.transmission, render: pillScreen(TRANSMISSIONS, "transmission") },
    { key: "cc", title: "Engine size?", skip: specsLocked, filled: !!form.engineCc, render: renderCc },
    { key: "extras", title: "Anything else? (optional)", render: renderExtras, primaryLabel: "Done", enter: "pass" },
  ];

  const summaryRows = [
    { key: "brand", label: "Brand", value: form.brand },
    { key: "model", label: "Model", value: form.model },
    { key: "year", label: "Year", value: form.year },
    { key: "condition", label: "Condition", value: CONDITION_COPY[form.condition]?.label || form.condition },
    { key: "mileage", label: "Mileage", value: hasMileage ? `${fmtNum(form.mileage)} km` : "" },
    { key: "colour", label: "Colour", value: form.colour },
    { key: "variant", label: "Variant", value: form.variant },
    { key: specsLocked ? "specs" : "body", label: "Specs", value: [form.engineCc && `${form.engineCc}cc`, form.bodyType, form.fuelType, form.transmission].filter(Boolean).join(" · ") },
    { key: "extras", label: "Plate & extras", value: [form.plate_number, form.listing_title && "title set"].filter(Boolean).join(" · ") },
  ];

  // Land on the summary when the car is already identified (Back from a later
  // stage, a step-tab tap, Edit on Review, a resumed draft); else start fresh.
  const [landOnSummary] = useState(() => !!form.brand);

  return (
    <QuickSteps
      setForm={setForm}
      screens={screens}
      summaryRows={summaryRows}
      landOnSummary={landOnSummary}
      contextLine={[form.year, form.brand, form.model].filter(Boolean).join(" ")}
      onExitBack={onExitBack}
      onDone={onDone}
    />
  );
}
