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

      {/* ── Daily Quests ──────────────────────── */}
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-night-100 font-bold text-sm">⚔️ Quêtes du jour</h3>
          <span className="text-night-400 text-xs">{questsDone}/{gami.questsTotal}</span>
        </div>
        {gami.quests.length === 0 ? (
          <p className="text-night-400 text-xs py-2">Reviens demain pour de nouvelles quêtes.</p>
        ) : (
          <div className="space-y-2">
            {gami.quests.map(q => (
              <button
                key={q.quest_key}
                disabled={q.completed || busyKey === q.quest_key}
                onClick={() => completeQuest(q)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all relative overflow-hidden ${
                  q.completed
                    ? 'bg-night-800/40 opacity-50'
                    : 'glass hover:border-gold-500/30 border border-transparent'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  q.completed ? 'bg-gold-500/20 text-gold-300' : 'border border-night-500'
                }`}>
                  {q.completed ? '✓' : ''}
                </span>
                <span className={`flex-1 text-xs ${q.completed ? 'text-night-400 line-through' : 'text-night-200'}`}>
                  {q.quest_label}
                </span>
                <span className="text-gold-300/70 text-[10px] font-mono">+{q.xp_reward}</span>
              </button>
            ))}
          </div>
        )}
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
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-night-100 font-bold text-sm">🏆 Badges</h3>
          <span className="text-night-400 text-xs">{gami.badgesEarned}/{gami.badgesTotal}</span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {gami.badges.map(b => (
            <button
              key={b.id}
              onClick={() => b.earned && setBadgeActive(badgeActive === b.id ? null : b.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                b.earned ? 'hover:scale-105 cursor-pointer' : 'opacity-30'
              }`}
            >
              <span className="text-2xl">{b.earned ? b.emoji : '🔒'}</span>
              <span className={`text-[9px] text-center leading-tight ${b.earned ? 'text-night-300' : 'text-night-500'}`}>
                {b.title}
              </span>
            </button>
          ))}
        </div>
        {badgeActive && (() => {
          const b = gami.badges.find(x => x.id === badgeActive);
          return b ? (
            <div className="mt-3 glass-gold rounded-xl p-3 animate-fade-in">
              <p className="text-gold-200 font-semibold text-xs mb-1">{b.emoji} {b.title}</p>
              <p className="text-night-200 text-xs">{b.desc}</p>
            </div>
          ) : null;
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
