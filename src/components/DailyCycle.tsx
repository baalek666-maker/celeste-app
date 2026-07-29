import { useEffect, useMemo, useState } from 'react';
import { MoonPhase, Libration, MakeTime } from 'astronomy-engine';
import { localISODate } from '../lib/storage';
import type { ZodiacSign } from '../types';

/**
 * DailyCycle v4 — minimaliste, concret, comme pour une amie de 5 ans.
 *
 * Philosophie :
 *   - 1 saisie (date des dernières règles) → tout le reste est calculé
 *   - 3 écrans maximum une fois saisie faite :
 *       1. "T'en es là"        → anneau visuel
 *       2. "Ce soir"           → 1 action concrète, 1 phrase
 *       3. "Les 7 jours"       → 1 mot-clé par jour à venir
 *   - Zéro jargon, zéro texte générique, zéro cosmétique
 *
 * v3 → v4 :
 *   - SUPPRIMÉ : carte "Calendrier du cycle" (doublon de l'anneau)
 *   - SUPPRIMÉ : carte "Durée du cycle" (boutons cosmétiques)
 *   - SUPPRIMÉ : carte "Ton ciel te reconnaît" (insight natal cosmétique)
 *   - AJOUTÉ   : "Ce soir, ..." — 1 action unique par jour
 *   - AJOUTÉ   : "Les 7 prochains jours" — timeline courte
 *   - AJOUTÉ   : texte d'onboarding plus court (1 phrase d'invitation, pas 2)
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
    let signKey: string = '';
    try {
      const lib = Libration(date);
      const mlon = ((lib.mlon % 360) + 360) % 360;
      const signIdx = Math.floor(mlon / 30);
      const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
      signKey = SIGNS[signIdx];
    } catch { /* signe optionnel */ }
    let phaseName: string; let emoji: string;
    if (angle < 22.5 || angle >= 337.5)      { phaseName = 'Nouvelle lune'; emoji = '🌑'; }
    else if (angle < 67.5)                    { phaseName = 'Premier croissant'; emoji = '🌒'; }
    else if (angle < 112.5)                   { phaseName = 'Premier quartier'; emoji = '🌓'; }
    else if (angle < 157.5)                   { phaseName = 'Gibbeuse croissante'; emoji = '🌔'; }
    else if (angle < 202.5)                   { phaseName = 'Pleine lune'; emoji = '🌕'; }
    else if (angle < 247.5)                   { phaseName = 'Gibbeuse décroissante'; emoji = '🌖'; }
    else if (angle < 292.5)                   { phaseName = 'Dernier quartier'; emoji = '🌗'; }
    else                                      { phaseName = 'Dernier croissant'; emoji = '🌘'; }
    return { phaseName, emoji, angle, signKey };
  } catch { return { phaseName: 'Lune', emoji: '🌙', angle: 0, signKey: '' }; }
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
function writeLength(n: number) { try { localStorage.setItem(STORAGE_LENGTH, String(n)); } catch {} }

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
  if (day <= 5)         return { key: 'menstruelle',  label: 'Tu as tes règles',     emoji: '🌑' };
  if (day < ov)          return { key: 'folliculaire', label: 'Tu montes en énergie', emoji: '🌒' };
  if (day === ov)        return { key: 'ovulatoire',   label: 'Tu ovules aujourd\'hui', emoji: '🌕' };
  if (day === ov + 1)    return { key: 'ovulatoire',   label: 'Tu es au pic',         emoji: '🌕' };
  return                       { key: 'luteale',     label: 'Tu redescends',        emoji: '🌘' };
}

/**
 * ACTION DU SOIR — 1 phrase concrète, jamais générique, jamais poétique.
 * Comme une amie qui te dit quoi faire ce soir selon ton énergie + la Lune.
 */
function tonightAction(phaseKey: string, moon: MoonInfo, day: number | null): string {
  // Actions concrètes, courtes, en 2e personne
  const moonWaxing = moon.angle > 0 && moon.angle < 180;
  const moonFull = moon.phaseName === 'Pleine lune';
  const moonNew = moon.phaseName === 'Nouvelle lune';

  if (phaseKey === 'menstruelle') {
    if (moonFull) return 'Bain chaud. Lit tôt. Demain sera plus doux.';
    if (moonNew)  return 'Dors. Ton corps répare, laisse-le faire.';
    return 'Pas de sport intense. Marche lente ou canapé, au choix.';
  }
  if (phaseKey === 'folliculaire') {
    if (moonWaxing) return 'Lance le truc que tu repousses. Tu as l\'énergie, saisis-la.';
    return 'Planifie, écris, pose les bases. Demain tu agis.';
  }
  if (phaseKey === 'ovulatoire') {
    if (moonFull) return 'Sors. Vois du monde. Tu rayonnes, on te remarque.';
    return 'Dis ce que tu penses. Aujourd\'hui tu es crédible.';
  }
  // lutéale
  return 'Hydrate-toi, mange chaud, coupe les écrans 1h avant le lit.';
}

