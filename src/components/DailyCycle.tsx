import { useEffect, useMemo, useState } from 'react';
import { MoonPhase, Libration, MakeTime } from 'astronomy-engine';
import { localISODate } from '../lib/storage';

/**
 * DailyCycle v5 — le module épuré.
 *
 * Une saisie (date des dernières règles) → 1 écran, 3 blocs, chaque bloc = 1 information.
 * Aucune phrase ne fait plus de 8 mots. Aucun jargon. Aucune cosmétique.
 *
 * v4 → v5 :
 *   - Anneau réduit à 2 phases (passée / à venir) au lieu de 4
 *   - Curseur retiré : juste un disque qui grandit sur la phase courante
 *   - Labels M/F/O/L retirés (trop technique)
 *   - Boutons 26/28/30/32 retirés (cosmétique)
 *   - "Jour X/28" simplifié en "Jour X"
 *   - Timeline : juste emoji + 1 mot, pas 3 lignes par jour
 *   - Footer : 1 ligne astro (Phase lunaire + signe)
 *   - Banner "cycle expiré" : conservé mais replié (apparaît seulement si +length+2j)
 */

const STORAGE_START = 'celeste_cycle_period_start';
const STORAGE_LENGTH = 'celeste_cycle_length';
const DEFAULT_CYCLE_LENGTH = 28;
const MIN_CYCLE_LENGTH = 21;
const MAX_CYCLE_LENGTH = 35;

interface MoonInfo { phaseName: string; emoji: string; angle: number; signKey: string; }

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
    let phaseName = ''; let emoji = '';
    if (angle < 22.5 || angle >= 337.5)      { phaseName = 'Nouvelle lune'; emoji = '🌑'; }
    else if (angle < 67.5)                    { phaseName = 'Premier croissant'; emoji = '🌒'; }
    else if (angle < 112.5)                   { phaseName = 'Premier quartier'; emoji = '🌓'; }
    else if (angle < 157.5)                   { phaseName = 'Gibbeuse croissante'; emoji = '🌔'; }
    else if (angle < 202.5)                   { phaseName = 'Pleine lune'; emoji = '🌕'; }
    else if (angle < 247.5)                   { phaseName = 'Gibbeuse décroissante'; emoji = '🌖'; }
    else if (angle < 292.5)                   { phaseName = 'Dernier quartier'; emoji = '🌗'; }
    else                                      { phaseName = 'Dernier croissant'; emoji = '🌘'; }
    return { phaseName, emoji, angle, signKey };
  } catch { return { phaseName: '', emoji: '🌙', angle: 0, signKey: '' }; }
}

function readStart(): string | null {
  try { const v = localStorage.getItem(STORAGE_START); if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v; } catch {}
  return null;
}
function writeStart(d: string) { try { localStorage.setItem(STORAGE_START, d); } catch {} }
function clearStart() { try { localStorage.removeItem(STORAGE_START); } catch {} }
function readLength(): number {
  try { const v = Number(localStorage.getItem(STORAGE_LENGTH)); if (Number.isFinite(v) && v >= MIN_CYCLE_LENGTH && v <= MAX_CYCLE_LENGTH) return v; } catch {}
  return DEFAULT_CYCLE_LENGTH;
}

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

interface PhaseInfo { key: string; label: string; emoji: string; }

function phaseForDay(day: number | null, length: number): PhaseInfo | null {
  if (day === null) return null;
  const ov = Math.round(length / 2);
  if (day <= 5)         return { key: 'menstruelle',  label: 'Tu as tes règles',      emoji: '🌑' };
  if (day < ov)          return { key: 'folliculaire', label: 'Tu montes en énergie',  emoji: '🌒' };
  if (day === ov)        return { key: 'ovulatoire',   label: 'Tu ovules aujourd\'hui', emoji: '🌕' };
  if (day === ov + 1)    return { key: 'ovulatoire',   label: 'Tu es au pic',          emoji: '🌕' };
  return                       { key: 'luteale',     label: 'Tu redescends',         emoji: '🌘' };
}

