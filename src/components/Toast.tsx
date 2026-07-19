/**
 * Toast — minimal toast/notification system.
 *
 * Usage:
 *   import { useToast } from '../hooks/useToast';
 *   const toast = useToast();
 *   toast.success('Prédiction sauvegardée');
 *   toast.error('Erreur réseau');
 *   toast.info('Lecture en cours...');
 *
 * Or programmatically from anywhere with no hook:
 *   import { toast } from '../components/Toast';
 *   toast.success('OK');
 *
 * Implementation: portal at #toast-root (added in index.html). Auto-dismiss
 * after 3s, slide-in from top with gold accent matching Celeste theme.
 * Stacking up to 3 toasts — older ones dismiss early when full.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  exiting?: boolean;
}

let _nextId = 1;
const _listeners: Array<(items: ToastItem[]) => void> = [];
let _items: ToastItem[] = [];

function emit() {
  for (const l of _listeners) l(_items);
}

function push(kind: ToastKind, message: string) {
  // P1 #24 — Dedup: si un toast identique (kind+message) est déjà visible,
  // on ne l'ajoute pas. Évite les doublons quand plusieurs catch convergent
  // (ex: API erreur réseau → plusieurs toast.error('Erreur réseau')).
  if (_items.some(t => t.kind === kind && t.message === message && !t.exiting)) {
    return;
  }
  const id = _nextId++;
  const item: ToastItem = { id, kind, message };
  _items = [..._items, item].slice(-3); // keep last 3
  emit();

  // Schedule dismiss
  setTimeout(() => {
    _items = _items.map(t => (t.id === id ? { ...t, exiting: true } : t));
    emit();
    setTimeout(() => {
      _items = _items.filter(t => t.id !== id);
      emit();
    }, 250); // exit anim
  }, 3000);
}

// Singleton-style API for ad-hoc use
export const toast = {
  success: (m: string) => push('success', m),
  error:   (m: string) => push('error', m),
  info:    (m: string) => push('info', m),
};

function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(_items);
  useEffect(() => {
    _listeners.push(setItems);
    return () => {
      const idx = _listeners.indexOf(setItems);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }, []);
  if (typeof document === 'undefined') return null;

  const host = document.getElementById('toast-root');
  if (!host) return null;

  const styles: Record<ToastKind, { ring: string; icon: string; bg: string }> = {
    success: { ring: 'border-gold-500/40', icon: '✨', bg: 'bg-night-900/95' },
    error:   { ring: 'border-red-500/40',   icon: '⚠',  bg: 'bg-night-900/95' },
    info:    { ring: 'border-cosmic-500/40', icon: 'ℹ',  bg: 'bg-night-900/95' },
  };

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {items.map(t => {
        const s = styles[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto glass ${s.bg} ${s.ring} border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-black/40 min-w-[260px] max-w-[90vw] ${t.exiting ? 'animate-fade-out-up' : 'animate-slide-down'}`}
          >
            <span className="text-xl" aria-hidden="true">{s.icon}</span>
            <span className="text-night-100 text-sm flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>,
    host
  );
}

export default ToastHost;

// React hook version for components that want imperative calls
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

export function useToast(): ToastApi {
  const ref = useRef<ToastApi | null>(null);
  if (ref.current === null) {
    ref.current = {
      success: push.bind(null, 'success'),
      error: push.bind(null, 'error'),
      info: push.bind(null, 'info'),
    };
  }
  return ref.current;
}