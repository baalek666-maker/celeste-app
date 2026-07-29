import { useEffect, useMemo, useState } from 'react';
import { MoonPhase, Libration, MakeTime } from 'astronomy-engine';
import { localISODate } from '../lib/storage';

/**
 * DailyCycle v6 — le minimal absolu.
 *
 * 1 ÉCRAN · 1 VISUEL · 1 PHRASE.
 *
 * Camille a 2 secondes le matin. Elle ne lit pas. Elle voit.
 *
 * v5 → v6 :
 *   - Tout sauf : un chiffre géant (jour du cycle) + emoji + 1 phrase de 4 mots
 *   - Couleur du chiffre change selon la phase (4 couleurs)
 *   - Émoji phase lunaire en filigrane discret (pas de label)
 *   - Saisie date = 1 tap "Aujourd'hui" au premier coup (zéro friction)
 *   - Phrase changeante aussi sur la phase lunaire (8 variantes)
 *
 * Stockage : localStorage. Zéro backend. Zéro réseau.
 */

const STORAGE_START = 'celeste_cycle_period_start';
const DEFAULT_CYCLE_LENGTH = 28;

interface MoonInfo { phaseName: string; emoji: string; signKey: string; angle: number; }

function computeMoonInfo(): MoonInfo {
  try {
    const date = MakeTime(new Date());
    const angle = MoonPhase(date);
    let signKey = '';
    try {
      const lib = Libration(date);
      const mlon = ((lib.mlon % 360) + 360) % 360;
      const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
      signKey = SIGNS[Math.floor(mlon / 30)];
    } catch {}
    let phaseName = '';
    let emoji = '';
    if (angle < 22.5 || angle >= 337.5)      { phaseName = 'Nouvelle lune'; emoji = '🌑'; }
    else if (angle < 67.5)                    { phaseName = 'Premier croissant'; emoji = '🌒'; }
    else if (angle < 112.5)                   { phaseName = 'Premier quartier'; emoji = '🌓'; }
    else if (angle < 157.5)                   { phaseName = 'Gibbeuse croissante'; emoji = '🌔'; }
    else if (angle < 202.5)                   { phaseName = 'Pleine lune'; emoji = '🌕'; }
    else if (angle < 247.5)                   { phaseName = 'Gibbeuse décroissante'; emoji = '🌖'; }
    else if (angle < 292.5)                   { phaseName = 'Dernier quartier'; emoji = '🌗'; }
    else                                      { phaseName = 'Dernier croissant'; emoji = '🌘'; }
    return { phaseName, emoji, signKey, angle };
  } catch { return { phaseName: '', emoji: '🌙', signKey: '', angle: 0 }; }
}

function readStart(): string | null {
  try { const v = localStorage.getItem(STORAGE_START); if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v; } catch {}
  return null;
}
function writeStart(d: string) { try { localStorage.setItem(STORAGE_START, d); } catch {} }
function clearStart() { try { localStorage.removeItem(STORAGE_START); } catch {} }

function dayInCycle(start: string, length: number, refDate: Date = new Date()): number | null {
  try {
    const startDate = new Date(start + 'T00:00:00');
    if (isNaN(startDate.getTime())) return null;
    const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const diffDays = Math.floor((ref.getTime() - startDate.getTime()) / 86400000);
    if (diffDays < 0) return 0;
    return ((diffDays % length) + length) % length + 1;
  } catch { return null; }
}

interface PhaseInfo {
  key: string;
  /** couleur du chiffre + du fond */
  color: string;
  bgGradient: string;
  /** emoji cycle (filigrane) */
  emoji: string;
  /** phrase de 4 mots max */
  phrase: string;
}

