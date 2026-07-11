import { useEffect, useState } from 'react';

const MILESTONES = [7, 14, 30, 60, 90, 180, 365];

const MILESTONE_DATA: Record<number, { emoji: string; title: string; subtitle: string }> = {
  7:   { emoji: '🔥', title: '7 jours !',   subtitle: 'Une semaine complète à écouter les étoiles.' },
  14:  { emoji: '✨', title: '14 jours !',  subtitle: 'Vous êtes sur une belle lancée cosmique.' },
  30:  { emoji: '🌙', title: '30 jours !',  subtitle: 'Un cycle lunaire complet. Votre persévérance inspire.' },
  60:  { emoji: '⭐', title: '60 jours !',  subtitle: 'Deux cycles lunaires — votre connexion s’approfondit.' },
  90:  { emoji: '🌟', title: '90 jours !',  subtitle: 'Un trimestre céleste. Vous faites partie des plus dévoué·e·s.' },
  180: { emoji: '💫', title: '180 jours !', subtitle: 'Un demi-cycle solaire. Votre constance est remarquable.' },
  365: { emoji: '👑', title: 'Un an !',     subtitle: 'Un tour complet du soleil. Vous êtes une âme céleste.' },
};

/**
 * Shows a one-time celebratory overlay when the user hits a streak milestone.
 * Tracks which milestones have already been celebrated in localStorage.
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
      <div className="text-center px-8">
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