/**
 * MOT-CLÉ PAR JOUR — 7 jours à venir, 1 mot ou 1 mini-action par jour.
 * Pour donner la sensation d'avoir une carte, pas juste un point.
 */
function weekForecast(start: string, length: number, today: Date): { label: string; emoji: string; word: string }[] {
  const days: { label: string; emoji: string; word: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const day = dayInCycle(start, length, d);
    const phase = phaseForDay(day, length);
    const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    let word: string;
    if (!phase) word = '—';
    else if (phase.key === 'menstruelle')  word = i === 0 ? 'repos' : 'douceur';
    else if (phase.key === 'folliculaire') word = i === 0 ? 'monte' : 'crée';
    else if (phase.key === 'ovulatoire')   word = i === 0 ? 'brille' : 'agis';
    else if (day !== null && day === length - 1) word = 'PMS';
    else if (day !== null && day === length)     word = 'règles';
    else                                          word = 'ralentis';
    days.push({ label: dayLabel, emoji: phase?.emoji || '·', word });
  }
  return days;
}

function addDays(yyyyMmDd: string, n: number): string {
  try {
    const d = new Date(yyyyMmDd + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return ''; }
}

function formatFr(yyyyMmDd: string): string {
  try { const d = new Date(yyyyMmDd + 'T00:00:00'); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }
  catch { return yyyyMmDd; }
}

export default function DailyCycle({ natalMoon, natalRising }: { natalMoon?: ZodiacSign; natalRising?: ZodiacSign }) {
  const moon = useMemo(() => computeMoonInfo(), []);
  const [start, setStart] = useState<string | null>(() => readStart());
  const [length, setLength] = useState<number>(() => readLength());
  const [today] = useState(() => localISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const day = dayInCycle(start ?? '', length);
  const phase = phaseForDay(day, length);
  const action = phase ? tonightAction(phase.key, moon, day) : '';
  const week = useMemo(() => start ? weekForecast(start, length, new Date()) : [], [start, length]);

  // Cycle expiré (au-delà de length + 2 jours)
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
      <div className="space-y-5">
        <p className="text-night-300 text-sm leading-relaxed px-1">
          Quand tes dernières règles ont-elles commencé ?
        </p>
        <button
          onClick={handleToday}
          className="w-full glass-gold rounded-2xl p-5 border-2 border-gold-500/40 hover:border-gold-400 transition-all group active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="text-3xl group-hover:scale-110 transition-transform">🌙</div>
            <div className="flex-1 text-left">
              <p className="text-night-100 font-semibold text-base">Aujourd'hui</p>
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

  // ─── ÉCRAN 2 : on a une date — 3 blocs uniquement ───
  return (
    <div className="space-y-4">
      {/* Banner expiré — passif */}
      {cycleExpired && (
        <div className="glass rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 animate-fade-in">
          <p className="text-night-100 text-sm font-semibold mb-1">Tes règles arrivent</p>
          <p className="text-night-400 text-xs mb-3">Tu as confirmé un cycle il y a plus de {length} jours. Tu peux actualiser ?</p>
          <div className="flex gap-2">
            <button onClick={handleToday} className="text-xs px-3 py-1.5 rounded-lg bg-gold-500/20 border border-gold-500/40 text-gold-300 hover:bg-gold-500/30 transition-all">Oui, aujourd'hui</button>
            <button onClick={() => setShowDatePicker(true)} className="text-xs px-3 py-1.5 rounded-lg glass border border-night-700 text-night-300 hover:border-gold-500/30 transition-all">Autre date</button>
          </div>
        </div>
      )}

      {/* BLOC 1 — T'en es là (anneau épuré) */}
      <div className="glass rounded-2xl p-5 border border-gold-500/20 bg-gradient-to-br from-gold-500/5 to-cosmic-500/5">
        <CycleRing day={day ?? 0} length={length} phase={phase} />
        <div className="text-center mt-3">
          <p className="text-night-300 text-sm font-medium">
            {phase?.label || '—'} <span className="text-night-500 text-xs">· Jour {day}/{length}</span>
          </p>
        </div>
      </div>

      {/* BLOC 2 — Ce soir (1 action) */}
      {phase && (
        <div className="glass rounded-2xl p-5 border border-gold-500/30">
          <p className="text-night-500 text-[10px] uppercase tracking-[0.25em] mb-2">Ce soir</p>
          <p className="text-night-100 text-base font-medium leading-snug">{action}</p>
        </div>
      )}

      {/* BLOC 3 — Les 7 prochains jours (timeline courte) */}
      <div className="glass rounded-2xl p-5">
        <p className="text-night-500 text-[10px] uppercase tracking-[0.25em] mb-3">Les 7 prochains jours</p>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d, i) => {
            const isToday = i === 0;
            return (
              <div key={i} className={`text-center rounded-xl py-2 ${isToday ? 'bg-gold-500/15 border border-gold-500/30' : ''}`}>
                <p className="text-[9px] uppercase tracking-wider text-night-500">{d.label}</p>
                <p className="text-lg my-1" aria-hidden="true">{d.emoji}</p>
                <p className={`text-[10px] ${isToday ? 'text-gold-300 font-semibold' : 'text-night-400'}`}>{d.word}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer minimal — reset + Lune en 1 ligne */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] text-night-500">
          <span aria-hidden="true">{moon.emoji}</span>
          <span>{moon.phaseName}{moon.signKey ? ` en ${moon.signKey}` : ''}</span>
        </div>
        <button onClick={handleReset} className="text-night-500 hover:text-night-300 text-[10px] transition-colors">
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
 * CycleRing — anneau minimaliste.
 * Pas de labels M/F/O/L (trop technique), juste les couleurs + curseur "tu es ici".
 */
function CycleRing({ day, length, phase }: { day: number; length: number; phase: PhaseInfo | null }) {
  const ovulationDay = Math.round(length / 2);
  const segments: { start: number; end: number; color: string }[] = [
    { start: 1, end: 5, color: '#7c3aed' },
    { start: 6, end: ovulationDay - 1, color: '#a855f7' },
    { start: ovulationDay, end: ovulationDay + 1, color: '#f59e0b' },
    { start: ovulationDay + 2, end: length, color: '#6366f1' },
  ];
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 72;
  const rInner = 56;
  const rDot = 82;

  const angleForDay = (d: number) => -90 + ((d - 1) / length * 360);

  const cursorAngle = angleForDay(day);
  const cursorRad = (cursorAngle * Math.PI) / 180;
  const cursorX = cx + rDot * Math.cos(cursorRad);
  const cursorY = cy + rDot * Math.sin(cursorRad);

  const activeKey = phase?.key;

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="animate-fade-in">
        {/* Track de fond */}
        <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2} fill="none" stroke="rgba(197,160,89,0.12)" strokeWidth={rOuter - rInner} />
        {/* Segments */}
        {segments.map((seg, i) => {
          const a1 = angleForDay(seg.start) - 1;
          const a2 = angleForDay(seg.end) + 1;
          const p1 = polar(cx, cy, rOuter, a1);
          const p2 = polar(cx, cy, rOuter, a2);
          const p3 = polar(cx, cy, rInner, a2);
          const p4 = polar(cx, cy, rInner, a1);
          const largeArc = (a2 - a1) > 180 ? 1 : 0;
          const path = `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
          const isActive = (i === 0 && activeKey === 'menstruelle')
            || (i === 1 && activeKey === 'folliculaire')
            || (i === 2 && activeKey === 'ovulatoire')
            || (i === 3 && activeKey === 'luteale');
          return <path key={i} d={path} fill={seg.color} opacity={isActive ? 0.95 : 0.25} />;
        })}
        {/* Centre — emoji phase + jour */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="26" fill="#F4D27A">{phase?.emoji || '·'}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fill="#cbd5e1" letterSpacing="1">JOUR {day}</text>
        {/* Curseur "tu es ici" — pulsant */}
        <circle cx={cursorX} cy={cursorY} r="5" fill="#F4D27A" stroke="#0a0508" strokeWidth="2">
          <animate attributeName="r" values="5;7;5" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