function phaseInfo(day: number | null, length: number, moon: MoonInfo): PhaseInfo | null {
  if (day === null) return null;
  const ov = Math.round(length / 2);

  const moonFull = moon.phaseName === 'Pleine lune';
  const moonNew = moon.phaseName === 'Nouvelle lune';

  // Rotation : on change de phrase tous les ~5 jours dans la même phase
  // pour éviter la répétition. Basé sur la date du jour (pas le jour du cycle),
  // pour qu'elle change même si la phase est longue.
  const today = new Date();
  const rotKey = Math.floor((today.getTime() / (1000 * 60 * 60 * 24 * 5)) % 3);

  if (day <= 5) {
    const phrases = moonNew
      ? ['Page blanche, repos.', 'Tout est lent.', 'Tu répares en silence.']
      : moonFull
        ? ['Sens amplifiés, doucement.', 'Émotions à fleur de peau.', 'Donne-toi de la place.']
        : ['Ton corps te parle.', 'Écoute la lenteur.', 'Accorde-toi du repos.'];
    return {
      key: 'menstruelle',
      color: '#a855f7',
      bgGradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
      emoji: '🌑',
      phrase: phrases[rotKey % phrases.length],
    };
  }
  if (day < ov) {
    const phrases = moon.angle < 180
      ? ['Énergie qui monte.', 'Tu redémarres, vas-y.', 'Lance ce que tu repousses.']
      : ['Graines plantées, patience.', 'Tu prépares la suite.', 'Construis sans bruit.'];
    return {
      key: 'folliculaire',
      color: '#c084fc',
      bgGradient: 'from-purple-400/15 via-purple-400/5 to-transparent',
      emoji: '🌒',
      phrase: phrases[rotKey % phrases.length],
    };
  }
  if (day === ov || day === ov + 1) {
    const phrases = moonFull
      ? ['Tu rayonnes, brille.', 'Magnétisme au max.', 'Le monde te regarde.']
      : ['Tu es au pic.', 'Dis ce que tu penses.', 'Ton feu intérieur parle.'];
    return {
      key: 'ovulatoire',
      color: '#f59e0b',
      bgGradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
      emoji: '🌕',
      phrase: phrases[rotKey % phrases.length],
    };
  }
  const phrases = moon.angle >= 180
    ? ['Tu ralentis, repose.', 'Hydrate-toi, couve-toi.', 'Tu as besoin de moins.']
    : ['Tu redescends, écris.', 'Écoute ce qui revient.', 'Ton intuition murmure.'];
  return {
    key: 'luteale',
    color: '#6366f1',
    bgGradient: 'from-indigo-500/15 via-indigo-500/5 to-transparent',
    emoji: '🌘',
    phrase: phrases[rotKey % phrases.length],
  };
}

export default function DailyCycle() {
  const moon = useMemo(() => computeMoonInfo(), []);
  const [start, setStart] = useState<string | null>(() => readStart());
  const [today] = useState(() => localISODate());

  const day = dayInCycle(start ?? '', DEFAULT_CYCLE_LENGTH);
  const phase = phaseInfo(day, DEFAULT_CYCLE_LENGTH, moon);

  const handleToday = () => { writeStart(today); setStart(today); };
  const handleOtherDay = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    writeStart(v); setStart(v);
  };
  const handleReset = () => { clearStart(); setStart(null); };

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase();

  // ─── ÉCRAN SAISIE : zéro friction, 1 tap ───────────────────────────
  if (!start) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <button
          onClick={handleToday}
          className="text-[140px] leading-none font-bold text-gold-gradient active:scale-95 transition-transform"
          aria-label="Mes règles ont commencé aujourd'hui"
        >
          1
        </button>
        <p className="text-night-300 text-lg mt-2 mb-8">Tape pour aujourd'hui.</p>
        <label className="text-night-500 text-xs hover:text-gold-400 cursor-pointer transition-colors">
          ou un autre jour
          <input
            type="date"
            max={today}
            onChange={(e) => handleOtherDay(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    );
  }

  // ─── ÉCRAN PRINCIPAL : UN chiffre + UN phrase ──────────────────────
  return (
    <div
      className={`relative flex flex-col items-center justify-center min-h-[70vh] text-center bg-gradient-to-b ${phase?.bgGradient || ''} rounded-2xl overflow-hidden`}
      onDoubleClick={handleReset}
      title="Double-clic pour recommencer"
    >
      {/* Filigrane lune — emoji très discret en arrière-plan */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <span
          className="opacity-[0.06] text-[280px] leading-none"
          style={{ filter: 'blur(2px)' }}
        >
          {phase?.emoji || moon.emoji}
        </span>
      </div>

      {/* Contenu */}
      <div className="relative z-10 flex flex-col items-center">
        <p className="text-night-500 text-[10px] uppercase tracking-[0.3em] mb-2">
          {monthLabel}
        </p>
        <div
          className="text-[180px] leading-none font-bold tabular-nums"
          style={{
            color: phase?.color || '#F4D27A',
            textShadow: `0 0 60px ${phase?.color || '#F4D27A'}40`,
          }}
        >
          {day}
        </div>
        <p className="text-night-100 text-xl mt-6 font-medium max-w-xs leading-snug">
          {phase?.phrase || '—'}
        </p>
      </div>

      {/* Footer micro — invisible sauf au tap */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <button
          onClick={handleReset}
          className="text-night-600 hover:text-night-400 text-[10px] transition-colors"
        >
          ↻
        </button>
      </div>
    </div>
  );
}