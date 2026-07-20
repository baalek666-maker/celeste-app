import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

type GamificationStatus = Awaited<ReturnType<typeof api.getGamificationStatus>>;
type Challenge = Awaited<ReturnType<typeof api.getWeeklyChallenge>>;
type Badge = GamificationStatus['badges'][number];
type Quest = GamificationStatus['quests'][number];

const SWEEP = `@keyframes prog-sweep { 0%{transform:translateX(-130%) skewX(-16deg)} 55%,100%{transform:translateX(260%) skewX(-16deg)} }`;
const XP_TOAST = `@keyframes prog-xp { 0%{opacity:0;transform:translateY(0) scale(.9)} 18%{opacity:1;transform:translateY(-7px) scale(1.06)} 100%{opacity:0;transform:translateY(-30px) scale(1)} }`;
const LEVEL_FLASH = `@keyframes prog-lvl { 0%{opacity:0;transform:scale(.92)} 18%{opacity:1;transform:scale(1.04)} 78%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(.98)} }`;

/**
 * ProgressionHub — the single home for gamification.
 * Merges XP, daily quests, weekly challenge, and badges into one scrollable view.
 */
export default function ProgressionHub() {
  const [gami, setGami] = useState<GamificationStatus | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; xp: number }[]>([]);
  const [levelUp, setLevelUp] = useState<{ active: boolean; level: number | null }>({ active: false, level: null });
  const prevLevel = useRef<number | null>(null);

  const [note, setNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [badgeActive, setBadgeActive] = useState<string | null>(null);

  const load = () => {
    let alive = true;
    setLoading(true);
    Promise.all([api.getGamificationStatus(), api.getWeeklyChallenge()])
      .then(([g, c]) => {
        if (!alive) return;
        setGami(g);
        setChallenge(c);
        setNote(c.reflectionNote || '');
        prevLevel.current = g.level;
      })
      .catch(e => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  };

  useEffect(() => load(), []);

  const completeQuest = async (q: Quest) => {
    if (q.completed || busyKey) return;
    setBusyKey(q.quest_key);
    try {
      const res = await api.completeQuest(q.quest_key);
      setGami(prev => {
        if (!prev) return prev;
        const updated = { ...prev, xp: prev.xp + res.xpAwarded, level: res.newLevel };
        updated.quests = prev.quests.map(qq => qq.quest_key === q.quest_key ? { ...qq, completed: true } : qq);
        return updated;
      });
      const tid = Date.now();
      setToasts(t => [...t, { id: tid, xp: res.xpAwarded }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== tid)), 1400);
      if (res.leveledUp) {
        setLevelUp({ active: true, level: res.newLevel });
        setTimeout(() => setLevelUp({ active: false, level: null }), 2200);
      }
    } catch { /* silent */ } finally { setBusyKey(null); }
  };

  const submitChallenge = async () => {
    if (!note.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await api.completeWeeklyChallenge(note.trim());
      setChallenge(c => c ? { ...c, completed: true, reflectionNote: note.trim() } : c);
    } catch { /* silent */ } finally { setSubmittingNote(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
    </div>
  );
  if (err || !gami) return (
    <div className="celeste-card p-6 text-center">
      <p className="text-night-300 text-sm">⚠️ Impossible de charger ta progression.</p>
      <button onClick={load} className="mt-3 text-gold-400 text-sm">Réessayer</button>
    </div>
  );

  const questsDone = gami.quests.filter(q => q.completed).length;

  return (
    <div className="relative">
      <style>{SWEEP}{XP_TOAST}{LEVEL_FLASH}</style>

      {/* ── XP Header ─────────────────────────── */}
      <div className="glass-gold rounded-3xl p-5 mb-4 overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gold-300 font-bold text-lg">Niveau {gami.level}</p>
              <p className="text-gold-200/70 text-xs">{gami.levelTitle}</p>
            </div>
            <div className="text-right">
              <p className="text-gold-300 font-bold text-xl">{gami.xp}</p>
              <p className="text-gold-200/60 text-[10px] uppercase tracking-wide">XP total</p>
            </div>
          </div>
          <div className="relative h-2.5 bg-night-800/60 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-500 to-gold-300 rounded-full transition-all duration-700"
              style={{ width: `${gami.progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-night-400 text-[10px]">{gami.xpIntoLevel} XP</span>
            <span className="text-night-400 text-[10px]">{gami.xpForNext} XP →</span>
          </div>
        </div>
      </div>

      {/* ── Le Rituel du Matin (v13) ─────────────────── */}
      <div className="glass-gold rounded-3xl p-5 mb-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          background: 'radial-gradient(circle at 20% 0%, #f5d488 0%, transparent 60%)'
        }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-gold-200 font-bold text-sm flex items-center gap-2">
              <span>✦</span> Le Rituel du Matin
            </h3>
            <span className="text-gold-300/70 text-xs font-mono">{questsDone}/{gami.questsTotal}</span>
          </div>
          <p className="text-night-400 text-xs italic mb-4 leading-relaxed">
            Quatre gestes. Trois minutes. Pour commencer la journée de l'autre côté du miroir.
          </p>
          {gami.quests.length === 0 ? (
            <p className="text-night-400 text-xs py-2">Reviens demain pour un nouveau rituel.</p>
          ) : (
            <div className="space-y-2">
              {gami.quests.map((q, i) => (
                <button
                  key={q.quest_key}
                  disabled={q.completed || busyKey === q.quest_key}
                  onClick={() => completeQuest(q)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all relative overflow-hidden ${
                    q.completed
                      ? 'bg-night-900/60 opacity-60'
                      : 'bg-night-800/30 hover:bg-night-800/60 border border-gold-500/15 hover:border-gold-500/40'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                    q.completed
                      ? 'bg-gold-500/30 text-gold-200'
                      : 'border border-gold-500/30 text-gold-400/70'
                  }`}>
                    {q.completed ? '✓' : ['✦','☾','✎','☉'][i % 4]}
                  </span>
                  <span className={`flex-1 text-xs leading-snug ${q.completed ? 'text-night-400 line-through' : 'text-night-100'}`}>
                    {q.quest_label}
                  </span>
                  <span className={`text-[10px] font-mono flex-shrink-0 ${q.completed ? 'text-night-500' : 'text-gold-400/60'}`}>+{q.xp_reward}</span>
                </button>
              ))}
            </div>
          )}
          {questsDone === gami.questsTotal && gami.questsTotal > 0 && (
            <div className="mt-4 pt-3 border-t border-gold-500/20 text-center">
              <p className="text-gold-300 text-xs italic">
                Rituel accompli. Le ciel te reconnaît.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly Challenge ──────────────────── */}
      {challenge && (
        <div className={`glass rounded-3xl p-5 mb-4 ${challenge.completed ? 'border border-gold-500/20' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-night-100 font-bold text-sm">🎯 Défi de la semaine</h3>
            {challenge.completed && <span className="text-gold-400 text-xs">✓ Fait</span>}
          </div>
          <p className="text-gold-300/80 text-xs uppercase tracking-wide mb-2">{challenge.theme}</p>
          <p className="text-night-200 text-sm leading-relaxed mb-2">{challenge.action}</p>
          {challenge.explanation && (
            <p className="text-night-400 text-xs italic leading-relaxed mb-3">{challenge.explanation}</p>
          )}
          {challenge.completed && challenge.reflectionNote ? (
            <div className="glass-gold rounded-xl p-3 mt-2">
              <p className="text-gold-200/60 text-[10px] uppercase tracking-wide mb-1">Ta réflexion</p>
              <p className="text-night-100 text-sm">"{challenge.reflectionNote}"</p>
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ta réflexion après avoir relevé le défi..."
                className="w-full bg-night-800/40 border border-night-600/40 rounded-xl p-3 text-night-100 text-xs placeholder:text-night-500 focus:border-gold-500/40 focus:outline-none resize-none"
                rows={2}
              />
              <button
                disabled={!note.trim() || submittingNote}
                onClick={submitChallenge}
                className="mt-2 px-4 py-2 glass-gold rounded-xl text-gold-200 text-xs font-semibold disabled:opacity-40 transition-all"
              >
                {submittingNote ? '...' : 'Marquer comme fait ✓'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Badges ────────────────────────────── */}
      <div className="glass rounded-2xl p-5 mb-4 border border-night-700/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-night-100 font-medium text-sm">🏆 Badges</h3>
          <span className="text-night-400 text-xs">{gami.badgesEarned}/{gami.badgesTotal}</span>
        </div>

        {/* Progression globale */}
        <div className="h-1 rounded-full bg-night-800/60 overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all duration-700"
            style={{ width: `${gami.badgesTotal ? (gami.badgesEarned / gami.badgesTotal) * 100 : 0}%` }}
          />
        </div>

        {/* Prochain objectif — le premier badge non débloqué */}
        {(() => {
          const next = gami.badges.find(b => !b.earned);
          if (!next) return null;
          return (
            <div className="mb-4 p-3 rounded-xl bg-night-800/30 border border-night-700/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base opacity-50">{next.emoji}</span>
                <span className="text-xs text-night-200 font-medium">{next.title}</span>
              </div>
              <p className="text-[11px] text-night-400 leading-relaxed">
                {(next as any).action || next.desc}
              </p>
              {(next as any).reward && (
                <p className="text-[11px] text-gold-400/80 mt-1">🎁 {(next as any).reward}</p>
              )}
            </div>
          );
        })()}

        {/* Grille des badges */}
        <div className="grid grid-cols-4 gap-2.5">
          {gami.badges.map(b => (
            <button
              key={b.id}
              onClick={() => setBadgeActive(badgeActive === b.id ? null : b.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                b.earned ? 'hover:scale-105 cursor-pointer' : 'opacity-50 hover:opacity-70 cursor-pointer'
              }`}
            >
              <span className={`text-2xl ${b.earned ? '' : 'grayscale opacity-60'}`}>
                {b.emoji}
              </span>
              <span className={`text-[9px] text-center leading-tight ${b.earned ? 'text-gold-300/80' : 'text-night-500'}`}>
                {b.title}
              </span>
            </button>
          ))}
        </div>

        {/* Détail au clic — reward + action visibles */}
        {badgeActive && (() => {
          const b = gami.badges.find(x => x.id === badgeActive);
          if (!b) return null;
          const bd = b as any;
          return (
            <div className="mt-3 glass rounded-xl p-3 border border-night-700/30 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{b.emoji}</span>
                <p className="text-night-100 font-medium text-xs">{b.title}</p>
                {b.earned ? (
                  <span className="ml-auto text-[10px] text-gold-400/70">✓ Débloqué</span>
                ) : (
                  <span className="ml-auto text-[10px] text-night-500">Verrouillé</span>
                )}
              </div>
              <p className="text-night-300 text-xs leading-relaxed">{b.desc}</p>
              {bd.action && (
                <p className="text-night-400 text-[11px] mt-2">→ {bd.action}</p>
              )}
              {bd.reward && (
                <p className="text-gold-400/80 text-[11px] mt-1">🎁 {bd.reward}</p>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Floating FX ───────────────────────── */}
      {toasts.map(t => (
        <div
          key={t.id}
          className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50"
          style={{ animation: 'prog-xp 1.4s ease-out forwards' }}
        >
          <span className="text-gold-300 font-bold text-2xl drop-shadow-lg">+{t.xp} XP</span>
        </div>
      ))}
      {levelUp.active && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          style={{ animation: 'prog-lvl 2.2s ease-out forwards' }}
        >
          <div className="glass-gold rounded-3xl px-8 py-6 text-center">
            <p className="text-gold-300 text-xs uppercase tracking-widest mb-1">Niveau supérieur</p>
            <p className="text-gold-gradient font-bold text-3xl">Niveau {levelUp.level}</p>
          </div>
        </div>
      )}
    </div>
  );
}
