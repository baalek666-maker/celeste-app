import { useEffect, useState } from 'react';
import { api, type LunarIntention } from '../lib/api';

type LunarStatus = {
  moonPhase: { name: string; emoji: string; description: string; age: number };
  cycleDate: string;
  intentions: LunarIntention[];
  isNewMoonWindow: boolean;
  isFullMoonWindow: boolean;
  isWaning: boolean;
  canSetIntention: boolean;
  canReview: boolean;
};

export default function LunarCycle() {
  const [status, setStatus] = useState<LunarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getLunarStatus()
      .then(s => { if (alive) setStatus(s); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const submitIntention = async () => {
    if (!intentionDraft.trim()) return;
    setBusy(true);
    try {
      const newIntention = await api.setLunarIntention(intentionDraft.trim());
      setStatus(s => s ? { ...s, intentions: [newIntention, ...s.intentions] } : s);
      setIntentionDraft('');
      setShowInput(false);
    } catch { /* silent */ }
    finally { setBusy(false); }
  };

  const reviewIntention = async (id: number, reviewStatus: 'manifested' | 'released') => {
    setBusy(true);
    try {
      const updated = await api.reviewLunarIntention(id, reviewStatus);
      setStatus(s => s ? {
        ...s,
        intentions: s.intentions.map(i => i.id === id ? updated : i),
      } : s);
    } catch { /* silent */ }
    finally { setBusy(false); }
  };

  const deleteIntention = async (id: number) => {
    try {
      await api.deleteLunarIntention(id);
      setStatus(s => s ? { ...s, intentions: s.intentions.filter(i => i.id !== id) } : s);
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="glass rounded-3xl p-5 mb-5 animate-pulse">
        <div className="h-4 bg-night-700/30 rounded w-1/3 mb-3" />
        <div className="h-12 bg-night-700/20 rounded" />
      </div>
    );
  }

  if (!status) return null;

  const m = status.moonPhase;
  const activeIntentions = status.intentions.filter(i => i.status === 'active');

  return (
    <div className="glass rounded-3xl p-5 mb-5 stagger-card card-glow animate-fade-in" style={{ animationDelay: '0.15s' }}>
      {/* Moon header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl animate-float-slow">{m.emoji}</span>
        <div className="flex-1">
          <p className="text-gold-400 text-xs uppercase tracking-widest font-medium">Cycle lunaire</p>
          <p className="text-night-100 text-sm font-semibold">{m.name}</p>
        </div>
        <p className="text-night-500 text-[10px]">J{m.age}</p>
      </div>

      {/* New Moon: Set intentions */}
      {status.canSetIntention && (
        <div className="glass rounded-xl p-3 mb-3 border border-gold-500/20">
          <p className="text-gold-300 text-xs font-medium mb-1">🌑 Fenêtre d'intention</p>
          <p className="text-night-300 text-[11px] mb-3 leading-relaxed">
            {status.isNewMoonWindow
              ? "C'est la période idéale pour poser une intention. Que veux-tu voir grandrir ce cycle ?"
              : "Tu peux toujours clarifier tes intentions. Que veux-tu manifester ?"}
          </p>

          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              disabled={activeIntentions.length >= 3}
              className="w-full glass-gold rounded-lg py-2 text-xs font-medium text-gold-300 hover:scale-[1.01] disabled:opacity-40 transition"
            >
              {activeIntentions.length >= 3 ? 'Maximum 3 intentions' : '✨ Poser une intention'}
            </button>
          ) : (
            <div className="animate-fade-in">
              <textarea
                value={intentionDraft}
                onChange={e => setIntentionDraft(e.target.value)}
                placeholder="Je veux..."
                maxLength={500}
                rows={2}
                className="w-full bg-night-900/50 text-night-100 text-sm rounded-lg p-2.5 border border-night-700/50 focus:border-gold-500/40 focus:outline-none resize-none placeholder:text-night-600"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setShowInput(false); setIntentionDraft(''); }} className="text-night-400 text-xs px-2 py-1 rounded hover:text-night-200">
                  Annuler
                </button>
                <button
                  onClick={submitIntention}
                  disabled={!intentionDraft.trim() || busy}
                  className="bg-gold-500/20 text-gold-300 text-xs px-3 py-1 rounded hover:bg-gold-500/30 disabled:opacity-40"
                >
                  {busy ? '…' : 'Sauver ✓'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active intentions list */}
      {activeIntentions.length > 0 && (
        <div className="space-y-2 mb-3">
          {activeIntentions.map(intent => (
            <div key={intent.id} className="glass rounded-xl p-3 border border-night-700/40 group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-night-100 text-sm flex-1">{intent.intentionText}</p>
                <button
                  onClick={() => deleteIntention(intent.id)}
                  className="text-night-600 text-xs opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                >
                  ✕
                </button>
              </div>

              {/* Review buttons during full moon */}
              {status.canReview && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => reviewIntention(intent.id, 'manifested')}
                    disabled={busy}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 transition"
                  >
                    ✓ S'est réalisé
                  </button>
                  <button
                    onClick={() => reviewIntention(intent.id, 'released')}
                    disabled={busy}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 disabled:opacity-40 transition"
                  >
                    🌙 Je lâche prise
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reviewed intentions */}
      {status.intentions.filter(i => i.status !== 'active').length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-night-500 text-[10px] uppercase tracking-wider">Cycle précédent</p>
          {status.intentions.filter(i => i.status !== 'active').map(intent => (
            <div key={intent.id} className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
              <span className="text-xs">{intent.status === 'manifested' ? '✨' : '🌙'}</span>
              <p className="text-night-400 text-xs flex-1 line-clamp-1">{intent.intentionText}</p>
              <span className={`text-[10px] ${intent.status === 'manifested' ? 'text-emerald-400' : 'text-orange-400'}`}>
                {intent.status === 'manifested' ? 'Manifesté' : 'Lâché'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Full moon message */}
      {status.isFullMoonWindow && activeIntentions.length === 0 && (
        <div className="glass rounded-xl p-3 border border-purple-500/20">
          <p className="text-purple-300 text-xs font-medium mb-1">🌕 Pleine Lune</p>
          <p className="text-night-300 text-[11px]">
            Moment d'illumination. Ce qui était semé au dernier croissant porte ses fruits. Observe ce qui est devenu clair.
          </p>
        </div>
      )}

      <p className="text-night-500 text-[10px] text-center">{m.description}</p>
    </div>
  );
}
