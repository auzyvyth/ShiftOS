import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { supabase } from '../../supabaseClient';
import HeroSlideCard from '../../components/xdrive/HeroSlideCard';
import HeroSlideForm from '../../components/xdrive/HeroSlideForm';

const MAX_SLIDES = 5;

// ─── Inline styles shared across the page ────────────────────────────────────

const card = {
  position: 'relative',
  background: 'linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))',
  border: '1px solid rgba(255,255,255,0.07)',
};

const btnRed = {
  background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
  boxShadow: '0 2px 10px rgba(220,38,38,0.28)',
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function HeroSlidesPage({ userId, profile }) {
  const [slides,    setSlides]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editSlide, setEditSlide] = useState(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSlides = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('hero_carousel_slides')
      .select('*')
      .eq('dealer_id', userId)
      .order('sort_order', { ascending: true });
    setSlides(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchSlides(); }, [fetchSlides]);

  // ── Drag & drop ──────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex(s => s.id === active.id);
    const newIdx = slides.findIndex(s => s.id === over.id);
    const reordered = arrayMove(slides, oldIdx, newIdx);
    setSlides(reordered); // optimistic
    await Promise.all(
      reordered.map((slide, index) =>
        supabase
          .from('hero_carousel_slides')
          .update({ sort_order: index })
          .eq('dealer_id', userId)
          .eq('id', slide.id)
      )
    );
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleToggle = async (id, isActive) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, active: isActive } : s));
    await supabase
      .from('hero_carousel_slides')
      .update({ active: isActive })
      .eq('dealer_id', userId)
      .eq('id', id);
  };

  const handleDelete = async (id) => {
    setSlides(prev => prev.filter(s => s.id !== id));
    await supabase
      .from('hero_carousel_slides')
      .delete()
      .eq('dealer_id', userId)
      .eq('id', id);
  };

  const handleSave = (saved) => {
    setSlides(prev => {
      const exists = prev.find(s => s.id === saved.id);
      if (exists) return prev.map(s => s.id === saved.id ? saved : s);
      return [...prev, saved];
    });
    setShowForm(false);
    setEditSlide(null);
  };

  const openAdd  = () => { setEditSlide(null); setShowForm(true); };
  const openEdit = (slide) => { setEditSlide(slide); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditSlide(null); };

  const atMax = slides.length >= MAX_SLIDES;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 16, marginBottom: 28,
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Hero Carousel
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4, maxWidth: 360 }}>
            Manage your XDrive homepage spotlight — up to {MAX_SLIDES} slides
          </p>
        </div>

        <div>
          <button
            onClick={atMax ? undefined : openAdd}
            disabled={atMax}
            title={atMax ? 'Maximum 5 slides reached' : undefined}
            style={{
              ...(atMax ? {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#4b5563',
                cursor: 'not-allowed',
                boxShadow: 'none',
              } : {
                ...btnRed,
                border: 'none',
                color: 'white',
                cursor: 'pointer',
              }),
              borderRadius: 11, padding: '9px 18px', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'all 0.2s', fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Slide
          </button>
          {atMax && (
            <p style={{ color: '#4b5563', fontSize: 11, marginTop: 5, textAlign: 'right' }}>
              Maximum 5 slides reached
            </p>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
          <div
            className="animate-spin"
            style={{
              width: 26, height: 26,
              border: '2px solid rgba(255,255,255,0.07)',
              borderTopColor: '#dc2626',
              borderRadius: '50%',
            }}
          />
        </div>

      ) : slides.length === 0 ? (
        /* ── Empty state ── */
        <div
          style={{
            ...card,
            borderRadius: 16, padding: '56px 24px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 18, textAlign: 'center',
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18"/>
              <path d="M9 21V9"/>
            </svg>
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No slides yet</p>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Add your first featured car</p>
          </div>
          <button
            onClick={openAdd}
            style={{
              ...btnRed, border: 'none', borderRadius: 11, color: 'white',
              padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Slide
          </button>
        </div>

      ) : (
        /* ── Slide list with DnD ── */
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={slides.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {slides.map(slide => (
                  <HeroSlideCard
                    key={slide.id}
                    slide={slide}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Slide counter */}
          <p style={{
            color: '#374151', fontSize: 12, marginTop: 14,
            textAlign: 'right',
          }}>
            {slides.length} / {MAX_SLIDES} slides
          </p>
        </>
      )}

      {/* ── Form modal ── */}
      {showForm && (
        <HeroSlideForm
          slide={editSlide}
          userId={userId}
          profile={profile}
          slideCount={slides.length}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