/** 1 phrase d'action par jour, courte, directe, jamais poétique. */
function tonightAction(phaseKey: string, moon: MoonInfo): string {
  const moonFull = moon.phaseName === 'Pleine lune';
  const moonNew = moon.phaseName === 'Nouvelle lune';
  const moonWaxing = moon.angle > 0 && moon.angle < 180;

  if (phaseKey === 'menstruelle') {
    if (moonFull) return 'Bain chaud. Lit tôt.';
    if (moonNew)  return 'Dors. Ton corps répare.';
    return 'Pas de sport intense.';
  }
  if (phaseKey === 'folliculaire') {
    if (moonWaxing) return 'Lance ce que tu repousses.';
    return 'Planifie, écris, pose les bases.';
  }
  if (phaseKey === 'ovulatoire') {
    if (moonFull) return 'Sors. Vois du monde.';
    return 'Dis ce que tu penses.';
  }
  return 'Hydrate-toi, mange chaud.';
}

/** 7 jours à venir : emoji + 1 mot-clé unique par jour. */
function weekForecast(start: string, length: number, today: Date): { label: string; emoji: string; word: string }[] {
  const days: { label: string; emoji: string; word: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayNum = dayInCycle(start, length, d);
    const phase = phaseForDay(dayNum, length);
    const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    let word: string;
    if (!phase) word = '—';
    else if (phase.key === 'menstruelle') word = i === 0 ? 'repos' : 'douceur';
    else if (phase.key === 'folliculaire') word = i === 0 ? 'monte' : 'crée';
    else if (phase.key === 'ovulatoire') word = i === 0 ? 'brille' : 'agis';
    else if (dayNum !== null && dayNum === length) word = 'règles';
    else word = 'ralentis';
    days.push({ label: dayLabel, emoji: phase?.emoji || '·', word });
  }
  return days;
}

