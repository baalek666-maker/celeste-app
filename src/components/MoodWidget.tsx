import { useEffect, useState } from 'react';
import { toast } from './Toast';
import { localISODate } from '../lib/storage';

/**
 * MoodWidget — widget 1-tap "Comment te sens-tu aujourd'hui ?" (v9 audit).
 *
 * Concept : VMF ligne 167 "Ton rituel → Journal + Tarot + Horoscope".
 * On ajoute une check-in émotionnel sans friction :
 *   - 5 emojis simples (😔 😐 🙂 🤩 😴)
 *   - 1 seul tap
 *   - privé par défaut (juste stocké local)
 *   - opt-in futur pour agrégation anonyme
 *
 * Objectif : créer le réflexe "j'ouvre Céleste et je note mon état" → usage quotidien,
 * pas seulement "j'attends le push du matin".
 */

type Mood = 'low' | 'meh' | 'ok' | 'lit' | 'tired';

const MOODS: { id: Mood; emoji: string; label: string; tone: string }[] = [
  { id: 'low',   emoji: '😔', label: 'Au creux',     tone: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
  { id: 'meh',   emoji: '😐', label: 'Neutre',       tone: 'text-night-300 border-night-600/30 bg-night-700/20' },
  { id: 'ok',    emoji: '🙂', label: 'Plutôt bien',  tone: 'text-gold-300 border-gold-500/30 bg-gold-500/10' },
  { id: 'lit',   emoji: '🤩', label: 'En feu',       tone: 'text-orange-300 border-orange-500/30 bg-orange-500/10' },
  { id: 'tired', emoji: '😴', label: 'Au ralenti',   tone: 'text-purple-300 border-purple-500/30 bg-purple-500/10' },
];

const STORAGE_KEY = 'celeste_mood_log';

function getTodayMood(): Mood | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const log: Record<string, Mood> = JSON.parse(raw);
    return log[localISODate()] ?? null;
  } catch { return null; }
}

function setTodayMood(m: Mood) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const log: Record<string, Mood> = raw ? JSON.parse(raw) : {};
    log[localISODate()] = m;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

export function MoodWidget() {
  const [selected, setSelected] = useState<Mood | null>(getTodayMood());
  const [pulse, setPulse] = useState<Mood | null>(null);

  // Animation pulse 1× après sélection
  useEffect(() => {
    if (!selected) return;
    setPulse(selected);
    const t = setTimeout(() => setPulse(null), 600);
    return () => clearTimeout(t);
  }, [selected]);

  const handle = (m: Mood) => {
    setSelected(m);
    setTodayMood(m);
    // v9 — offline-first : pas d'appel API obligatoire.
    // Le local est suffisant pour la promesse "privé sur ton appareil".
    // Futur opt-in : agrégation anonyme via /api/mood-log (à brancher quand backend prêt).
    if (m === 'low' || m === 'tired') {
      // petit toast d'empathie si énergie basse — pas intrusif
      setTimeout(() => toast.success('Prends soin de toi. Le ciel t\'accompagne.'), 200);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 mb-2 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">
          Comment tu te sens ?
        </h3>
        {selected && (
          <span className="text-night-500 text-[10px]">Privé · reste sur ton appareil</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1.5">
        {MOODS.map((m) => {
          const isSelected = selected === m.id;
          const isPulse = pulse === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handle(m.id)}
              aria-label={m.label}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all
                ${isSelected ? m.tone : 'border-night-700/30 bg-night-800/30 hover:border-gold-500/20'}
                ${isPulse ? 'scale-125' : 'scale-100'}
                active:scale-95 duration-200
              `}
            >
              <span className={`text-2xl ${isSelected ? '' : 'grayscale-[0.4] opacity-70'}`}>
                {m.emoji}
              </span>
              <span className={`text-[9px] uppercase tracking-wide font-medium ${isSelected ? '' : 'text-night-500'}`}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
