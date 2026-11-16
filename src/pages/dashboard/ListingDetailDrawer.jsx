import React, { useEffect, useState } from "react";
import { useModalHistory } from "../../hooks/useModalHistory";
import ShareMenu from "../../components/ShareMenu";
import { getDealerIdFromProfile } from "../../hooks/useProfile";
import { getStorefrontUrl as buildStorefrontUrl } from "../../hooks/useTenant";
import { usePermissions } from "../../hooks/usePermissions";
import OwnerCarPanel from "../../components/inventory/OwnerCarPanel";
import CarDetailsPanel, { CarSheetTabs } from "../../components/inventory/CarDetailsPanel";
import CarAnalyticsPanel from "../../components/inventory/CarAnalyticsPanel";
import { color, border } from "../../theme/tokens";
import { calcMonthly, DEFAULT_EIR } from "../../utils/financing";
import { Trash2, X, DollarSign, Clock, Copy, Check, UserPlus, Tag, ChevronRight, CheckCircle2, Pencil, Clipboard, Save, Megaphone, Shield, ChevronLeft, Calculator, Printer, Wrench, Film, ShieldCheck } from "lucide-react";
const FinancingCalculator = React.lazy(() => import("../../components/FinancingCalculator"));

export default function ListingDetailDrawer({
  listing, salesmen, salesmenById, onClose, onUpdate, onDelete,
  setEditListing, setPriceEditListing, setMarkSoldListing,
  setDeleteId, copyListing, copiedListingId, dealerSubdomain, dealerSlug, handleAssign, handleUnassign,
  handleStatus, updatingStatus, getListingAge, userId, profile, openStudio, openSticker, initialTab = 'specs',
}) {
  useModalHistory(true, onClose);
  const { can } = usePermissions(profile);
  const canViewCosts = can('view_cost');
  const [imgIdx, setImgIdx]       = useState(0);
  const [lbOpen, setLbOpen]       = useState(false);
  useModalHistory(lbOpen, () => setLbOpen(false));
  const [drawerTab, setDrawerTab] = useState(initialTab === 'owner' && !canViewCosts ? 'specs' : initialTab);
  const [ownerTool, setOwnerTool] = useState(null);
  useEffect(() => { if (drawerTab !== 'owner') setOwnerTool(null); }, [drawerTab]);
  const [showAssign, setShowAssign] = useState(false);
  const [calcOpen,  setCalcOpen]  = useState(false);
  useModalHistory(calcOpen, () => setCalcOpen(false));
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const images = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images : ['/placeholder-car.jpg'];
  const sp = listing.selling_price || listing.price || 0;
  const monthly = calcMonthly(sp);
  const isSold   = listing.status === 'sold';
  const age      = getListingAge(listing.created_at);
  const sCfg = ({ available: { dot: '#047857' }, reserved: { dot: '#6b7280' }, sold: { dot: '#9ca3af' } })[listing.status || 'available'] || { dot: '#047857' };

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (lbOpen) setLbOpen(false); else onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lbOpen, onClose]);

  // premiumLight action rows (owner 2026-11-16, no tints): grey fill, ink words, no borders.
  // The one red fill is Mark as Sold; Delete keeps red as a WORD.
  const btnBase = { width: '100%', background: '#f5f6f8', borderRadius: 10, padding: '11px 14px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.2s', border: 'none', fontFamily: 'inherit', color: '#111827' };
  const BTN_HOVER = '#eceef1';

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', overflowY: 'auto', overscrollBehavior: 'contain' }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          style={{ position: 'relative', margin: isMobile ? 0 : '24px auto', maxWidth: isMobile ? '100vw' : 1100, width: isMobile ? '100vw' : 'calc(100vw - 48px)', height: isMobile ? '100dvh' : undefined, maxHeight: isMobile ? '100dvh' : 'calc(100vh - 48px)', background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: isMobile ? 0 : 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "system-ui, sans-serif" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: isMobile ? 18 : 14, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: 999, background: '#f5f6f8', border: 'none', color: '#4b5563', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
            {/* LEFT */}
            <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? 'none' : '1px solid #e5e7eb', overflowY: isMobile ? 'visible' : 'auto' }}>

              {/* One pop-up, three buttons (owner, 2026-11-12): Details | Owner | Analytics. Owner needs view_cost. */}
              {/* On a phone the close button sits over this row's right end: leave it room. */}
              <div style={{ paddingRight: isMobile ? 44 : 0 }}>
              <CarSheetTabs
                tabs={[{ id: 'specs', label: 'Details' }, ...(canViewCosts ? [{ id: 'owner', label: 'Owner · P&L' }] : []), { id: 'analytics', label: 'Analytics' }]}
                value={drawerTab === 'owner' || drawerTab === 'analytics' ? drawerTab : 'specs'}
                onChange={setDrawerTab}
              />
              </div>

              {drawerTab === 'owner' && canViewCosts ? (
                <OwnerCarPanel
                  listing={listing} userId={userId} salesmenById={salesmenById}
                  tool={ownerTool} setTool={setOwnerTool}
                  onStatusChange={(s) => { handleStatus(listing.id, s); onUpdate({ ...listing, status: s }); }}
                  statusUpdating={updatingStatus === listing.id}
                  onMarkSold={() => setMarkSoldListing(listing)}
                />
              ) : drawerTab === 'analytics' ? (
                <CarAnalyticsPanel listing={listing} dealerId={getDealerIdFromProfile(profile)} />
              ) : (
              <CarDetailsPanel
                listing={listing} images={images} imgIdx={imgIdx} setImgIdx={setImgIdx}
                onOpenLightbox={() => setLbOpen(true)} isMobile={isMobile}
                monthlyText={monthly ? `Est. RM ${monthly.toLocaleString()}/mo · 90% loan · 7yr · ${DEFAULT_EIR}% EIR` : null}
              />
              )}
            </div>

            {/* RIGHT — dark premium sidebar */}
            <div style={{ flex: isMobile ? 'none' : '0 0 210px', width: isMobile ? '100%' : undefined, padding: isMobile ? '12px 16px 24px' : 20, display: 'flex', flexDirection: 'column', gap: 0, borderTop: isMobile ? '1px solid #e5e7eb' : 'none', borderLeft: isMobile ? 'none' : '1px solid #e5e7eb', background: '#fff' }}>
              <div style={{ background: 'transparent', borderRadius: 8, padding: isMobile ? 18 : '18px 0', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr', gap: 8 }}>
                <p style={{ fontSize: 10, color: isMobile ? '#6b7280' : '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>{drawerTab === 'owner' ? 'P&L Tools' : 'Actions'}</p>

                {/* Owner-mode: the per-car tools — each opens an editor with an explicit Save */}
                {drawerTab === 'owner' && canViewCosts && (
                  <>
                    {[
                      ['Edit Costs', DollarSign, () => setOwnerTool('prices')],
                      ['Recon Jobs', Wrench, () => setOwnerTool('recon')],
                      ['Ad Spend', Megaphone, () => setOwnerTool('ad')],
                      ['Compliance', Shield, () => setOwnerTool('compliance')],
                      ['Condition', ShieldCheck, () => setOwnerTool('appraisal')],
                      ['Activity', Clock, () => setOwnerTool('activity')],
                    ].map(([label, Icon, onClick]) => (
                      <button key={label} onClick={onClick} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                        <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />{label}
                      </button>
                    ))}
                    {!isSold && (
                      <button onClick={() => setMarkSoldListing(listing)} style={{ ...btnBase, background: '#dc2626', color: '#fff' }}>
                        <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Mark as Sold
                      </button>
                    )}
                    <button onClick={() => setDrawerTab('specs')} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                      <ChevronLeft style={{ width: 14, height: 14, flexShrink: 0 }} />Public Details
                    </button>
                  </>
                )}

                {drawerTab !== 'owner' && (<>
                {/* Edit */}
                <button onClick={() => { setEditListing(listing); }} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                  <Pencil style={{ width: 14, height: 14, flexShrink: 0 }} />Edit Listing
                </button>

                {/* Price — hidden on sold listings */}
                {!isSold && (
                  <button onClick={() => setPriceEditListing(listing)} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                    <Tag style={{ width: 14, height: 14, flexShrink: 0 }} />Change Price
                  </button>
                )}

                {/* Costs & P&L — jump to the owner panel in this same detail page */}
                {canViewCosts && (
                  <button onClick={() => setDrawerTab('owner')} style={{ ...btnBase, color: drawerTab === 'owner' ? '#fff' : '#111827', background: drawerTab === 'owner' ? '#111827' : '#f5f6f8' }} onMouseEnter={e => { if (drawerTab !== 'owner') e.currentTarget.style.background=BTN_HOVER; }} onMouseLeave={e => { if (drawerTab !== 'owner') e.currentTarget.style.background='#f5f6f8'; }}>
                    <DollarSign style={{ width: 14, height: 14, flexShrink: 0 }} />Costs &amp; P&amp;L
                  </button>
                )}

                {/* Copy */}
                <button onClick={() => copyListing(listing)} style={{ ...btnBase, color: copiedListingId === listing.id ? '#047857' : '#111827' }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                  {copiedListingId === listing.id ? <Check style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Clipboard style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  {copiedListingId === listing.id ? 'Copied!' : 'Copy Writing'}
                </button>

                {/* Share — per-platform tagged links */}
                <ShareMenu
                  label="Share Listing"
                  baseUrl={dealerSubdomain ? buildStorefrontUrl(dealerSubdomain, `/cars/${listing.slug}`) : `https://drevo.my/cars/${listing.slug}`}
                  refSlug={dealerSlug || ''}
                  style={{ ...btnBase, justifyContent: 'flex-start', width: '100%' }}
                  waCaption={(link) => [
                    `${listing.year} ${listing.brand} ${listing.model}${listing.variant ? ' ' + listing.variant : ''}`,
                    `RM ${Number(listing.selling_price || 0).toLocaleString()}`,
                    '',
                    link,
                  ].join('\n')}
                />

                {/* Drevo Studio — slide/content generator for this listing */}
                {openStudio && (
                  <button onClick={() => openStudio(listing)} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                    <Film style={{ width: 14, height: 14, flexShrink: 0 }} />Drevo Studio
                  </button>
                )}

                {/* Financing Calculator — hidden on sold listings */}
                {!isSold && (
                  <button onClick={() => setCalcOpen(true)} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                    <Calculator style={{ width: 14, height: 14, flexShrink: 0 }} />Financing Calc
                  </button>
                )}

                {/* Window sticker: an A4 page for the windscreen, QR to the car page */}
                {openSticker && !isSold && (
                  <button onClick={() => openSticker(listing)} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                    <Printer style={{ width: 14, height: 14, flexShrink: 0 }} />Window Sticker
                  </button>
                )}

                {/* Assign */}
                <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <button onClick={() => setShowAssign(v => !v)} style={{ ...btnBase }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                    <UserPlus style={{ width: 14, height: 14, flexShrink: 0 }} />Assign Salesman
                  </button>
                  {showAssign && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 4, background: '#FFFFFF', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 60, overflow: 'hidden', padding: '4px 0' }}>
                      {listing.assigned_to && (
                        <button onClick={() => { handleUnassign(listing.id); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                          <X style={{ width: 12, height: 12 }} />Unassign
                        </button>
                      )}
                      {salesmen.map(s => (
                        <button key={s.id} onClick={() => { handleAssign(listing.id, s.id, s.full_name); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: listing.assigned_to === s.id ? '#F5F6F8' : 'none', border: 'none', color: listing.assigned_to === s.id ? '#DC2626' : '#374151', fontSize: 12, cursor: 'pointer' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(s.full_name || 'S')[0].toUpperCase()}</div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name || 'Unknown'}</span>
                          {listing.assigned_to === s.id && <Check style={{ width: 11, height: 11, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mark Sold */}
                {!isSold && (
                  <button onClick={() => setMarkSoldListing(listing)} style={{ ...btnBase, background: '#dc2626', color: '#fff' }}>
                    <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Mark as Sold
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => { setDeleteId(listing.id); }} style={{ ...btnBase, color: '#b91c1c' }} onMouseEnter={e => e.currentTarget.style.background=BTN_HOVER} onMouseLeave={e => e.currentTarget.style.background='#f5f6f8'}>
                  <Trash2 style={{ width: 14, height: 14, flexShrink: 0 }} />Delete Listing
                </button>
                </>)}

                {/* Metadata */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, marginTop: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>Listed {age === 0 ? 'today' : `${age} day${age !== 1 ? 's' : ''} ago`}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sCfg.dot, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#374151', textTransform: 'capitalize' }}>{listing.status || 'available'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lbOpen && (
        <div
          onClick={() => setLbOpen(false)}
          className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Close */}
          <button
            onClick={() => setLbOpen(false)}
            style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
          {/* Counter */}
          {images.length > 1 && (
            <span style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: '#9ca3af', background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '4px 12px' }}>
              {imgIdx + 1} / {images.length}
            </span>
          )}
          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft style={{ width: 22, height: 22 }} />
            </button>
          )}
          {/* Image */}
          <img
            src={images[imgIdx]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 'calc(100vw - 120px)', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4, display: 'block' }}
          />
          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight style={{ width: 22, height: 22 }} />
            </button>
          )}
        </div>
      )}

      {/* Financing Calculator modal */}
      {calcOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
          className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "system-ui,sans-serif" }}
        >
          <div style={{ width: '100%', maxWidth: 860, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ color: '#111827', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>Financing &amp; Cost Calculator</p>
                <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{listing.brand} {listing.model}{listing.variant ? ` ${listing.variant}` : ''}</p>
              </div>
              <button onClick={() => setCalcOpen(false)} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              <FinancingCalculator
                initialPrice={listing.selling_price || listing.price}
                engineCc={listing.engine_cc}
                bodyType={listing.body_type}
                carName={`${listing.brand} ${listing.model}${listing.variant ? ` ${listing.variant}` : ''}`}
                carYear={listing.year ? String(listing.year) : ''}
                carColor={listing.colour || ''}
                carImage={listing.images?.length ? listing.images[0] : null}
                light
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
