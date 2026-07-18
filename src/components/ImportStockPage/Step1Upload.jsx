import React, { useRef, useState } from 'react';
import { Upload, Link, FileSpreadsheet, FileText, X, Sparkles, Info, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';

// Bulletproof-input limits. A .xlsx is a zip, so an oversized upload is the
// first zip-bomb signal we can cheaply reject before any parser touches it.
const MAX_FILE_MB = 20;
const ALLOWED_EXT = ['xlsx', 'pdf'];
// Real signatures so a renamed executable can't slip through on extension alone.
// PDF = "%PDF", XLSX = PK zip local-file header "PK\x03\x04".
const MAGIC = { pdf: [0x25, 0x50, 0x44, 0x46], xlsx: [0x50, 0x4b, 0x03, 0x04] };

async function sniffMagic(file, ext) {
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const sig = MAGIC[ext];
    return sig.every((b, i) => head[i] === b);
  } catch {
    return false;
  }
}

export default function Step1Upload({ onNext, onSample, loading, progress = 0, progressMsg = '' }) {
  const [file, setFile] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef();

  const accept = '.xlsx,.pdf';

  const pickFile = async (f) => {
    if (!f) return;
    setErr('');
    const ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setErr('Unsupported file. Upload a .xlsx or .pdf stock list, or paste a Google Sheets link.');
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_FILE_MB} MB. Split a very large list into smaller files.`);
      return;
    }
    if (f.size === 0) {
      setErr('That file looks empty. Re-export it and try again.');
      return;
    }
    if (!(await sniffMagic(f, ext))) {
      setErr(`This doesn't look like a real ${ext.toUpperCase()} file — its contents don't match its extension. Re-save it and try again.`);
      return;
    }
    setFile(f);
    setSheetsUrl('');
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  };

  const canProceed = !!file || sheetsUrl.trim().length > 0;
  const FileIcon = file?.name.endsWith('.pdf') ? FileText : FileSpreadsheet;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-5 py-10">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}
        >
          <Sparkles className="w-7 h-7 text-red-500 animate-pulse" />
        </div>

        <div className="w-full space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-white">{progressMsg || 'Analysing…'}</p>
            <p className="text-xs font-bold tabular-nums" style={{ color: '#ef4444' }}>{progress}%</p>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)' }}
            />
          </div>
          <p className="text-xs text-gray-600">This takes 1–2 minutes for large files — hang tight</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Best-results guide trigger */}
      <button
        onClick={() => setShowGuide(true)}
        className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-left transition-colors"
        style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}
      >
        <Info className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
        <span className="text-xs font-semibold text-white flex-1">Before you upload — how to get the best results</span>
        <span className="text-xs font-bold" style={{ color: '#ef4444' }}>Read →</span>
      </button>

      {/* Drop zone */}
      <div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className="rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 py-12 px-6 text-center"
        style={{
          borderColor: drag ? '#dc2626' : 'rgba(255,255,255,0.1)',
          background: drag ? 'rgba(220,38,38,0.04)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <FileIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="ml-2 text-gray-600 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
              <Upload className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Drop file here or <span className="text-red-500">browse</span></p>
              <p className="text-xs text-gray-600 mt-1">Supports .xlsx and .pdf</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pickFile(e.target.files[0])}
        />
      </div>

      {/* Validation error */}
      {err && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
          <p className="text-xs" style={{ color: '#fca5a5' }}>{err}</p>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-xs text-gray-600 font-medium">OR</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Google Sheets URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Link className="w-3 h-3" /> Google Sheets URL
        </label>
        <input
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/…/edit?usp=sharing"
          value={sheetsUrl}
          onChange={(e) => { setSheetsUrl(e.target.value); setFile(null); }}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(220,38,38,0.5)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
        <p className="text-xs text-gray-600">Must be a public share link (anyone with link can view)</p>
      </div>

      <button
        onClick={() => onNext({ file, sheetsUrl: sheetsUrl.trim() })}
        disabled={!canProceed || loading}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
        style={{
          background: canProceed ? '#dc2626' : 'rgba(255,255,255,0.05)',
          color: canProceed ? '#fff' : '#4b5563',
          cursor: canProceed ? 'pointer' : 'not-allowed',
        }}
      >
        Analyse & Preview →
      </button>

      <button
        onClick={onSample}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#4b5563' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
      >
        Load sample data (no token)
      </button>

      {showGuide && <UploadGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}

/* Pre-upload guide — the single biggest cause of a bad import is images/links
   that the file never actually exposes (private Drive links, password-locked
   PDFs, blank columns). This walks the dealer through formatting for the best
   result. Content is based on real dealer stock lists (Drive-folder image links
   embedded per row). */
function UploadGuide({ onClose }) {
  const OK = [
    { t: 'Set image links to "Anyone with the link"', d: 'Photo links (usually Google Drive) must be shared publicly. A private link imports as a broken image. In Drive: right-click the folder → Share → General access → "Anyone with the link".' },
    { t: 'Put an image link in its own column', d: 'One photo link per car in a dedicated column — a Google Drive link or a direct image URL (ending .jpg/.png). Folder links work but pull a whole album; a single-file or direct image link gives the cleanest cover photo.' },
    { t: 'Fill the key columns', d: 'Brand, model, year, price and mileage drive the whole listing. Blank cells import as incomplete listings you’ll have to finish by hand.' },
    { t: 'Mark sold / reserved rows', d: 'Rows noted SOLD, PRESERVED, or ETA (not yet arrived) are skipped automatically — leave the note in your remarks column and they won’t import.' },
  ];
  const AVOID = [
    { t: 'Password-protected or scanned PDFs', d: 'Locked/encrypted files can’t be read. A scanned image of a printed list has no selectable text or links, so nothing can be extracted — export a real PDF or Excel from your system.' },
    { t: 'Photos pasted directly into cells', d: 'An image pasted into a cell (not a link) can’t be pulled out. Use a shareable link instead.' },
    { t: 'More than 50 cars in one file', d: 'Imports are capped at 50 listings per run — split a larger list into batches.' },
  ];
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ width: 'min(560px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '24px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <ShieldCheck className="w-5 h-5" style={{ color: '#ef4444' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>Get the best import</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X className="w-5 h-5" /></button>
        </div>
        <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '0 0 18px', lineHeight: 1.6 }}>
          The importer reads your file as text and matches columns by meaning. Photos are pulled from the links in your file — so how the file is shared matters most.
        </p>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4ade80', margin: '0 0 10px' }}>Do this</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {OK.map((r) => (
            <div key={r.t} style={{ display: 'flex', gap: 9 }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80', marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{r.t}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8b97a7', lineHeight: 1.55 }}>{r.d}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f87171', margin: '0 0 10px' }}>Avoid</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {AVOID.map((r) => (
            <div key={r.t} style={{ display: 'flex', gap: 9 }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171', marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{r.t}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8b97a7', lineHeight: 1.55 }}>{r.d}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: '#dc2626' }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
