import { useReducer, useCallback } from 'react';
import { nanoid } from 'nanoid';

const MAX_HISTORY = 50;

// ── Layer factory ─────────────────────────────────────────────────────────────
export function makeLayer(type, overrides = {}) {
  const base = {
    id: nanoid(8),
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    x: 30, y: 37, width: 40, height: 25, rotation: 0,
    fill: '#e63946', fillOpacity: 100,
    borderColor: '#ffffff', borderWidth: 0, borderOpacity: 100,
    borderStyle: 'solid', borderRadius: 0,
    src: null, objectFit: 'cover',
    text: '', fontSize: 24, fontWeight: 'bold', textColor: '#ffffff', textAlign: 'center',
    zIndex: 0,
    locked: false, visible: true, opacity: 100,
    blendMode: 'normal',
  };
  if (type === 'circle')   return { ...base, fill: '#3b82f6', width: 25, height: 25, borderRadius: 50, ...overrides };
  if (type === 'triangle') return { ...base, fill: '#f59e0b', width: 30, height: 25, ...overrides };
  if (type === 'image')    return { ...base, fill: 'transparent', fillOpacity: 0, borderWidth: 0, ...overrides };
  return { ...base, ...overrides };
}

// ── History helpers ────────────────────────────────────────────────────────────
function snap(layers) { return JSON.parse(JSON.stringify(layers)); }

function pushHist(history, idx, layers) {
  const trimmed = history.slice(0, idx + 1);
  const next = [...trimmed, snap(layers)];
  return next.length > MAX_HISTORY ? next.slice(1) : next;
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function init(layers) {
  const ls = snap(layers);
  return { layers: ls, selectedIds: [], history: [ls], historyIdx: 0 };
}

function reducer(state, action) {
  switch (action.type) {

    case 'SET_LAYERS': {
      return init(action.layers);
    }

    case 'ADD': {
      const layer = { ...action.layer, zIndex: state.layers.length };
      const layers = [...state.layers, layer];
      return { ...state, layers, selectedIds: [layer.id],
        history: pushHist(state.history, state.historyIdx, layers), historyIdx: Math.min(state.historyIdx + 1, MAX_HISTORY - 1) };
    }

    case 'UPDATE': {
      const layers = state.layers.map(l => l.id === action.id ? { ...l, ...action.patch } : l);
      if (action.silent) return { ...state, layers };
      return { ...state, layers,
        history: pushHist(state.history, state.historyIdx, layers), historyIdx: Math.min(state.historyIdx + 1, MAX_HISTORY - 1) };
    }

    case 'COMMIT': {
      // Called after silent updates (drag/resize end) to push to history
      const history = pushHist(state.history, state.historyIdx, state.layers);
      return { ...state, history, historyIdx: history.length - 1 };
    }

    case 'DELETE': {
      const ids = new Set(action.ids);
      const layers = state.layers.filter(l => !ids.has(l.id)).map((l, i) => ({ ...l, zIndex: i }));
      const history = pushHist(state.history, state.historyIdx, layers);
      return { ...state, layers, selectedIds: [], history, historyIdx: history.length - 1 };
    }

    case 'DUPLICATE': {
      const src = state.layers.find(l => l.id === action.id);
      if (!src) return state;
      const dup = { ...snap(src), id: nanoid(8), x: src.x + 3, y: src.y + 3,
        label: src.label + ' copy', zIndex: state.layers.length };
      const layers = [...state.layers, dup];
      const history = pushHist(state.history, state.historyIdx, layers);
      return { ...state, layers, selectedIds: [dup.id], history, historyIdx: history.length - 1 };
    }

    case 'REORDER': {
      const layers = action.layers.map((l, i) => ({ ...l, zIndex: i }));
      const history = pushHist(state.history, state.historyIdx, layers);
      return { ...state, layers, history, historyIdx: history.length - 1 };
    }

    case 'SHIFT_Z': {
      const idx = state.layers.findIndex(l => l.id === action.id);
      if (idx < 0) return state;
      const arr = snap(state.layers);
      const target = action.dir === 'up' ? idx + 1 : idx - 1;
      if (target < 0 || target >= arr.length) return state;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      arr.forEach((l, i) => { l.zIndex = i; });
      const history = pushHist(state.history, state.historyIdx, arr);
      return { ...state, layers: arr, history, historyIdx: history.length - 1 };
    }

    case 'SELECT':
      return { ...state, selectedIds: action.ids };

    case 'UNDO': {
      if (state.historyIdx <= 0) return state;
      const idx = state.historyIdx - 1;
      return { ...state, layers: snap(state.history[idx]), historyIdx: idx, selectedIds: [] };
    }

    case 'REDO': {
      if (state.historyIdx >= state.history.length - 1) return state;
      const idx = state.historyIdx + 1;
      return { ...state, layers: snap(state.history[idx]), historyIdx: idx, selectedIds: [] };
    }

    default: return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLayerEditor(initialLayers = []) {
  const [state, dispatch] = useReducer(reducer, initialLayers, init);

  const setLayers      = useCallback(ls  => dispatch({ type: 'SET_LAYERS', layers: ls }), []);
  const addLayer       = useCallback((type, overrides) => {
    const layer = makeLayer(type, overrides);
    dispatch({ type: 'ADD', layer });
    return layer;
  }, []);
  const updateLayer    = useCallback((id, patch, silent = false) => dispatch({ type: 'UPDATE', id, patch, silent }), []);
  const commitHistory  = useCallback(() => dispatch({ type: 'COMMIT' }), []);
  const deleteLayer    = useCallback(id  => dispatch({ type: 'DELETE', ids: [id] }), []);
  const deleteLayers   = useCallback(ids => dispatch({ type: 'DELETE', ids }), []);
  const duplicateLayer = useCallback(id  => dispatch({ type: 'DUPLICATE', id }), []);
  const reorderLayers  = useCallback(ls  => dispatch({ type: 'REORDER', layers: ls }), []);
  const shiftZ         = useCallback((id, dir) => dispatch({ type: 'SHIFT_Z', id, dir }), []);
  const selectLayer    = useCallback((id, multi = false) => {
    dispatch({ type: 'SELECT', ids: multi
      ? (state.selectedIds.includes(id) ? state.selectedIds.filter(x => x !== id) : [...state.selectedIds, id])
      : [id] });
  }, [state.selectedIds]);
  const clearSelection = useCallback(() => dispatch({ type: 'SELECT', ids: [] }), []);
  const undo           = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo           = useCallback(() => dispatch({ type: 'REDO' }), []);

  return {
    layers: state.layers,
    selectedIds: state.selectedIds,
    setLayers, addLayer, updateLayer, commitHistory,
    deleteLayer, deleteLayers, duplicateLayer,
    reorderLayers, shiftZ,
    selectLayer, clearSelection,
    undo, redo,
    canUndo: state.historyIdx > 0,
    canRedo: state.historyIdx < state.history.length - 1,
  };
}
