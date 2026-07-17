import { useEffect, useState } from 'react';

const MILESTONES = [7, 14, 30, 60, 90, 180, 365];

const MILESTONE_DATA: Record<number, { emoji: string; title: string; subtitle: string }> = {
  7:   { emoji: '🔥', title: '7 jours !',   subtitle: 'Une semaine complète à écouter les étoiles.' },
  14:  { emoji: '✨', title: '14 jours !',  subtitle: 'Tu es sur une belle lancée.' },
  30:  { emoji: '🌙', title: '30 jours !',  subtitle: 'Un cycle lunaire complet. Ton persévérance inspire.' },
  60:  { emoji: '⭐', title: '60 jours !',  subtitle: 'Deux cycles lunaires — ta connexion s’approfondit.' },
  90:  { emoji: '🌟', title: '90 jours !',  subtitle: 'Un trimestre céleste. Tu fais partie des plus dévoué·e·s.' },
  180: { emoji: '💫', title: '180 jours !', subtitle: 'Un demi-cycle solaire. Ta constance est remarquable.' },
  365: { emoji: '👑', title: 'Un an !',     subtitle: 'Un tour complet du soleil. Tu es une âme céleste.' },
};

/**
 * v11 — Confetti doré : 24 particules tombantes avec 3 shapes (✦ ✧ ·) et 3 délais.
 * Calcul déterministe (pas de Math.random dans le render pour stabilité SSR/React).
 */
function generateConfetti(count = 24): { left: number; delay: number; dur: number; symbol: string; size: number }[] {
  const symbols = ['✦', '✧', '·', '✦', '✧'];
  return Array.from({ length: count }).map((_, i) => ({
    left: (i * 97 + 13) % 100,           // pseudo-aléatoire déterministe
    delay: (i * 0.07) % 1.2,
    dur: 2.4 + ((i * 0.13) % 1.6),
    symbol: symbols[i % symbols.length],
    size: 10 + ((i * 7) % 14),
  }));
}

const CONFETTI = generateConfetti(28);

/**
 * Shows a one-time celebratory overlay when the user hits a streak milestone.
 * Tracks which milestones have already been celebrated in localStorage.
 * v11 — ajoute un layer de confetti doré (28 particules) pendant 2.5s.
 */
export default function StreakCelebration({ streak }: { streak: number }) {
  const [showMilestone, setShowMilestone] = useState<number | null>(null);

  useEffect(() => {
    if (streak < 7) return;
    if (!MILESTONES.includes(streak)) return;

    const KEY = 'celeste_milestones_shown';
    let shown: number[] = [];
    try { shown = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* ignore */ }

    if (shown.includes(streak)) return;

    setShowMilestone(streak);
    shown.push(streak);
    localStorage.setItem(KEY, JSON.stringify(shown));

    const timer = setTimeout(() => setShowMilestone(null), 5000);
    return () => clearTimeout(timer);
  }, [streak]);

  if (showMilestone === null) return null;

  const data = MILESTONE_DATA[showMilestone];
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(5, 5, 5, 0.85)', backdropFilter: 'blur(8px)' }}
      onClick={() => setShowMilestone(null)}
    >
      {/* v11 — Confetti doré (28 particules, chute 2.4-4s, 3 symboles ✦ ✧ ·) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute text-gold-300"
            style={{
              left: `${p.left}%`,
              top: '-5%',
              fontSize: `${p.size}px`,
              animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in forwards`,
              opacity: 0.85,
              filter: 'drop-shadow(0 0 6px rgba(212,168,88,0.7))',
            }}
          >
            {p.symbol}
          </span>
        ))}
      </div>

      <div className="text-center px-8 relative z-10">
        <div className="text-7xl mb-6 animate-float-slow">{data.emoji}</div>
        <h2 className="text-3xl font-bold text-gold-gradient mb-3">{data.title}</h2>
        <p className="text-night-300 text-sm leading-relaxed max-w-xs mx-auto mb-2">{data.subtitle}</p>
        <p className="text-night-500 text-xs">Touchez l’écran pour continuer</p>
        <div className="flex justify-center gap-4 mt-6 text-2xl opacity-60">
          <span className="animate-pulse" style={{ animationDelay: '0s' }}>✦</span>
          <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>✧</span>
          <span className="animate-pulse" style={{ animationDelay: '0.6s' }}>✦</span>
        </div>
      </div>
    </div>
  );
}
