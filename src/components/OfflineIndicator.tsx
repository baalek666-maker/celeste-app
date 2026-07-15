// Indicateur online/offline + badge queue pending.
// Affiche rien quand tout va bien, sinon petit badge en haut.

import { useEffect, useState, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getQueueSize, installAutoDrain, drain } from '../lib/offlineQueue';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueSize, setQueueSize] = useState(0);
  const [draining, setDraining] = useState(false);
  const [lastDrainInfo, setLastDrainInfo] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      timersRef.current.forEach(id => window.clearTimeout(id));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const safeSetLastDrainInfo = (msg: string | null) => {
      if (!aliveRef.current) return;
      setLastDrainInfo(msg);
    };
    const safeSetQueueSize = (n: number) => {
      if (!aliveRef.current) return;
      setQueueSize(n);
    };
    const safeSetOnline = (v: boolean) => {
      if (!aliveRef.current) return;
      setOnline(v);
    };

    installAutoDrain((r) => {
      safeSetLastDrainInfo(
        r.replayed > 0
          ? `${r.replayed} action${r.replayed > 1 ? 's' : ''} synchronisée${r.replayed > 1 ? 's' : ''}`
          : null
      );
      const t = window.setTimeout(() => safeSetLastDrainInfo(null), 4000);
      timersRef.current.add(t);
    });

    const goOnline = () => safeSetOnline(true);
    const goOffline = () => safeSetOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const refreshSize = () => safeSetQueueSize(getQueueSize());
    window.addEventListener('offline-queue-changed', refreshSize);
    refreshSize();
    const t = window.setInterval(refreshSize, 4000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('offline-queue-changed', refreshSize);
      window.clearInterval(t);
    };
  }, []);

  const manualDrain = async () => {
    let alive = true;
    setDraining(true);
    try {
      const r = await drain();
      if (!alive) return;
      setLastDrainInfo(
        r.replayed > 0
          ? `${r.replayed} action${r.replayed > 1 ? 's' : ''} synchronisée${r.replayed > 1 ? 's' : ''}`
          : 'Rien à synchroniser'
      );
      const t = window.setTimeout(() => {
        if (alive) setLastDrainInfo(null);
      }, 4000);
      timersRef.current.add(t);
    } finally {
      if (alive) setDraining(false);
    }
  };

  if (online && queueSize === 0 && !lastDrainInfo) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs shadow-lg backdrop-blur-md transition-all ${
          !online
            ? 'bg-amber-500/90 text-black'
            : lastDrainInfo
            ? 'bg-emerald-500/90 text-white'
            : 'bg-indigo-500/90 text-white'
        }`}
      >
        {!online && (
          <>
            <WifiOff className="w-3 h-3" />
            <span className="font-medium">Mode hors ligne</span>
          </>
        )}
        {online && queueSize > 0 && (
          <>
            <RefreshCw className={`w-3 h-3 ${draining ? 'animate-spin' : ''}`} />
            <span className="font-medium">
              {queueSize} action{queueSize > 1 ? 's' : ''} en attente
            </span>
            <button
              onClick={manualDrain}
              className="ml-1 underline opacity-80 hover:opacity-100"
              disabled={draining}
            >
              sync
            </button>
          </>
        )}
        {online && queueSize === 0 && lastDrainInfo && (
          <>
            <CheckCircle2 className="w-3 h-3" />
            <span className="font-medium">{lastDrainInfo}</span>
          </>
        )}
      </div>
    </div>
  );
}
