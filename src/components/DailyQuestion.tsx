/**
 * DailyQuestion — v15.7
 *
 * 1 question personnelle par jour, liée au transit dominant.
 * 3 réponses cliquables, la réponse est enregistrée comme entrée de journal
 * (une nouvelle entrée par jour = progression naturelle du journal = contenu).
 *
 * La question change chaque jour (basée sur le transit dominant du jour + seed date).
 * Le but est de pousser l'engagement quotidien via un micro-rituel.
 */
import { useState, useEffect, useMemo } from 'react';
import type { NatalChart, User } from '../types';
import { getDailyDominantTransit } from '../lib/dailyTransit';
import { api } from '../lib/api';

const QUESTIONS_BY_TRANSIT: Record<string, { q: string; options: string[] }> = {
  mercury: {
    q: 'Comment ton mental se sent-il aujourd\'hui ?',
    options: ['Clair et posé', 'Partagé entre mille idées', 'Au ralenti'],
  },
  venus: {
    q: 'Quel geste de douceur ferais-tu plaisir à offrir aujourd\'hui ?',
    options: ['À quelqu\'un que j\'aime', 'À moi-même', 'À la nature'],
  },
  mars: {
    q: 'Sur quoi veux-tu poser une action concrète ?',
    options: ['Un projet qui dort', 'Une conversation difficile', 'Mon corps (sport, marche…)'],
  },
  jupiter: {
    q: 'Quelle expansion t\'appelle en ce moment ?',
    options: ['Apprendre quelque chose de nouveau', 'Élargir mon cercle', 'Voir plus grand'],
  },
  saturn: {
    q: 'Quelle structure mérite ton attention ?',
    options: ['Mes routines', 'Mes finances', 'Mes engagements'],
  },
  uranus: {
    q: 'Où as-tu envie de casser la routine ?',
    options: ['Un trajet différent', 'Une nouvelle habitude', 'Une conversation audacieuse'],
  },
  neptune: {
    q: 'De quoi as-tu besoin pour reconnecter à ton intuition ?',
    options: ['Du silence', 'De la musique ou de l\'art', 'Un bain ou de l\'eau'],
  },
  pluto: {
    q: 'Quelle vérité enfouie demande à émerger ?',
    options: ['Sur une relation', 'Sur un choix de vie', 'Sur moi-même'],
  },
  sun: {
    q: 'Comment veux-tu briller aujourd\'hui ?',
    options: ['Avec créativité', 'Avec leadership', 'Avec douceur'],
  },
  moon: {
    q: 'De quoi ton corps a-t-il besoin maintenant ?',
    options: ['Du repos', 'Du mouvement', 'De la nourriture réconfortante'],
  },
};

function pickQuestionForToday(transitKey: string) {
  const base = QUESTIONS_BY_TRANSIT[transitKey] || QUESTIONS_BY_TRANSIT.sun;
  // Seed = date du jour pour que la question soit stable toute la journée,
  // mais différente chaque jour. Petite rotation de la question au sein d'un même transit.
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = dayOfYear % 3;
  // v15.7.1 — Corrigé : la variation 3 ("Quel est le geste...") était agrammaticale.
  // On fait maintenant 3 reformulations valides :
  //   1. question originale
  //   2. version "ces temps-ci" (plus contemplative)
  //   3. version affirmative (pas de "Quel")
  const variations = [
    base.q,
    base.q.replace(/aujourd'hui/g, 'ces temps-ci'),
    base.q
      .replace(/Quel geste de douceur ferais-tu plaisir/g, 'Un geste de douceur t\'appelle')
      .replace(/Quelle expansion t'appelle/g, 'Une expansion t\'appelle')
      .replace(/Quelle structure mérite ton attention/g, 'Une structure demande ton attention')
      .replace(/Où as-tu envie de casser la routine/g, 'Un endroit de ta routine demande à être cassé')
      .replace(/De quoi as-tu besoin pour reconnecter à ton intuition/g, 'Ton intuition a besoin d\'être reconnectée')
      .replace(/Quelle vérité enfouie demande à émerger/g, 'Une vérité enfouie demande à émerger')
      .replace(/Comment veux-tu briller aujourd'hui/g, 'Une façon de briller s\'offre à toi')
      .replace(/Sur quoi veux-tu poser une action concrète/g, 'Une action concrète t\'attend')
      .replace(/Comment ton mental se sent-il aujourd'hui/g, 'Ton mental traverse quelque chose')
      .replace(/De quoi ton corps a-t-il besoin maintenant/g, 'Ton corps exprime un besoin maintenant'),
  ];
  return {
    q: variations[idx] || base.q,
    options: base.options,
  };
}

export function DailyQuestion({ chart }: { chart: NatalChart }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calcule la question au montage. useMemo pour stabilité entre re-renders.
  const { transit, q, options } = useMemo(() => {
    const t = (() => { try { return getDailyDominantTransit(); } catch { return 'sun'; } })();
    return { transit: t, ...pickQuestionForToday(t) };
  }, []);

  // v15.7 — charge la réponse du jour depuis localStorage (per-user, per-day)
  const storageKey = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return `celeste_dq_${today}_${transit}`;
  }, [transit]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.answer === 'string') {
          setAnswer(parsed.answer);
          setSaved(true);
        }
      }
    } catch { /* localStorage indisponible */ }
  }, [storageKey]);

  const handleAnswer = async (opt: string) => {
    if (answer) return; // déjà répondu
    setAnswer(opt);
    setSaving(true);
    // v15.7 — enregistre comme entrée de journal (1 ligne : question + réponse).
    try {
      await api.saveJournalEntry({
        userNote: `Question du jour : ${q}\nMa réponse : ${opt}`,
        userRating: 0,
      } as any).catch(() => null); // on n'échoue pas l'UI si le serveur est down
    } catch { /* offline OK */ }
    // Sauvegarde locale pour ne pas re-poser la question dans la même journée
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answer: opt, transit, at: Date.now() }));
    } catch { /* storage plein */ }
    setSaving(false);
    setSaved(true);
  };

  // Si déjà répondu aujourd'hui, on affiche un état "répondu" compact
  if (saved && answer) {
    return (
      <div className="mx-5 my-4 p-4 rounded-2xl glass border border-cosmic-500/30 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cosmic-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-base">✓</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-cosmic-300 font-semibold">
              Question du jour
            </p>
            <p className="text-sm text-night-200 leading-snug">
              <span className="text-night-400">{q}</span>
              <br />
              <span className="text-gold-300 font-medium">→ {answer}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-5 my-4 p-5 rounded-2xl glass border border-gold-500/30 animate-fade-in"
         style={{ background: 'linear-gradient(135deg, rgba(192,132,252,0.06) 0%, rgba(251,191,36,0.04) 100%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 uppercase tracking-wider font-semibold">
          Question du jour
        </span>
        <span className="text-[10px] text-night-500">
          ✦ {transit}
        </span>
      </div>

      <p className="text-base text-night-100 leading-relaxed mb-4 font-medium">
        {q}
      </p>

      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleAnswer(opt)}
            disabled={saving}
            className="w-full text-left p-3 rounded-xl glass border border-night-700 hover:border-cosmic-500/50 hover:bg-cosmic-500/5 text-sm text-night-200 transition-colors duration-200 ease-out duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}