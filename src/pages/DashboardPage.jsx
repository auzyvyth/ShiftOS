import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CarForm from '../components/CarForm';
import TikTokGenerator from '../components/TikTokGenerator';
import {
  Car, PlusCircle, LogOut, Home, Trash2, X, TrendingUp, DollarSign,
  Eye, Menu, Building2, Clock, Users, Copy, Check, Phone, Link,
  UserPlus, ToggleLeft, ToggleRight, Video, Tag, Flame,
  BarChart2, MessageSquare, Send, Bot, ChevronRight, AlertCircle,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getListingAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
}

function AgeBadge({ createdAt }) {
  const days = getListingAge(createdAt);
  if (days < 14) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
      <Clock className="w-3 h-3" />{days === 0 ? 'Today' : `${days}d`}
    </span>
  );
  if (days < 30) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-400/10 text-yellow-400">
      <Clock className="w-3 h-3" />{days}d
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
      <Clock className="w-3 h-3" />{days}d
    </span>
  );
}

// ─── Price Edit Modal ─────────────────────────────────────────────────────────

function PriceEditModal({ listing, onClose, onSave }) {
  const currentSelling  = listing.selling_price || 0;
  const currentOriginal = listing.original_price || null;
  const [newPrice, setNewPrice] = useState(String(currentSelling));
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const newPriceVal    = parseFloat(newPrice) || 0;
  const referencePrice = currentOriginal || currentSelling;
  const discountAmt    = referencePrice > newPriceVal ? referencePrice - newPriceVal : 0;
  const discountPct    = referencePrice > 0 ? ((discountAmt / referencePrice) * 100) : 0;
  const isHotDeal      = discountPct >= 3;
  const isIncrease     = newPriceVal > currentSelling;
  const isReset        = currentOriginal && newPriceVal >= currentOriginal;

  const handleSave = async () => {
    setError('');
    if (!newPriceVal || newPriceVal <= 0) { setError('Enter a valid price'); return; }
    if (newPriceVal === currentSelling)   { onClose(); return; }
    setSaving(true);
    try {
      let updatePayload = { selling_price: newPriceVal };
      if (isReset) {
        updatePayload.original_price = null;
      } else if (!currentOriginal && newPriceVal < currentSelling) {
        updatePayload.original_price = currentSelling;
      }
      const { data, error: dbError } = await supabase
        .from('car_listings').update(updatePayload).eq('id', listing.id).select().single();
      if (dbError) throw dbError;
      onSave(data); onClose();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="font-semibold text-white">Adjust Price</h3>
            <p className="text-xs text-gray-500 mt-0.5">{listing.brand} {listing.model} {listing.variant || ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Current price</span>
            <div className="flex items-center gap-2">
              {currentOriginal && <span className="text-gray-600 line-through text-xs">RM {currentOriginal.toLocaleString()}</span>}
              <span className="text-white font-semibold">RM {currentSelling.toLocaleString()}</span>
              {currentOriginal && (
                <span className="text-red-400 text-xs font-medium bg-red-400/10 px-2 py-0.5 rounded-full">
                  −{Math.round(((currentOriginal - currentSelling) / currentOriginal) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">New Selling Price (RM)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">RM</span>
              <input
                type="number" value={newPrice} onChange={e => { setNewPrice(e.target.value); setError(''); }}
                min="0" autoFocus
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>
          {newPriceVal > 0 && newPriceVal !== currentSelling && (
            <div className={`px-4 py-3 rounded-xl border text-sm ${
              isReset    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
              isIncrease ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
              isHotDeal  ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                           'bg-green-500/10 border-green-500/20 text-green-400'
            }`}>
              {isReset && <p className="font-medium">Price raised — discount badge will be removed</p>}
              {!isReset && isIncrease && <p className="font-medium">Price raised by RM {(newPriceVal - currentSelling).toLocaleString()}</p>}
              {!isReset && !isIncrease && (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    {isHotDeal && <Flame className="w-4 h-4" />}
                    <span>RM {discountAmt.toLocaleString()} off ({discountPct.toFixed(1)}%)</span>
                    {isHotDeal && <span className="text-xs font-normal">Hot Deal!</span>}
                  </div>
                  <p className="text-xs opacity-75 mt-1">
                    {!currentOriginal ? 'Current price will be saved as the original price automatically' : 'Original price stays locked — discount updates automatically'}
                  </p>
                  {!isHotDeal && <p className="text-xs opacity-75 mt-0.5">Drop to RM {Math.ceil(referencePrice * 0.97).toLocaleString()} or less for Hot Deals</p>}
                  {isHotDeal && <p className="text-xs opacity-75 mt-0.5">This listing will move to Hot Deals on the homepage</p>}
                </>
              )}
            </div>
          )}
          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠ {error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving || !newPriceVal || newPriceVal <= 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm text-white font-semibold transition-all">
              {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Price'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ listings, profile }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your performance advisor. I can see your inventory data and help you figure out why certain listings aren't converting, which ones to reprice, and how to get more leads. What would you like to know?`,
    },
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const messagesEndRef          = useRef(null);

  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  // ── Derived analytics from listings ──
  const totalListings  = listings.length;
  const activeListings = listings.filter(l => (l.status || 'active') === 'active').length;
  const soldListings   = listings.filter(l => l.status === 'sold').length;
  const hotDeals       = listings.filter(l => {
    const op = l.original_price, sp = l.selling_price;
    return op && op > 0 && sp > 0 && sp <= op * 0.97;
  }).length;
  const avgAge         = totalListings
    ? Math.round(listings.reduce((s, l) => s + getListingAge(l.created_at), 0) / totalListings)
    : 0;
  const staleListings  = listings.filter(l => getListingAge(l.created_at) >= 30 && (l.status || 'active') === 'active');

  // ── Build AI context from real data ──
  const buildContext = () => {
    const listingSummaries = listings.slice(0, 20).map(l => ({
      car: `${l.brand} ${l.model} ${l.variant || ''}`.trim(),
      price: l.selling_price,
      originalPrice: l.original_price || null,
      age: getListingAge(l.created_at),
      status: l.status || 'active',
      condition: l.condition,
      mileage: l.mileage,
      state: l.state,
    }));

    return `You are an AI performance advisor inside ShiftOS, a car dealership SaaS platform for Malaysian independent car dealers.

The dealer's dealership is: ${profile?.dealership || 'Unknown Dealership'}.

Current inventory snapshot:
- Total listings: ${totalListings}
- Active: ${activeListings}
- Sold: ${soldListings}
- Hot Deals (≥3% discount): ${hotDeals}
- Average listing age: ${avgAge} days
- Stale listings (30+ days active): ${staleListings.length}
${staleListings.length > 0 ? `- Stale cars: ${staleListings.map(l => `${l.brand} ${l.model} (${getListingAge(l.created_at)} days)`).join(', ')}` : ''}

Top listings detail:
${listingSummaries.map(l => `- ${l.car} | RM ${l.price?.toLocaleString()} | ${l.age}d old | ${l.status} | ${l.condition} | ${l.mileage ? l.mileage.toLocaleString() + 'km' : 'no mileage'} | ${l.state || 'no location'}${l.originalPrice ? ` | was RM ${l.originalPrice.toLocaleString()}` : ''}`).join('\n')}

Note: Detailed view/click tracking is coming soon — currently only inventory data is available.

Be concise, specific, and actionable. Focus on Malaysian car market context (Carlist, Mudah, WhatsApp buyers, Malay-language buyers). Keep replies under 200 words unless the dealer asks for a detailed breakdown. Don't be generic — reference their actual cars and numbers.`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userMsg });

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildContext(),
          messages: history,
        }),
      });
      const data = await res.json();
      const reply = data.content?.find(b => b.type === 'text')?.text || 'Sorry, I could not generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const QUICK_PROMPTS = [
    'Why are my listings not getting leads?',
    'Which car should I reprice?',
    'Any listings I should remove?',
    'How do I write better descriptions?',
  ];

  return (
    <div className="space-y-4">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Listings', value: activeListings, sub: `of ${totalListings} total`, color: 'text-white', iconBg: 'bg-blue-600/20', iconColor: 'text-blue-400', Icon: Car },
          { label: 'Sold',           value: soldListings,   sub: 'this period',               color: 'text-green-400', iconBg: 'bg-green-600/20', iconColor: 'text-green-400', Icon: TrendingUp },
          { label: 'Hot Deals',      value: hotDeals,       sub: '≥3% off listed',            color: hotDeals > 0 ? 'text-red-400' : 'text-gray-600', iconBg: hotDeals > 0 ? 'bg-red-600/20' : 'bg-gray-800', iconColor: hotDeals > 0 ? 'text-red-400' : 'text-gray-600', Icon: Flame },
          { label: 'Avg. Age',       value: `${avgAge}d`,   sub: avgAge >= 30 ? '⚠ Listings aging' : 'Healthy turnover', color: avgAge >= 30 ? 'text-yellow-400' : 'text-white', iconBg: avgAge >= 30 ? 'bg-yellow-600/20' : 'bg-gray-800', iconColor: avgAge >= 30 ? 'text-yellow-400' : 'text-gray-500', Icon: Clock },
        ].map(({ label, value, sub, color, iconBg, iconColor, Icon }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 text-xs">{label}</p>
              <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${color} leading-tight`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tracking coming soon banner ── */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <BarChart2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-300 text-sm font-medium">Website tracking coming soon</p>
          <p className="text-blue-400/60 text-xs mt-0.5">Views, clicks, and lead conversion per listing will appear here once tracking is live. The AI advisor already works with your current inventory data.</p>
        </div>
      </div>

      {/* ── Stale listings alert ── */}
      {staleListings.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <p className="text-yellow-300 text-sm font-semibold">{staleListings.length} listing{staleListings.length > 1 ? 's' : ''} aging 30+ days</p>
          </div>
          <div className="space-y-2">
            {staleListings.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-yellow-500/10 last:border-0">
                <div className="flex items-center gap-3">
                  {l.images?.[0]
                    ? <img src={l.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-lg bg-gray-800 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-white text-sm font-medium">{l.brand} {l.model}</p>
                    <p className="text-gray-500 text-xs">{l.variant || '—'} · RM {l.selling_price?.toLocaleString()}</p>
                  </div>
                </div>
                <span className="text-yellow-400 text-xs font-semibold bg-yellow-400/10 px-2.5 py-1 rounded-full">{getListingAge(l.created_at)}d</span>
              </div>
            ))}
          </div>
          {staleListings.length > 5 && <p className="text-gray-500 text-xs mt-2">+{staleListings.length - 5} more stale listings</p>}
        </div>
      )}

      {/* ── Per-listing performance table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="font-semibold text-white text-sm">Listing Performance</h2>
            <p className="text-xs text-gray-500 mt-0.5">Views & leads tracking activates once traffic is live</p>
          </div>
        </div>
        {listings.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No listings to analyse yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Vehicle', 'Price', 'Age', 'Views', 'Leads', 'CVR', 'Status'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {listings.map(l => {
                  const age = getListingAge(l.created_at);
                  const isStale = age >= 30 && (l.status || 'active') === 'active';
                  return (
                    <tr key={l.id} className={`hover:bg-gray-800/30 transition-colors ${isStale ? 'bg-red-950/10' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {l.images?.[0]
                            ? <img src={l.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0" />
                            : <div className="w-8 h-8 rounded-lg bg-gray-800 flex-shrink-0" />
                          }
                          <div className="min-w-0">
                            <p className="font-medium text-white text-sm truncate">{l.brand} {l.model}</p>
                            <p className="text-gray-500 text-xs truncate">{l.variant || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white text-sm font-medium">RM {l.selling_price?.toLocaleString() || '—'}</td>
                      <td className="px-4 py-3"><AgeBadge createdAt={l.created_at} /></td>
                      <td className="px-4 py-3 text-gray-600 text-sm">—</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">—</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">—</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          (l.status || 'active') === 'active'   ? 'bg-green-400/10 text-green-400'  :
                          l.status === 'reserved' ? 'bg-yellow-400/10 text-yellow-400' :
                                                    'bg-red-400/10 text-red-400'
                        }`}>{l.status || 'active'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AI Advisor ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Header — always visible, toggles chat */}
        <button
          onClick={() => setChatOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-semibold">AI Performance Advisor</p>
              <p className="text-gray-500 text-xs mt-0.5">Ask anything about your inventory & performance</p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${chatOpen ? 'rotate-90' : ''}`} />
        </button>

        {/* Chat body */}
        {chatOpen && (
          <div className="border-t border-gray-800">
            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-red-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-red-600 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-red-400" />
                  </div>
                  <div className="bg-gray-800 px-3.5 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts — only show when no conversation yet */}
            {messages.length === 1 && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => { setInput(p); }}
                    className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-full transition-all">
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-gray-800 flex gap-2 items-end">
              <textarea
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your listings, pricing, leads…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors resize-none"
                style={{ maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-9 h-9 flex items-center justify-center bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-xl transition-all flex-shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab({ managerDealership }) {
  const [salespeople, setSalespeople] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError]     = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading]   = useState(false);
  const [addError, setAddError]       = useState('');
  const [addSuccess, setAddSuccess]   = useState('');
  const [copiedId, setCopiedId]       = useState(null);
  const [togglingId, setTogglingId]   = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [slug, setSlug]               = useState('');
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => { fetchTeam(); }, [managerDealership]);

  const fetchTeam = async () => {
    if (!managerDealership) {
      setSalespeople([]); setTeamError('Your dealership profile is missing.'); setLoadingTeam(false); return;
    }
    setLoadingTeam(true); setTeamError('');
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'salesman').eq('dealership', managerDealership).order('created_at', { ascending: false });
    if (error) { setSalespeople([]); setTeamError(error.message || 'Failed to load team.'); setLoadingTeam(false); return; }
    setSalespeople(data || []); setLoadingTeam(false);
  };

  const slugify = (val) => val.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const handleNameChange = (val) => { setName(val); setSlug(slugify(val.trim().split(' ')[0])); };
  const resetForm = () => { setName(''); setEmail(''); setPhone(''); setSlug(''); setTempPassword(''); setAddError(''); setAddSuccess(''); };

  const handleAddSalesman = async () => {
    setAddError('');
    const cleanedName = name.trim(), cleanedEmail = email.trim().toLowerCase(), cleanedSlug = slug.trim(), cleanedPhone = phone.trim() || null;
    if (!managerDealership)                                            { setAddError('Manager dealership is required.'); return; }
    if (!cleanedName || !cleanedEmail || !cleanedSlug || !tempPassword) { setAddError('Name, email, slug and password are required.'); return; }
    if (tempPassword.length < 8)                                        { setAddError('Password must be at least 8 characters.'); return; }
    if (!/^[a-z0-9]+$/.test(cleanedSlug))                              { setAddError('Slug can only contain lowercase letters and numbers.'); return; }
    setAddLoading(true);
    try {
      const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const pending = { id, full_name: cleanedName, email: cleanedEmail, phone: cleanedPhone, dealership: managerDealership, role: 'salesman', slug: cleanedSlug, is_active: true, created_at: new Date().toISOString(), pending_profile: true };
      const res = await fetch(`${SERVER_URL}/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      if (!res.ok) { const json = await res.json().catch(() => ({})); setAddError(json.message || 'Failed to save invite.'); setAddLoading(false); return; }
      setSalespeople(prev => [pending, ...prev]);
      setAddSuccess(`${cleanedName} has been invited.`);
    } catch { setAddError('Could not reach the server.'); }
    setAddLoading(false);
  };

  const handleCopyLink     = (s) => { navigator.clipboard.writeText(`${window.location.origin}/cars?ref=${s.slug}`); setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000); };
  const handleToggleActive = async (s) => {
    if (s.pending_profile) return;
    setTogglingId(s.id);
    const { error } = await supabase.from('profiles').update({ is_active: !s.is_active }).eq('id', s.id);
    if (!error) setSalespeople(prev => prev.map(p => p.id === s.id ? { ...p, is_active: !p.is_active } : p));
    setTogglingId(null);
  };
  const handleDeleteSalesman = async (id) => { await supabase.from('profiles').delete().eq('id', id); setSalespeople(prev => prev.filter(p => p.id !== id)); setDeleteConfirmId(null); };

  const activeCount   = salespeople.filter(s => s.is_active !== false).length;
  const inactiveCount = salespeople.filter(s => s.is_active === false).length;
  const activeRate    = salespeople.length ? Math.round((activeCount / salespeople.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Staff', value: salespeople.length, sub: 'in your dealership', color: 'text-white' },
          { label: 'Active',      value: activeCount,        sub: `${activeRate}% available`, color: 'text-green-400' },
          { label: 'Inactive',    value: inactiveCount,      sub: 'disabled accounts',  color: 'text-gray-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-600 mt-1 hidden sm:block">{sub}</p>
          </div>
        ))}
      </div>

      {/* Salespeople list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-800">
          <div>
            <h2 className="font-semibold text-white">Salespeople</h2>
            <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Manage accounts, links, and status.</p>
          </div>
          <button
            onClick={() => { setShowAddForm(true); resetForm(); }}
            disabled={!managerDealership}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all"
          >
            <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Add Salesman</span><span className="sm:hidden">Add</span>
          </button>
        </div>

        {teamError && <div className="m-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5 text-yellow-300 text-xs">⚠ {teamError}</div>}

        {loadingTeam ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading team...</div>
        ) : salespeople.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">No salespeople added yet</p>
            <button onClick={() => { setShowAddForm(true); resetForm(); }} disabled={!managerDealership}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all">
              Add your first salesman
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {salespeople.map((s) => (
              <div key={s.id} className={`p-4 transition-colors ${s.is_active === false ? 'opacity-60' : 'hover:bg-gray-800/20'}`}>
                <div className="flex items-start gap-3">
                  {s.avatar_url
                    ? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-red-600/80 flex items-center justify-center font-bold text-sm flex-shrink-0">{(s.full_name || 'S')[0].toUpperCase()}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-white truncate">{s.full_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active !== false ? 'bg-green-400/10 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                        {s.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-400">
                      <span className="truncate max-w-[200px]">{s.email}</span>
                      {s.phone && <><span className="text-gray-700">·</span><span>{s.phone}</span></>}
                    </div>
                    {s.slug && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-400">
                          <Link className="w-3 h-3 text-gray-500" />
                          /cars?ref=<span className="text-white font-medium">{s.slug}</span>
                        </div>
                        <button onClick={() => handleCopyLink(s)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg px-2 py-1.5 transition-all">
                          {copiedId === s.id ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 max-w-xs">
                      {[['0', 'Clicks'], ['0', 'Enquiries'], ['0', 'Sales']].map(([v, lbl]) => (
                        <div key={lbl} className="bg-gray-800/60 border border-gray-700/50 rounded-lg px-2.5 py-2">
                          <p className="text-sm font-semibold text-white">{v}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{lbl}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => handleToggleActive(s)} disabled={togglingId === s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:border-gray-600 rounded-lg text-xs text-gray-400 hover:text-white transition-all disabled:opacity-50">
                      {s.is_active !== false
                        ? <><ToggleRight className="w-3.5 h-3.5 text-green-400" /><span className="hidden sm:inline">Deactivate</span></>
                        : <><ToggleLeft className="w-3.5 h-3.5 text-gray-500" /><span className="hidden sm:inline">Activate</span></>
                      }
                    </button>
                    <button onClick={() => setDeleteConfirmId(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-all">
                      <Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-semibold text-white">Remove Salesman?</h3><p className="text-gray-500 text-xs mt-0.5">Their login account will still exist unless disabled separately.</p></div>
              <button onClick={() => setDeleteConfirmId(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-all">Cancel</button>
              <button onClick={() => handleDeleteSalesman(deleteConfirmId)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm text-white font-semibold transition-all">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add salesman modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <div><h3 className="font-semibold text-white">Add Salesman</h3><p className="text-xs text-gray-500 mt-0.5">Create account and trackable link</p></div>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {addSuccess ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-green-400" /></div>
                  <p className="text-green-400 font-semibold mb-1">Salesman added!</p>
                  <p className="text-gray-500 text-sm mb-6">{addSuccess}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-2.5 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-all">Done</button>
                    <button onClick={resetForm} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm text-white font-semibold transition-all">Add Another</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                      <input type="text" placeholder="Ahmad bin Abdullah" value={name} onChange={e => handleNameChange(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Email *</label>
                      <input type="email" placeholder="ahmad@autocity.my" value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
                      <input type="tel" placeholder="+60 12-345 6789" value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Temp Password *</label>
                      <input type="text" placeholder="Min 8 characters" value={tempPassword} onChange={e => setTempPassword(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Unique Slug *</label>
                    <div className="flex">
                      <span className="bg-gray-700 border border-r-0 border-gray-600 rounded-l-xl px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">/cars?ref=</span>
                      <input type="text" placeholder="ahmad" value={slug} onChange={e => setSlug(slugify(e.target.value))}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-r-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Auto-filled from name. Lowercase + numbers only.</p>
                  </div>
                  {addError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-red-400 text-xs">⚠ {addError}</div>}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-2.5 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-all">Cancel</button>
                    <button onClick={handleAddSalesman} disabled={addLoading}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm text-white font-semibold transition-all">
                      {addLoading ? 'Creating...' : 'Add Salesman'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [listings, setListings]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [activeTab, setActiveTab]           = useState('listings');
  const [deleteId, setDeleteId]             = useState(null);
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [tiktokListing, setTiktokListing]   = useState(null);
  const [priceEditListing, setPriceEditListing] = useState(null);
  const [profile, setProfile]               = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => { document.title = 'ShiftOS - Admin Panel'; }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) { navigate('/login'); return; }
      const userId = data.session.user.id;
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profileData) {
        if (profileData.role === 'salesman') { navigate('/salesman'); return; }
        setProfile(profileData);
      } else {
        const meta = data.session.user.user_metadata;
        setProfile({ full_name: meta?.full_name || meta?.name || data.session.user.email, email: data.session.user.email, avatar_url: meta?.avatar_url || meta?.picture || null, role: meta?.role || null, dealership: meta?.dealership || null });
      }
    });
    supabase.from('car_listings').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      setListings(error ? [] : data || []);
      setLoading(false);
    });
  }, [navigate]);

  const handleLogout    = async () => { await supabase.auth.signOut(); navigate('/login'); };
  const handleNew       = (listing) => { setListings(prev => [listing, ...prev]); setActiveTab('listings'); };
  const handleTabChange = (tab) => { setActiveTab(tab); setSidebarOpen(false); };
  const handleDelete    = async (id) => {
    const { error } = await supabase.from('car_listings').delete().eq('id', id);
    if (!error) setListings(prev => prev.filter(l => l.id !== id));
    setDeleteId(null);
  };
  const handleStatusChange = async (id, newStatus) => {
    setUpdatingStatus(id);
    const { error } = await supabase.from('car_listings').update({ status: newStatus }).eq('id', id);
    if (!error) setListings(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    setUpdatingStatus(null);
  };
  const handlePriceSaved = (updatedListing) => {
    setListings(prev => prev.map(l => l.id === updatedListing.id ? updatedListing : l));
  };

  // ── Derived stats ──
  const totalValue   = listings.reduce((sum, l) => sum + (l.selling_price || 0), 0);
  const avgPrice     = listings.length ? Math.round(totalValue / listings.length) : 0;
  const hotDealCount = listings.filter(l => {
    const op = l.original_price, sp = l.selling_price;
    return op && op > 0 && sp > 0 && sp <= op * 0.97;
  }).length;

  const STATUS_CONFIG = {
    active:   { label: 'Active',   dot: 'bg-green-400',  text: 'text-green-400',  bg: 'bg-green-400/10',  next: 'reserved' },
    reserved: { label: 'Reserved', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-400/10', next: 'sold'     },
    sold:     { label: 'Sold',     dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-400/10',    next: 'active'   },
  };

  const StatusBadge = ({ listing }) => {
    const s = listing.status || 'active';
    const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.active;
    const busy = updatingStatus === listing.id;
    return (
      <button onClick={() => handleStatusChange(listing.id, cfg.next)} disabled={busy}
        title={`Click to mark as ${STATUS_CONFIG[cfg.next].label}`}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${cfg.bg} ${cfg.text} ${busy ? 'opacity-50 cursor-wait' : 'hover:opacity-75 cursor-pointer'}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${busy ? 'animate-pulse bg-gray-400' : cfg.dot}`} />
        {busy ? '…' : cfg.label}
      </button>
    );
  };

  const AvatarDisplay = ({ size = 'md' }) => {
    const sz = size === 'lg' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';
    if (profile?.avatar_url) return <img src={profile.avatar_url} alt="avatar" className={`${sz} rounded-full object-cover flex-shrink-0`} />;
    return <div className={`${sz} rounded-full bg-red-600 flex items-center justify-center font-bold flex-shrink-0`}>{(profile?.full_name || profile?.email || 'A')[0].toUpperCase()}</div>;
  };

  const DiscountCell = ({ listing }) => {
    const op = listing.original_price || listing.previous_price || null;
    const sp = listing.selling_price  || listing.price          || null;
    if (!op || !sp || op <= sp) return <span className="text-white font-semibold text-sm">RM {sp?.toLocaleString()}</span>;
    const pct = Math.round(((op - sp) / op) * 100);
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold text-sm">RM {sp.toLocaleString()}</span>
          <span className="car-card-discount-inline flex-shrink-0">
            {pct >= 3 && <Flame className="w-3 h-3" />}−{pct}%
          </span>
        </div>
        <p className="text-gray-600 text-xs line-through mt-0.5">RM {op.toLocaleString()}</p>
      </div>
    );
  };

  const conditionStyle = (c) => ({
    new:   'bg-green-500/15 text-green-400',
    recon: 'bg-blue-500/15 text-blue-400',
    used:  'bg-gray-500/15 text-gray-400',
  }[c] || 'bg-gray-500/15 text-gray-400');

  const PAGE_TITLES = {
    listings:  { title: 'Listings',   sub: 'Manage your inventory' },
    add:       { title: 'Add Listing', sub: 'Upload a new car to your inventory' },
    team:      { title: 'Team',        sub: 'Manage salespeople and track performance' },
    analytics: { title: 'Analytics',   sub: 'Performance overview & AI advisor' },
  };

  // ── Sidenav items ──
  const NAV_ITEMS = [
    { id: 'listings',  Icon: Car,       label: 'Listings',   badge: listings.length },
    { id: 'add',       Icon: PlusCircle, label: 'Add Listing' },
    { id: 'analytics', Icon: BarChart2,  label: 'Analytics' },
    { id: 'team',      Icon: Users,      label: 'Team' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`fixed h-full z-30 flex flex-col w-60 bg-gray-900 border-r border-gray-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="px-5 py-5 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-base flex-shrink-0">S</div>
          <div><p className="font-bold text-white tracking-wide text-sm">ShiftOS</p><p className="text-xs text-gray-500">Admin Panel</p></div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, Icon, label, badge }) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />{label}
              {badge !== undefined && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>{badge}</span>
              )}
            </button>
          ))}
          <a href="/" target="_blank" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
            <Home className="w-4 h-4 flex-shrink-0" />View Site<Eye className="w-3 h-3 ml-auto" />
          </a>
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <AvatarDisplay size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || '—'}</p>
              <p className="text-xs text-gray-500 truncate">{profile?.email || ''}</p>
            </div>
          </div>
          {profile?.dealership && (
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mt-1 mx-2">
              <Building2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-gray-200 truncate">{profile.dealership}</p>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all mt-1">
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 lg:ml-60 min-w-0 flex flex-col">

        <div className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-600 flex items-center justify-center font-bold text-xs">S</div>
            <span className="font-bold text-white text-sm">ShiftOS</span>
          </div>
          <span className="ml-1 text-gray-500 text-sm">{PAGE_TITLES[activeTab]?.title}</span>
          <div className="ml-auto"><AvatarDisplay /></div>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">

          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{PAGE_TITLES[activeTab]?.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{PAGE_TITLES[activeTab]?.sub}</p>
          </div>

          {/* ── Listings tab ── */}
          {activeTab === 'listings' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total Listings', value: listings.length,           sub: 'Active inventory',      icon: Car,       iconBg: 'bg-red-600/20',    iconColor: 'text-red-400',    valueColor: 'text-white' },
                  { label: 'Total Value',    value: `RM ${totalValue.toLocaleString()}`, sub: 'Combined price', icon: DollarSign, iconBg: 'bg-green-600/20',  iconColor: 'text-green-400',  valueColor: 'text-white' },
                  { label: 'Avg. Price',     value: `RM ${avgPrice.toLocaleString()}`,  sub: 'Per vehicle',    icon: TrendingUp, iconBg: 'bg-purple-600/20', iconColor: 'text-purple-400', valueColor: 'text-white' },
                  { label: 'Hot Deals',      value: hotDealCount,               sub: hotDealCount > 0 ? 'On homepage' : 'No discounts', icon: Flame, iconBg: hotDealCount > 0 ? 'bg-red-600/20' : 'bg-gray-800', iconColor: hotDealCount > 0 ? 'text-red-400' : 'text-gray-600', valueColor: hotDealCount > 0 ? 'text-red-400' : 'text-gray-600' },
                ].map(({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor }) => (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-500 text-xs">{label}</p>
                      <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                      </div>
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold ${valueColor} leading-tight`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">{sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <h2 className="font-semibold text-white text-sm">All Vehicles <span className="text-gray-600 font-normal">({listings.length})</span></h2>
                  <button onClick={() => setActiveTab('add')}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all">
                    <PlusCircle className="w-3.5 h-3.5" />Add
                  </button>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-gray-500 text-sm">Loading...</div>
                ) : listings.length === 0 ? (
                  <div className="p-12 text-center">
                    <Car className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-4">No listings yet</p>
                    <button onClick={() => setActiveTab('add')} className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Add your first car</button>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800">
                            {['Vehicle', 'Condition', 'Mileage', 'Location', 'Price', 'Listed', 'Status', ''].map((h, i) => (
                              <th key={i} className={`px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                          {listings.map((l) => {
                            const age = getListingAge(l.created_at);
                            const bodyType = l.body_type || l.bodyType || null;
                            return (
                              <tr key={l.id} className={`hover:bg-gray-800/30 transition-colors ${age >= 30 ? 'bg-red-950/10' : ''}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    {l.images?.[0]
                                      ? <img src={l.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-800 flex-shrink-0" />
                                      : <div className="w-9 h-9 rounded-lg bg-gray-800 flex-shrink-0" />
                                    }
                                    <div className="min-w-0">
                                      <p className="font-medium text-white text-sm truncate">{l.brand} {l.model}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <p className="text-gray-500 text-xs truncate">{l.variant || '—'}</p>
                                        {bodyType && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 text-gray-500">{bodyType}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionStyle(l.condition)}`}>{l.condition}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-sm">{l.mileage ? Number(l.mileage).toLocaleString() + ' km' : '—'}</td>
                                <td className="px-4 py-3 text-gray-300 text-sm">{l.state || '—'}</td>
                                <td className="px-4 py-3"><DiscountCell listing={l} /></td>
                                <td className="px-4 py-3"><AgeBadge createdAt={l.created_at} /></td>
                                <td className="px-4 py-3"><StatusBadge listing={l} /></td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-0.5 justify-end">
                                    <button onClick={() => setPriceEditListing(l)} title="Adjust price" className="p-1.5 text-gray-600 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-all"><Tag className="w-4 h-4" /></button>
                                    <button onClick={() => setTiktokListing(l)} title="TikTok slides" className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Video className="w-4 h-4" /></button>
                                    <button onClick={() => setDeleteId(l.id)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden divide-y divide-gray-800/50">
                      {listings.map((l) => {
                        const bodyType = l.body_type || l.bodyType || null;
                        return (
                          <div key={l.id} className={`p-4 ${getListingAge(l.created_at) >= 30 ? 'bg-red-950/10' : ''}`}>
                            <div className="flex items-start gap-3">
                              {l.images?.[0]
                                ? <img src={l.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-800 flex-shrink-0" />
                                : <div className="w-14 h-14 rounded-xl bg-gray-800 flex-shrink-0" />
                              }
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white text-sm leading-tight">{l.brand} {l.model}</p>
                                    <p className="text-gray-500 text-xs mt-0.5">{l.variant || '—'}{bodyType ? ` · ${bodyType}` : ''}</p>
                                  </div>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    <button onClick={() => setPriceEditListing(l)} className="p-1.5 text-gray-600 hover:text-green-400 rounded-lg transition-all"><Tag className="w-4 h-4" /></button>
                                    <button onClick={() => setTiktokListing(l)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition-all"><Video className="w-4 h-4" /></button>
                                    <button onClick={() => setDeleteId(l.id)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </div>
                                <div className="mb-2"><DiscountCell listing={l} /></div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionStyle(l.condition)}`}>{l.condition}</span>
                                  {l.mileage && <span className="text-xs text-gray-400">{Number(l.mileage).toLocaleString()} km</span>}
                                  {l.state && <span className="text-xs text-gray-400">{l.state}</span>}
                                  <AgeBadge createdAt={l.created_at} />
                                  <StatusBadge listing={l} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'add' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
              <CarForm onCreate={handleNew} />
            </div>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab listings={listings} profile={profile} />
          )}

          {activeTab === 'team' && <TeamTab managerDealership={profile?.dealership} />}
        </div>
      </main>

      {/* ── Delete modal ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-semibold text-white">Delete Listing?</h3><p className="text-gray-500 text-xs mt-0.5">This action cannot be undone.</p></div>
              <button onClick={() => setDeleteId(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-5">This will permanently remove the car listing from your inventory.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm text-white font-semibold transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {priceEditListing && (
        <PriceEditModal listing={priceEditListing} onClose={() => setPriceEditListing(null)} onSave={handlePriceSaved} />
      )}

      {tiktokListing && <TikTokGenerator listing={tiktokListing} onClose={() => setTiktokListing(null)} />}
    </div>
  );
}