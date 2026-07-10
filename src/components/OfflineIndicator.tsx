// Indicateur online/offline + badge queue pending.
// Affiche rien quand tout va bien, sinon petit badge en haut.

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getQueueSize, installAutoDrain, drain } from '../lib/offlineQueue';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueSize, setQueueSize] = useState(0);
  const [draining, setDraining] = useState(false);
  const [lastDrainInfo, setLastDrainInfo] = useState<string | null>(null);

  useEffect(() => {
    installAutoDrain((r) => {
      setLastDrainInfo(
        r.replayed > 0
          ? `${r.replayed} action${r.replayed > 1 ? 's' : ''} synchronisée${r.replayed > 1 ? 's' : ''}`
          : null
      );
      setTimeout(() => setLastDrainInfo(null), 4000);
    });

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const refreshSize = () => setQueueSize(getQueueSize());
    window.addEventListener('offline-queue-changed', refreshSize);
    refreshSize();
    const t = setInterval(refreshSize, 4000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('offline-queue-changed', refreshSize);
      clearInterval(t);
    };
  }, []);

  const manualDrain = async () => {
    setDraining(true);
    try {
      const r = await drain();
      setLastDrainInfo(
        r.replayed > 0
          ? `${r.replayed} action${r.replayed > 1 ? 's' : ''} synchronisée${r.replayed > 1 ? 's' : ''}`
          : 'Rien à synchroniser'
      );
      setTimeout(() => setLastDrainInfo(null), 4000);
    } finally {
      setDraining(false);
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
