/**
 * P2#15 — Yearly Recap.
 *
 * Chaque fin d'année (ou sur demande depuis Settings/Profil), l'user découvre
 * son "année céleste" en chiffres : quêtes accomplies, entrées de journal,
 * cartes tirées, transits traversés, streak max.
 *
 * Objectif rétention + viralité : la ShareCard générée est pensée pour IG/Stories.
 *
 * Source de données :
 *   - /api/yearly-recap?year=YYYY → agrège user_xp, xp_log, journal_entries,
 *     daily_quests, tarot_draws de l'année.
 *   - Fallback : si l'user est hors-ligne, on affiche un état dégradé.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ShareCard } from './ShareCard';

interface RecapData {
  year: number;
  questsCompleted: number;
  xpEarned: number;
  journalEntries: number;
  cardsDrawn: number;
  runesDrawn: number;
  longestStreak: number;
  topCard?: { name: string; emoji: string; count: number };
  topSign?: string;
  moodWord?: string;
  badgesUnlocked: number;
  joinedDate: string;
}

interface YearlyRecapProps {
  year?: number;
}

export function YearlyRecap({ year }: YearlyRecapProps) {
  const yr = year ?? new Date().getFullYear();
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getYearlyRecap(yr)
      .then((res) => {
        if (alive) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setErr(e instanceof Error ? e.message : 'Récap indisponible');
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, [yr]);

  if (loading) {
    return (
      <div className="glass rounded-3xl p-6 animate-pulse">
        <div className="h-6 bg-night-700 rounded w-1/2 mb-4" />
        <div className="h-20 bg-night-700/60 rounded mb-3" />
        <div className="h-20 bg-night-700/60 rounded" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="glass rounded-3xl p-6 text-center">
        <p className="text-3xl mb-3">✨</p>
        <p className="text-night-200 text-sm">{err || 'Ton récap arrive bientôt.'}</p>
      </div>
    );
  }

  const shareData = {
    date: `Année ${yr}`,
    general: data.moodWord
      ? `Ton année en un mot : ${data.moodWord}.`
      : `${data.questsCompleted} rituels, ${data.journalEntries} entrées, ${data.longestStreak} jours de suite.`,
    energy: Math.min(5, Math.max(1, Math.round(data.xpEarned / 1000))),
    mood: data.moodWord,
  };

  return (
    <div className="glass-gold rounded-3xl p-6 mb-4 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-gold-400 text-xs uppercase tracking-widest mb-1">Ton année céleste</p>
          <h2 className="font-serif text-2xl text-gold-100">✦ {yr}</h2>
        </div>
        <button
          onClick={() => setShareOpen(true)}
          className="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-medium text-night-900 transition active:scale-95"
        >
          📤 Partager
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon="🌙" value={data.questsCompleted} label="Rituels accomplis" />
        <StatCard icon="📖" value={data.journalEntries} label="Entrées de journal" />
        <StatCard icon="🃏" value={data.cardsDrawn} label="Cartes tirées" />
        <StatCard icon="ᚱ" value={data.runesDrawn} label="Runes tirées" />
        <StatCard icon="🔥" value={data.longestStreak} label="Jours de suite (max)" />
        <StatCard icon="⚡" value={data.xpEarned} label="XP gagnée" />
      </div>

      {/* Highlighted insight */}
      {data.topCard && (
        <div className="rounded-2xl bg-night-900/60 p-4 mb-3 border border-gold-500/15">
          <p className="text-night-400 text-xs mb-1">Ta carte de l'année</p>
          <p className="text-gold-100 font-serif text-lg">
            {data.topCard.emoji} {data.topCard.name}
          </p>
          <p className="text-night-400 text-xs mt-1">
            Tirée {data.topCard.count} fois — elle t'a accompagné·e tout au long de l'année.
          </p>
        </div>
      )}

      {data.badgesUnlocked > 0 && (
        <p className="text-center text-night-300 text-sm italic">
          ✦ {data.badgesUnlocked} badge{data.badgesUnlocked > 1 ? 's' : ''} débloqué{data.badgesUnlocked > 1 ? 's' : ''} cette année
        </p>
      )}

      <p className="text-center text-night-500 text-[11px] mt-4">
        Chez Céleste depuis le {new Date(data.joinedDate).toLocaleDateString('fr-FR')}
      </p>

      {/* ShareCard — format fin d'année */}
      <ShareCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        data={shareData}
      />
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-night-900/40 p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-gold-100 font-serif text-xl">{value.toLocaleString('fr-FR')}</div>
      <div className="text-night-400 text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

/**
 * Wrapper dépliable pour Settings : carte fermée = simple bouton,
 * carte ouverte = charge le YearlyRecap détaillé.
 */
export function YearlyRecapCollapsible() {
  const [open, setOpen] = useState(false);
  const yr = new Date().getFullYear();
  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-gold-500/30 border border-transparent transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">✨</span>
            <div>
              <span className="text-gold-400 text-sm font-medium">Ton année céleste {yr}</span>
              <p className="text-night-500 text-xs mt-0.5">Rituels, cartes, badges — ton bilan</p>
            </div>
          </div>
          <span className="text-gold-400 text-sm">Voir →</span>
        </button>
      ) : (
        <div>
          <button
            onClick={() => setOpen(false)}
            className="w-full text-center text-night-500 text-xs mb-2 hover:text-night-300 transition-colors"
          >
            ‹ Fermer le récap
          </button>
          <YearlyRecap year={yr} />
        </div>
      )}
    </div>
  );
}

export default YearlyRecap;