export default function DailyCycle() {
  const moon = useMemo(() => computeMoonInfo(), []);
  const [start, setStart] = useState<string | null>(() => readStart());
  const length = useMemo(() => readLength(), []);
  const [today] = useState(() => localISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const day = dayInCycle(start ?? '', length);
  const phase = phaseForDay(day, length);
  const action = phase ? tonightAction(phase.key, moon) : '';
  const week = useMemo(() => start ? weekForecast(start, length, new Date()) : [], [start, length]);

  const cycleExpired = useMemo(() => {
    if (!start) return false;
    try {
      const sd = new Date(start + 'T00:00:00');
      const ref = new Date(); ref.setHours(0,0,0,0);
      return Math.floor((ref.getTime() - sd.getTime()) / 86400000) > length + 2;
    } catch { return false; }
  }, [start, length]);

  const handleToday = () => { const t = localISODate(); writeStart(t); setStart(t); setShowDatePicker(false); };
  const handleCustomDate = (v: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return; writeStart(v); setStart(v); setShowDatePicker(false); };
  const handleReset = () => { clearStart(); setStart(null); setShowDatePicker(false); };

  // ─── ÉCRAN 1 : pas encore de date ───
  if (!start) {
    return (
      <div className="space-y-4">
        <p className="text-night-300 text-sm px-1">
          Quand tes dernières règles ont-elles commencé ?
        </p>
        <button
          onClick={handleToday}
          className="w-full glass-gold rounded-2xl p-5 border-2 border-gold-500/40 hover:border-gold-400 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="text-3xl">🌙</div>
            <div className="flex-1 text-left">
              <p className="text-night-100 font-semibold">Aujourd'hui</p>
              <p className="text-night-400 text-xs mt-0.5">Un tap — je calcule la suite</p>
            </div>
            <span className="text-gold-400 text-xl">→</span>
          </div>
        </button>
        {!showDatePicker ? (
          <button
            onClick={() => setShowDatePicker(true)}
            className="block mx-auto text-night-400 hover:text-gold-400 text-sm transition-colors"
          >
            ou un autre jour
          </button>
        ) : (
          <div className="glass rounded-2xl p-4 animate-fade-in">
            <input
              type="date" max={today} autoFocus
              onChange={(e) => handleCustomDate(e.target.value)}
              className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 focus:outline-none focus:border-gold-500/50 transition-colors"
            />
            <button onClick={() => setShowDatePicker(false)} className="mt-3 text-night-500 hover:text-night-300 text-xs transition-colors">
              Annuler
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── ÉCRAN 2 : saisie faite, 3 blocs uniquement ───
  return (
    <div className="space-y-5">
      {/* Banner expiré — replié, discret */}
      {cycleExpired && (
        <button
          onClick={handleToday}
          className="w-full glass rounded-2xl p-3 border border-amber-500/30 bg-amber-500/5 text-left animate-fade-in active:scale-[0.99] transition-all"
        >
          <p className="text-night-200 text-xs">
            ⏰ Tes règles arrivent. <span className="text-gold-300 underline-offset-2 hover:underline">Taper ici si oui</span>.
          </p>
        </button>
      )}

      {/* BLOC 1 — T'en es là */}
      <div className="text-center">
        <div className="text-3xl mb-2 animate-float-slow">✦</div>
        <p className="text-night-500 text-[10px] uppercase tracking-[0.3em] mb-3">T'en es là</p>
        <CycleRing day={day ?? 0} length={length} phase={phase} />
        <p className="text-night-100 text-base font-medium mt-4">
          {phase?.label || '—'}
        </p>
        <p className="text-night-500 text-xs mt-1">Jour {day} · cycle de {length} jours</p>
      </div>

      {/* Séparateur */}
      <div className="h-px bg-gradient-to-r from-transparent via-night-700/60 to-transparent" />

      {/* BLOC 2 — Ce soir */}
      {phase && (
        <div>
          <p className="text-night-500 text-[10px] uppercase tracking-[0.3em] mb-2">Ce soir</p>
          <p className="text-night-100 text-lg font-medium leading-snug">{action}.</p>
        </div>
      )}

      {/* Séparateur */}
      <div className="h-px bg-gradient-to-r from-transparent via-night-700/60 to-transparent" />

      {/* BLOC 3 — La semaine */}
      <div>
        <p className="text-night-500 text-[10px] uppercase tracking-[0.3em] mb-3">La semaine</p>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d, i) => {
            const isToday = i === 0;
            return (
              <div key={i} className={`text-center rounded-xl py-2.5 ${isToday ? 'bg-gold-500/10 border border-gold-500/30' : ''}`}>
                <p className="text-[9px] uppercase tracking-wider text-night-500">{d.label}</p>
                <p className="text-lg my-1">{d.emoji}</p>
                <p className={`text-[10px] ${isToday ? 'text-gold-300 font-semibold' : 'text-night-400'}`}>{d.word}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-night-500 text-[11px]">
          {moon.phaseName}{moon.signKey ? ` en ${moon.signKey}` : ''}
        </p>
        <button onClick={handleReset} className="text-night-500 hover:text-night-300 text-[11px] transition-colors">
          Recommencer
        </button>
      </div>

      {showDatePicker && (
        <div className="glass rounded-2xl p-4 animate-fade-in">
          <input
            type="date" max={today} autoFocus
            onChange={(e) => handleCustomDate(e.target.value)}
            className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 focus:outline-none focus:border-gold-500/50 transition-colors"
          />
          <button onClick={() => setShowDatePicker(false)} className="mt-3 text-night-500 hover:text-night-300 text-xs transition-colors">
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * CycleRing — anneau minimaliste 2 phases.
 * Une moitié = "passée", l'autre = "à venir".
 * Disque central sur la phase courante.
 */
function CycleRing({ day, length, phase }: { day: number; length: number; phase: PhaseInfo | null }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 60;
  const rInner = 48;
  const r = (rOuter + rInner) / 2;
  const strokeWidth = rOuter - rInner;

  // Position du curseur (0° = haut, sens horaire)
  const angleForDay = (d: number) => -90 + ((d - 1) / length * 360);
  const cursorAngle = angleForDay(day);
  const cursorRad = (cursorAngle * Math.PI) / 180;
  const cursorX = cx + r * Math.cos(cursorRad);
  const cursorY = cy + r * Math.sin(cursorRad);

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Demi-cercle "passée" — couleur discrète */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(197,160,89,0.25)"
          strokeWidth={strokeWidth}
        />
        {/* Demi-cercle "à venir" — or */}
        <path
          d={`M ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy}`}
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth={strokeWidth}
        />
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f4d27a" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* Disque curseur "tu es ici" */}
        <circle
          cx={cursorX} cy={cursorY} r="6"
          fill={phase?.emoji === '🌕' ? '#f59e0b' : '#F4D27A'}
          stroke="#0a0508" strokeWidth="2"
        />
        {/* Centre : phase */}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="20" fill="#F4D27A">{phase?.emoji || '·'}</text>
      </svg>
    </div>
  );
}