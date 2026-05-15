import React, { useRef, useState } from 'react';
import { Upload, Link, FileSpreadsheet, FileText, X } from 'lucide-react';

export default function Step1Upload({ onNext, onSample, loading }) {
  const [file, setFile] = useState(null);
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const accept = '.xlsx,.pdf';

  const pickFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'pdf'].includes(ext)) return;
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

  return (
    <div className="space-y-5">
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
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
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
          background: canProceed && !loading ? '#dc2626' : 'rgba(255,255,255,0.05)',
          color: canProceed && !loading ? '#fff' : '#4b5563',
          cursor: canProceed && !loading ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? 'Analysing with AI…' : 'Analyse & Preview →'}
      </button>

      <button
        onClick={onSample}
        disabled={loading}
        className="w-full py-2 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#4b5563' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
      >
        Load sample data (no token)
      </button>
    </div>
  );
}
