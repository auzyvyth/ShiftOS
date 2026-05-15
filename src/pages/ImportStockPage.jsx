import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import StepIndicator from "../components/ImportStockPage/StepIndicator";
import Step1Upload from "../components/ImportStockPage/Step1Upload";
import Step2Preview from "../components/ImportStockPage/Step2Preview";
import Step3Import from "../components/ImportStockPage/Step3Import";

const AI_PROXY = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/ai/messages`;
const SYSTEM_PROMPT = `You are a data extraction assistant for a car dealership platform.
Extract all car listings from the provided data and return ONLY a JSON array. No markdown, no explanation. Each object must follow this exact schema:
{"brand":"","model":"","variant":"","year":null,"price":null,"mileage":null,"color":"","transmission":"","fuel_type":"","engine_cc":null,"condition":"","state":"","auction_grade":"","interior_grade":"","import_country":"","image_url":"","description":""}
Map any column names you find to the closest matching field.
SKIP any row where the REMARKS column contains "SOLD" — do not include sold units.
SKIP any row where the ARR column is "ETA DELAY" — only include arrived stock (ARR = "Y" or blank).
For price: use the ADS PRICE column if present (the final selling/advertised price), NOT the BASE PRICE or cost price.
For import_country: use the C.O. column — "JP" or "JPN" = "Japan", "UK" = "UK", "MY" = "Malaysia". Null if not found.
For image_url: look for any column containing a URL (http/https link, Google Drive link, Dropbox link, or any web URL). Extract the full URL exactly as written. Null if not found.
Transmission must be "Auto" or "Manual".
Fuel type must be "Petrol", "Diesel", "Hybrid", or "Electric".
Condition must be "Used", "New", or "Recon".
auction_grade: exterior grade e.g. "4.5","4","3.5","3","R","S". Null if not found.
interior_grade: "A","B","C","D". Null if not found.
state: Malaysian state where the car is located e.g. "Selangor","Kuala Lumpur","Johor". Null if not found.
Null for any field you cannot find.`;

const SAMPLE_ROWS = [
  { brand:'Toyota', model:'Alphard', variant:'2.5 SC', year:2022, price:280000, mileage:18000, color:'Pearl White', transmission:'Auto', fuel_type:'Petrol', engine_cc:2494, condition:'Recon', state:'Selangor', auction_grade:'4.5', interior_grade:'A', import_country:'Japan', description:'' },
  { brand:'Honda', model:'Vezel', variant:'1.5 RS e:HEV', year:2023, price:155000, mileage:9000, color:'Platinum White', transmission:'Auto', fuel_type:'Hybrid', engine_cc:1496, condition:'Recon', state:'Kuala Lumpur', auction_grade:'4', interior_grade:'A', import_country:'Japan', description:'' },
  { brand:'Mazda', model:'CX-5', variant:'2.0 SkyActiv', year:2021, price:125000, mileage:32000, color:'Soul Red Crystal', transmission:'Auto', fuel_type:'Petrol', engine_cc:1997, condition:'Recon', state:'Johor', auction_grade:'3.5', interior_grade:'B', import_country:'Japan', description:'' },
  { brand:'Toyota', model:'Vellfire', variant:'2.5 Z-G', year:2020, price:320000, mileage:24000, color:'White Pearl', transmission:'Auto', fuel_type:'Petrol', engine_cc:2494, condition:'Recon', state:'Selangor', auction_grade:'4', interior_grade:'A', import_country:'Japan', description:'' },
  { brand:'Nissan', model:'X-Trail', variant:'2.0 4WD', year:2022, price:110000, mileage:15000, color:'Brilliant Silver', transmission:'Auto', fuel_type:'Petrol', engine_cc:1997, condition:'Recon', state:'Penang', auction_grade:'4.5', interior_grade:'A', import_country:'Japan', description:'' },
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
    const b64 = await readFileAsBase64(file);
    return [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: b64,
            },
          },
          {
            type: "text",
            text: "Extract all car listings from this PDF document.",
          },
        ],
      },
    ];
  }

  throw new Error("Unsupported file type");
}

async function callClaude(messages) {
  const res = await fetch(AI_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `API error ${res.status}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON from response");
  }
}

export default function ImportStockPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState("");

  const handleSample = () => {
    setRows(SAMPLE_ROWS);
    setStep(2);
  };

  const handleStep1 = async ({ file, sheetsUrl }) => {
    setLoading(true);
    try {
      const messages = await buildClaudeMessages(file, sheetsUrl);
      const parsed = await callClaude(messages);
      if (!Array.isArray(parsed))
        throw new Error("Unexpected response format from AI");
      setRows(parsed);
      setStep(2);
    } catch (e) {
      alert(`Analysis failed: ${e.message}`);
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
          description:    r.description || null,
          state:          r.state || null,
          is_recon:       (r.condition || '').toLowerCase() === 'recon',
          auction_grade:  r.auction_grade || null,
          interior_grade: r.interior_grade || null,
          import_country: r.import_country || null,
          images:         r.image_url ? [driveToDirectUrl(r.image_url)].filter(Boolean) : null,
          dealer_id:      user.id,
          status:         "available",
          created_at:     now,
        };
      });

      const { error } = await supabase.from("car_listings").insert(records);
      if (error) throw error;
      setImported(records.length);
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
          {step === 1 && <Step1Upload onNext={handleStep1} onSample={handleSample} loading={loading} />}
          {step === 2 && (
            <Step2Preview
              rows={rows}
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
