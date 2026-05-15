import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "../supabaseClient";
import StepIndicator from "../components/ImportStockPage/StepIndicator";
import Step1Upload from "../components/ImportStockPage/Step1Upload";
import Step2Preview from "../components/ImportStockPage/Step2Preview";
import Step3Import from "../components/ImportStockPage/Step3Import";

const AI_PROXY = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/ai/messages`
  : '/api/ai-messages';
const MAX_CARS = 50;
const SYSTEM_PROMPT = `You are a data extraction assistant for a car dealership platform.
Extract car listings from the provided data and return ONLY a JSON array. No markdown, no explanation. Each object must follow this exact schema:
{"brand":"","model":"","variant":"","year":null,"price":null,"base_price":null,"mileage":null,"color":"","transmission":"","fuel_type":"","engine_cc":null,"condition":"","state":"","auction_grade":"","interior_grade":"","import_country":"","vin":null,"image_url":null,"description":null}
Map any column names you find to the closest matching field.
HARD LIMIT: Extract a maximum of 50 listings. Once you have written 50 objects, immediately close the array with ] and stop.
SKIP any row where the REMARKS column contains "SOLD" — do not include sold units.
SKIP any row where the ARR column is "ETA DELAY" — only include arrived stock (ARR = "Y" or blank).
For price: use the ADS PRICE column if present; also accept PRICE, SELLING PRICE, UNIT PRICE, ADVERTISED PRICE, or any column clearly representing the selling price to customers. If multiple price columns exist, prefer the higher/advertised one. Null only if no price is found at all.
For base_price: use the BASE PRICE column if present; also accept COST, COST PRICE, PURCHASE PRICE, DEALER PRICE, IMPORT PRICE, or any column representing the dealer's cost or purchase price. Null only if no cost price is found at all.
For import_country: use the C.O. column — "JP" or "JPN" = "Japan", "UK" = "UK", "MY" = "Malaysia". Null if not found.
For vin: look for any column labeled VIN, CHASSIS, CHASSIS NO, FRAME NO, or any alphanumeric code that looks like a vehicle chassis/VIN (typically 8–17 characters, letters and digits). Extract it exactly as shown. Null if not found.
For image_url: look for any column containing a URL. Extract it exactly. Null if not found.
Transmission must be "Auto" or "Manual".
Fuel type must be "Petrol", "Diesel", "Hybrid", or "Electric".
Condition must be "Used", "New", or "Recon".
auction_grade: exterior grade e.g. "4.5","4","3.5","3","R","S". Null if not found.
interior_grade: "A","B","C","D". Null if not found.
state: Malaysian state e.g. "Selangor","Kuala Lumpur","Johor". Null if not found.
Always use null (not empty string) for missing fields. Keep all text values short. Set description to null always.`;

const SAMPLE_ROWS = [
  { brand:'Toyota', model:'Alphard', variant:'2.5 SC', year:2022, price:280000, base_price:210000, mileage:18000, color:'Pearl White', transmission:'Auto', fuel_type:'Petrol', engine_cc:2494, condition:'Recon', state:'Selangor', auction_grade:'4.5', interior_grade:'A', import_country:'Japan', description:'' },
  { brand:'Honda', model:'Vezel', variant:'1.5 RS e:HEV', year:2023, price:155000, base_price:118000, mileage:9000, color:'Platinum White', transmission:'Auto', fuel_type:'Hybrid', engine_cc:1496, condition:'Recon', state:'Kuala Lumpur', auction_grade:'4', interior_grade:'A', import_country:'Japan', description:'' },
  { brand:'Mazda', model:'CX-5', variant:'2.0 SkyActiv', year:2021, price:125000, base_price:95000, mileage:32000, color:'Soul Red Crystal', transmission:'Auto', fuel_type:'Petrol', engine_cc:1997, condition:'Recon', state:'Johor', auction_grade:'3.5', interior_grade:'B', import_country:'Japan', description:'' },
  { brand:'Toyota', model:'Vellfire', variant:'2.5 Z-G', year:2020, price:320000, base_price:245000, mileage:24000, color:'White Pearl', transmission:'Auto', fuel_type:'Petrol', engine_cc:2494, condition:'Recon', state:'Selangor', auction_grade:'4', interior_grade:'A', import_country:'Japan', description:'' },
  { brand:'Nissan', model:'X-Trail', variant:'2.0 4WD', year:2022, price:110000, base_price:84000, mileage:15000, color:'Brilliant Silver', transmission:'Auto', fuel_type:'Petrol', engine_cc:1997, condition:'Recon', state:'Penang', auction_grade:'4.5', interior_grade:'A', import_country:'Japan', description:'' },
];

function driveToDirectUrl(url) {
  if (!url) return null;
  // https://drive.google.com/file/d/FILE_ID/view... → direct embeddable URL
  const m = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  // already a direct/image URL — return as-is
  if (url.startsWith('http')) return url;
  return null;
}

async function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

async function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function buildClaudeMessages(file, sheetsUrl) {
  if (sheetsUrl) {
    const id = await extractSheetId(sheetsUrl);
    if (!id) throw new Error("Could not parse spreadsheet ID from URL");
    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
    const res = await fetch(csvUrl);
    if (!res.ok)
      throw new Error(
        'Could not fetch Google Sheet — make sure it is set to "Anyone with the link can view"',
      );
    const csv = await res.text();
    return [
      {
        role: "user",
        content: `Here is the spreadsheet data in CSV format:\n\n${csv}`,
      },
    ];
  }

  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "xlsx") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return [
      {
        role: "user",
        content: `Here is the spreadsheet data as JSON:\n\n${JSON.stringify(json)}`,
      },
    ];
  }

  if (ext === "pdf") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      fullText += `\n--- Page ${i} ---\n${pageText}`;
    }
    return [
      {
        role: "user",
        content: `Here is the car listing PDF extracted as text:\n\n${fullText}`,
      },
    ];
  }

  throw new Error("Unsupported file type");
}

async function callClaude(messages, onProgress) {
  onProgress?.(4, 0, "Connecting to AI...");

  const res = await fetch(AI_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `API error ${res.status}`);
  }

  onProgress?.(8, 0, "AI is reading your file...");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const ESTIMATED_CHARS = 25000;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const evt = JSON.parse(raw);
        if (evt.type === "message_start") {
          inputTokens = evt.message?.usage?.input_tokens || 0;
        }
        if (evt.type === "message_delta") {
          outputTokens = evt.usage?.output_tokens || 0;
        }
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          text += evt.delta.text;
          const cars = (text.match(/"brand":/g) || []).length;
          const pct = 8 + Math.min(82, (cars / MAX_CARS) * 82);
          const msg = cars > 0 ? `Extracting listings… ${cars} / ${MAX_CARS}` : "Extracting listings…";
          onProgress?.(Math.round(pct), cars, msg);
          // Hard stop at limit — close the array and bail
          if (cars >= MAX_CARS) {
            reader.cancel();
            const lastClose = text.lastIndexOf('}');
            if (lastClose !== -1) text = text.slice(0, lastClose + 1) + ']';
            break;
          }
        }
        if (evt.type === "error") throw new Error(evt.error?.message || "Anthropic stream error");
      } catch (e) {
        if (e.message.includes("Anthropic")) throw e;
      }
    }
  }

  onProgress?.(93, 0, "Parsing results…");
  try {
    const result = JSON.parse(text);
    return { result, inputTokens, outputTokens };
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return { result: JSON.parse(match[0]), inputTokens, outputTokens };
    throw new Error("Could not parse JSON from response");
  }
}

export default function ImportStockPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [usage, setUsage] = useState(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState("");
  const [analyseError, setAnalyseError] = useState("");

  const handleSample = () => {
    setRows(SAMPLE_ROWS);
    setUsage(null);
    setStep(2);
  };

  const handleStep1 = async ({ file, sheetsUrl }) => {
    setLoading(true);
    setProgress(2);
    setProgressMsg("Preparing file…");
    setAnalyseError("");
    try {
      const messages = await buildClaudeMessages(file, sheetsUrl);
      const { result, inputTokens, outputTokens } = await callClaude(messages, (pct, _cars, msg) => {
        setProgress(pct);
        setProgressMsg(msg);
      });
      if (!Array.isArray(result))
        throw new Error("Unexpected response format from AI");
      setProgress(100);
      setProgressMsg(`${result.length} cars extracted!`);
      setUsage({ inputTokens, outputTokens });
      setTimeout(() => { setRows(result); setStep(2); }, 400);
    } catch (e) {
      setAnalyseError(e.message || "Unknown error");
    }
    setLoading(false);
  };

  const handleStep2 = (editedRows) => {
    setRows(editedRows);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const records = rows.map((r) => {
        const slugBase = [r.year, r.brand, r.model, r.variant]
          .filter(Boolean).join('-')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const slug = slugBase + '-' + Math.random().toString(36).slice(2, 7);
        return {
          slug,
          brand:          r.brand || null,
          model:          r.model || null,
          variant:        r.variant || null,
          year:           r.year ? Number(r.year) : null,
          selling_price:  r.price ? Number(r.price) : null,
          mileage:        r.mileage ? Number(r.mileage) : null,
          colour:         r.color || null,
          transmission:   r.transmission || null,
          fuel_type:      r.fuel_type || null,
          engine_cc:      r.engine_cc ? Number(r.engine_cc) : null,
          condition:      r.condition || null,
          state:          r.state || null,
          is_recon:       (r.condition || '').toLowerCase() === 'recon',
          auction_grade:  r.auction_grade || null,
          interior_grade: r.interior_grade || null,
          import_country: r.import_country || null,
          vin:            r.vin || null,
          images:         r.image_url ? [driveToDirectUrl(r.image_url)].filter(Boolean) : null,
          dealer_id:      user.id,
          status:         "available",
          created_at:     now,
        };
      });

      // Insert into car_listings and get back IDs for stock_units linkage
      const { data: inserted, error } = await supabase
        .from("car_listings")
        .insert(records)
        .select('id, brand, model, variant, year, selling_price, mileage, colour, transmission, fuel_type, engine_cc, is_recon, import_country, auction_grade, interior_grade, vin');
      if (error) throw error;

      // Mirror into stock_units (dealer cost view)
      const stockRows = inserted.map((listing, i) => ({
        dealer_id:      user.id,
        listing_id:     listing.id,
        brand:          listing.brand,
        model:          listing.model,
        variant:        listing.variant,
        year:           listing.year,
        colour:         listing.colour,
        transmission:   listing.transmission,
        fuel_type:      listing.fuel_type,
        engine_cc:      listing.engine_cc,
        mileage:        listing.mileage,
        is_recon:       listing.is_recon,
        import_country: listing.import_country,
        auction_grade:  listing.auction_grade,
        interior_grade: listing.interior_grade,
        vin:            listing.vin,
        purchase_price: rows[i]?.base_price ? Number(rows[i].base_price) : null,
        asking_price:   listing.selling_price,
        status:         'available',
        created_at:     now,
      }));
      const { error: stockError } = await supabase.from("stock_units").insert(stockRows);
      if (stockError) console.warn('stock_units insert partial failure:', stockError.message);

      setImported(inserted.length);
    } catch (e) {
      setImportError(e.message || "Import failed");
    }
    setImporting(false);
  };

  return (
    <div
      className="min-h-screen font-['DM_Sans',sans-serif]"
      style={{ background: "#080C14" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Import Stock</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload a spreadsheet or PDF and let AI extract your listings
          </p>
        </div>

        <StepIndicator current={step} />

        <div
          className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {step === 1 && (
            <>
              {analyseError && (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm text-red-400 break-all" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <p className="font-bold mb-1">Analysis failed</p>
                  <p>{analyseError}</p>
                </div>
              )}
              <Step1Upload onNext={handleStep1} onSample={handleSample} loading={loading} progress={progress} progressMsg={progressMsg} />
            </>
          )}
          {step === 2 && (
            <Step2Preview
              rows={rows}
              usage={usage}
              onBack={() => setStep(1)}
              onNext={handleStep2}
            />
          )}
          {step === 3 && (
            <Step3Import
              rows={rows}
              importing={importing}
              imported={imported}
              error={importError}
              onImport={handleImport}
              onDone={() => navigate("/dashboard")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
