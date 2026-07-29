import { useEffect, useMemo, useState } from 'react';
import { MoonPhase, Libration, MakeTime } from 'astronomy-engine';
import { localISODate } from '../lib/storage';
import type { ZodiacSign } from '../types';

/**
 * DailyCycle v3 — croisement cycle hormonal × phase lunaire × thème natal.
 *
 * v3 changes (vs v2) :
 *   - Anneau SVG du cycle : 4 segments (menstruelle / folliculaire / ovulatoire / lutéale)
 *     avec curseur "tu es ici" qui pointe sur le jour actuel. Donne une image mentale
 *     immédiate de là où on en est dans le cycle.
 *   - Croisement Lune natale × phase hormonale : insight "creepy accurate" quand
 *     la Lune du jour touche la Lune natale pendant l'ovulation, etc.
 *   - Détection cycle "expiré" : si on est au-delà de J+cycle_length, banner
 *     passif pour actualiser la date. Pas de notif, juste visuel.
 *
 * Logique inchangée : 1 date de dernières règles → tout est calculé.
 */

const STORAGE_START = 'celeste_cycle_period_start';
const STORAGE_LENGTH = 'celeste_cycle_length';
const DEFAULT_CYCLE_LENGTH = 28;
const MIN_CYCLE_LENGTH = 21;
const MAX_CYCLE_LENGTH = 35;

interface MoonInfo {
  phaseName: string;
  emoji: string;
  angle: number;
  signKey: string;
}

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
    let phaseName: string;
    let emoji: string;
    if (angle < 22.5 || angle >= 337.5)      { phaseName = 'Nouvelle lune'; emoji = '🌑'; }
    else if (angle < 67.5)                    { phaseName = 'Premier croissant'; emoji = '🌒'; }
    else if (angle < 112.5)                   { phaseName = 'Premier quartier'; emoji = '🌓'; }
    else if (angle < 157.5)                   { phaseName = 'Gibbeuse croissante'; emoji = '🌔'; }
    else if (angle < 202.5)                   { phaseName = 'Pleine lune'; emoji = '🌕'; }
    else if (angle < 247.5)                   { phaseName = 'Gibbeuse décroissante'; emoji = '🌖'; }
    else if (angle < 292.5)                   { phaseName = 'Dernier quartier'; emoji = '🌗'; }
    else                                      { phaseName = 'Dernier croissant'; emoji = '🌘'; }
    return { phaseName, emoji, angle, signKey };
  } catch {
    return { phaseName: 'Lune', emoji: '🌙', angle: 0, signKey: '' };
  }
}

function readStart(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_START);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch { /* ignore */ }
  return null;
}
function writeStart(d: string) {
  try { localStorage.setItem(STORAGE_START, d); } catch { /* private mode */ }
}
function clearStart() {
  try { localStorage.removeItem(STORAGE_START); } catch { /* ignore */ }
}
function readLength(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_LENGTH));
    if (Number.isFinite(v) && v >= MIN_CYCLE_LENGTH && v <= MAX_CYCLE_LENGTH) return v;
  } catch { /* ignore */ }
  return DEFAULT_CYCLE_LENGTH;
}
function writeLength(n: number) {
  try { localStorage.setItem(STORAGE_LENGTH, String(n)); } catch { /* ignore */ }
}

function dayInCycle(start: string, length: number, refDate: Date = new Date()): number | null {
  try {
    const startDate = new Date(start + 'T00:00:00');
    if (isNaN(startDate.getTime())) return null;
    const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const diffDays = Math.floor((ref.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 0;
    const cyclePos = ((diffDays % length) + length) % length;
    return cyclePos + 1;
  } catch {
    return null;
  }
}

interface PhaseInfo {
  key: string;
  label: string;
  emoji: string;
  desc: string;
  color: string; // CSS hex pour l'anneau
}

function phaseForDay(day: number | null, length: number): PhaseInfo | null {
  if (day === null) return null;
  const ovulationDay = Math.round(length / 2);
  if (day <= 5)                 return { key: 'menstruelle',  label: 'Menstruelle',  emoji: '🌑', desc: 'Repos, lenteur, écoute',                  color: '#7c3aed' };
  if (day < ovulationDay)        return { key: 'folliculaire', label: 'Folliculaire', emoji: '🌒', desc: 'Énergie qui monte, projets',               color: '#a855f7' };
  if (day === ovulationDay)      return { key: 'ovulatoire',   label: 'Ovulatoire',   emoji: '🌕', desc: 'Pic d\'énergie, magnétisme',              color: '#f59e0b' };
  if (day === ovulationDay + 1)  return { key: 'ovulatoire',   label: 'Ovulatoire',   emoji: '🌕', desc: 'Pic d\'énergie, magnétisme',              color: '#f59e0b' };
  return                                { key: 'luteale',     label: 'Lutéale',      emoji: '🌘', desc: 'Recentrage, lucidité',                   color: '#6366f1' };
}

function crossoverText(phaseKey: string, moon: MoonInfo, day: number | null): string {
  const moonFull = moon.phaseName === 'Pleine lune';
  const moonNew = moon.phaseName === 'Nouvelle lune';
  const moonWaxing = moon.angle > 0 && moon.angle < 180;
  const moonWaning = moon.angle >= 180;
  if (phaseKey === 'menstruelle') {
    if (moonNew) return 'Nouvelle lune + règles : double page blanche. Ton corps te dit arrête. Écoute-le.';
    if (moonFull) return 'Pleine lune + règles : ce que tu ressens est amplifié — donne-toi de la place.';
    return 'Phase de repos. La Lune fait au ciel ce que ton corps fait en toi. Pas de forcing.';
  }
  if (phaseKey === 'folliculaire') {
    if (moonWaxing) return `Énergie montante, Lune croissante. Jour ${day} — tu redémarres. Lance ce que tu repousses.`;
    return `Énergie qui monte. Jour ${day} — plante les graines avant que la lumière redescende.`;
  }
  if (phaseKey === 'ovulatoire') {
    if (moonFull) return 'Pic hormonal + Pleine lune : ta lumière est à son maximum. Brille, mais garde pour après.';
    return `Jour ${day}, ovulation. Ton magnétisme est haut. C'est le moment de dire oui — ou de te reposer vraiment.`;
  }
  if (moonWaning) return `Lutéale + Lune décroissante. Jour ${day} — tu as besoin de moins, et c'est très bien.`;
  return `Lutéale, Lune montante. Jour ${day} — ce qui te travaille demande à sortir. Écris-le plutôt que le garder.`;
}

/** Insight natal : on regarde si la Lune du jour touche la Lune natale ou l'Ascendant. */
function natalInsight(moon: MoonInfo, natalMoon?: ZodiacSign, natalRising?: ZodiacSign): string | null {
  if (!moon.signKey) return null;
  if (moon.signKey === natalMoon) {
    return `La Lune revient sur ta Lune natale en ${moon.signKey}. Ce que tu ressens aujourd'hui a une racine profonde — fais-toi confiance.`;
  }
  if (moon.signKey === natalRising) {
    return `La Lune touche ton Ascendant ${moon.signKey}. Tu rayonnes différemment aujourd'hui. Les autres le voient.`;
  }
  return null;
}

function addDays(yyyyMmDd: string, n: number): string {
  try {
    const d = new Date(yyyyMmDd + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return ''; }
}

function formatFr(yyyyMmDd: string): string {
  try {
    const d = new Date(yyyyMmDd + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch { return yyyyMmDd; }
}

export default function DailyCycle({ natalMoon, natalRising }: { natalMoon?: ZodiacSign; natalRising?: ZodiacSign }) {
  const moon = useMemo(() => computeMoonInfo(), []);
  const [start, setStart] = useState<string | null>(() => readStart());
  const [length, setLength] = useState<number>(() => readLength());
  const [today] = useState(() => localISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const day = dayInCycle(start ?? '', length);
  const phase = phaseForDay(day, length);

  // Détection cycle "expiré" : si on est au-delà de J+length sans avoir actualisé
  const cycleExpired = useMemo(() => {
    if (!start) return false;
    try {
      const startDate = new Date(start + 'T00:00:00');
      const ref = new Date();
      ref.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((ref.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      // Si on a dépassé length + 2 jours de marge, c'est expiré
      return diffDays > length + 2;
    } catch { return false; }
  }, [start, length]);

  const handleToday = () => {
    const t = localISODate();
    writeStart(t);
    setStart(t);
    setShowDatePicker(false);
  };

  const handleCustomDate = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    writeStart(v);
    setStart(v);
    setShowDatePicker(false);
  };

  const handleReset = () => {
    clearStart();
    setStart(null);
    setShowDatePicker(false);
  };

  const handleLengthChange = (n: number) => {
    const clamped = Math.max(MIN_CYCLE_LENGTH, Math.min(MAX_CYCLE_LENGTH, Math.round(n)));
    writeLength(clamped);
    setLength(clamped);
  };

  const insight = natalInsight(moon, natalMoon, natalRising);

  // ─── CAS 1 : pas encore de date ─────────────────────────────────
  if (!start) {
    return (
      <div className="space-y-5">
        <div className="glass rounded-2xl p-5 border border-gold-500/15">
          <p className="text-night-500 text-[10px] uppercase tracking-[0.25em] mb-1">Module</p>
          <h2 className="text-xl font-bold text-gold-gradient mb-1">Cycle &amp; Lune</h2>
          <p className="text-night-300 text-sm leading-relaxed">
            Donne-moi UNE date — le premier jour de tes dernières règles. Je calcule le reste : phase du jour, prochaines règles, croisement avec la Lune.
          </p>
        </div>

        <button
          onClick={handleToday}
          className="w-full glass-gold rounded-2xl p-5 border-2 border-gold-500/40 hover:border-gold-400 transition-all group active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="text-3xl group-hover:scale-110 transition-transform">🌙</div>
            <div className="flex-1 text-left">
              <p className="text-night-100 font-semibold text-base">Mes règles ont commencé aujourd'hui</p>
              <p className="text-night-400 text-xs mt-0.5">Un tap — je calcule tout à partir d'ici</p>
            </div>
            <span className="text-gold-400 text-xl">→</span>
          </div>
        </button>

        {!showDatePicker ? (
          <button
            onClick={() => setShowDatePicker(true)}
            className="block mx-auto text-night-400 hover:text-gold-400 text-sm transition-colors"
          >
            ou choisir un autre jour
          </button>
        ) : (
          <div className="glass rounded-2xl p-4 animate-fade-in">
            <label className="text-night-400 text-xs uppercase tracking-wider block mb-2">
              Premier jour de tes dernières règles
            </label>
            <input
              type="date"
              max={today}
              autoFocus
              onChange={(e) => handleCustomDate(e.target.value)}
              className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 focus:outline-none focus:border-gold-500/50 transition-colors"
            />
            <button
              onClick={() => setShowDatePicker(false)}
              className="mt-3 text-night-500 hover:text-night-300 text-xs transition-colors"
            >
              Annuler
            </button>
          </div>
        )}

        <p className="text-night-700 text-[10px] text-center italic px-4">
          Une seule date. Pas de suivi quotidien, pas de notification. Tu changes quand tu veux.
        </p>
      </div>
    );
  }

  // ─── CAS 2 : on a une date ─────────────────────────────────────
  const nextPeriod = addDays(start, length);
  const ovulationDay = addDays(start, Math.round(length / 2) - 1);
  const progressPct = day === null ? 0 : Math.round((day / length) * 100);

  return (
    <div className="space-y-4">
      {/* Banner "cycle expiré" — discret */}
      {cycleExpired && (
        <div className="glass rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-lg">⏰</span>
            <div className="flex-1">
              <p className="text-night-100 text-sm font-semibold">Tes prochaines règles arrivent</p>
              <p className="text-night-400 text-xs mt-1 leading-relaxed">
                Ton dernier cycle data de plus de {length} jours. Tu peux confirmer que tes règles ont commencé ?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleToday}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gold-500/20 border border-gold-500/40 text-gold-300 hover:bg-gold-500/30 transition-all"
                >
                  Oui, aujourd'hui
                </button>
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="text-xs px-3 py-1.5 rounded-lg glass border border-night-700 text-night-300 hover:border-gold-500/30 transition-all"
                >
                  Autre date
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="glass rounded-2xl p-5 border border-gold-500/15">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-night-500 text-[10px] uppercase tracking-[0.25em] mb-1">Module</p>
            <h2 className="text-xl font-bold text-gold-gradient">Cycle &amp; Lune</h2>
          </div>
          <button
            onClick={handleReset}
            className="text-night-500 hover:text-night-300 text-[10px] transition-colors"
            aria-label="Réinitialiser"
          >
            Réinitialiser
          </button>
        </div>
        <p className="text-night-400 text-xs mt-1">
          Calculé depuis le <span className="text-night-300">{formatFr(start)}</span> · cycle de {length} jours
        </p>
      </div>

      {/* ── ANNEAU DU CYCLE — la nouvelle pièce maîtresse */}
      <div className="glass rounded-2xl p-5 border border-gold-500/20 bg-gradient-to-br from-gold-500/5 to-cosmic-500/5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-night-400 text-xs uppercase tracking-wider">Tu en es ici</p>
          <p className="text-night-500 text-[10px]">Jour {day} / {length}</p>
        </div>
        <CycleRing day={day ?? 0} length={length} phase={phase} />
      </div>

      {/* Phase actuelle + desc */}
      {phase && (
        <div className="glass rounded-2xl p-5 border border-night-700/40">
          <div className="flex items-center gap-4">
            <div className="text-4xl" aria-hidden="true">{phase.emoji}</div>
            <div className="flex-1">
              <p className="text-night-100 font-bold text-base">{phase.label}</p>
              <p className="text-night-400 text-xs mt-0.5">{phase.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* Carte Lune */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-night-400 text-xs uppercase tracking-wider">Ciel du jour</p>
          <p className="text-night-600 text-[10px]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-3xl animate-float-slow" aria-hidden="true">{moon.emoji}</div>
          <div className="flex-1">
            <p className="text-night-100 font-semibold text-sm">{moon.phaseName}</p>
            {moon.signKey && <p className="text-night-400 text-xs">Lune en {moon.signKey}</p>}
          </div>
        </div>
      </div>

      {/* Croisement phase × Lune */}
      {phase && (
        <div className="glass rounded-2xl p-5 border border-gold-500/20 animate-fade-in">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Ce que ça dit aujourd'hui</p>
          <p className="text-night-100 text-sm leading-relaxed italic">
            {crossoverText(phase.key, moon, day)}
          </p>
        </div>
      )}

      {/* Insight natal — différenciateur */}
      {insight && (
        <div className="glass rounded-2xl p-5 border border-cosmic-500/30 bg-cosmic-500/5 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-cosmic-300 text-base">✦</span>
            <p className="text-cosmic-300 text-xs uppercase tracking-wider">Ton ciel te reconnaît</p>
          </div>
          <p className="text-night-100 text-sm leading-relaxed">{insight}</p>
        </div>
      )}

      {/* Timeline */}
      <div className="glass rounded-2xl p-5">
        <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Calendrier de ton cycle</p>
        <div className="space-y-2.5">
          <TimelineRow label="Dernières règles"   date={start}       emoji="🌑" state="done" />
          <TimelineRow
            label="Ovulation estimée"
            date={ovulationDay}
            emoji="🌕"
            state={day !== null && day >= Math.round(length / 2) - 1 ? 'done' : 'upcoming'}
          />
          <TimelineRow label="Prochaines règles"   date={nextPeriod}  emoji="🌑" state="upcoming" />
        </div>
      </div>

      {/* Durée cycle */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-night-400 text-xs">Durée habituelle de ton cycle</p>
          <p className="text-night-100 font-semibold text-sm">{length} jours</p>
        </div>
        <div className="flex gap-1.5">
          {[26, 28, 30, 32].map((n) => (
            <button
              key={n}
              onClick={() => handleLengthChange(n)}
              className={`flex-1 py-2 rounded-lg text-xs transition-all ${
                length === n
                  ? 'bg-gold-500/20 border border-gold-500/50 text-gold-300'
                  : 'glass border border-night-700/50 text-night-400 hover:border-gold-500/30'
              }`}
            >
              {n}j
            </button>
          ))}
        </div>
        <p className="text-night-600 text-[10px] mt-2 italic">
          Ajuste si tu connais ta durée moyenne. La moyenne est 28 jours.
        </p>
      </div>

      <p className="text-night-700 text-[10px] text-center italic px-4">
        Suivi personnel, pas un outil médical. Les phases sont indicatives.
      </p>
    </div>
  );
}

/**
 * CycleRing — anneau SVG 4 segments (les 4 phases du cycle) + curseur "tu es ici".
 * Pas de dépendance externe (Tailwind only + 1 SVG inline).
 */
function CycleRing({ day, length, phase }: { day: number; length: number; phase: PhaseInfo | null }) {
  // Cercle trigonométrique : on commence en haut (12h) et on tourne horaire.
  // 4 segments : menstruelle (jours 1-5), folliculaire, ovulatoire, lutéale.
  const ovulationDay = Math.round(length / 2);
  const segments: { label: string; start: number; end: number; color: string }[] = [
    { label: 'M', start: 1,           end: 5,                    color: '#7c3aed' }, // menstruelle
    { label: 'F', start: 6,           end: ovulationDay - 1,     color: '#a855f7' }, // folliculaire (jusqu'à J13 sur 28j)
    { label: 'O', start: ovulationDay,     end: ovulationDay + 1, color: '#f59e0b' }, // ovulatoire (J14-15)
    { label: 'L', start: ovulationDay + 2, end: length,          color: '#6366f1' }, // lutéale
  ];
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 80;
  const rInner = 60;
  const rDot = 90;

  // Conversion jour → angle (0° = haut, sens horaire)
  const angleForDay = (d: number) => {
    const pct = ((d - 1) / length);
    // -90° = haut, sens horaire = + dans le sens trigonométrique inverse
    return -90 + (pct * 360);
  };

  // Curseur "tu es ici"
  const cursorAngle = angleForDay(day);
  const cursorRad = (cursorAngle * Math.PI) / 180;
  const cursorX = cx + rDot * Math.cos(cursorRad);
  const cursorY = cy + rDot * Math.sin(cursorRad);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="animate-fade-in">
        {/* Track de fond */}
        <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2} fill="none"
                stroke="rgba(197,160,89,0.15)" strokeWidth={rOuter - rInner} />

        {/* Segments */}
        {segments.map((seg) => {
          if (seg.start > seg.end) return null;
          const a1 = angleForDay(seg.start) - 0.5;
          const a2 = angleForDay(seg.end) + 0.5;
          const p1 = polar(cx, cy, rOuter, a1);
          const p2 = polar(cx, cy, rOuter, a2);
          const p3 = polar(cx, cy, rInner, a2);
          const p4 = polar(cx, cy, rInner, a1);
          const largeArc = (a2 - a1) > 180 ? 1 : 0;
          const path = `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
          return (
            <path
              key={seg.label}
              d={path}
              fill={seg.color}
              opacity={phase && seg.label === (phase.key === 'menstruelle' ? 'M' : phase.key === 'folliculaire' ? 'F' : phase.key === 'ovulatoire' ? 'O' : 'L') ? 0.95 : 0.35}
            />
          );
        })}

        {/* Labels des 4 segments (extérieurs) */}
        {segments.map((seg) => {
          const midDay = (seg.start + seg.end) / 2;
          const a = angleForDay(midDay);
          const rad = (a * Math.PI) / 180;
          const x = cx + (rOuter + 12) * Math.cos(rad);
          const y = cy + (rOuter + 12) * Math.sin(rad);
          return (
            <text
              key={`lbl-${seg.label}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fill={seg.color}
              opacity={0.85}
              style={{ fontWeight: 600 }}
            >
              {seg.label}
            </text>
          );
        })}

        {/* Centre — phase label */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          fontSize="22"
          fill="#F4D27A"
          style={{ fontWeight: 700 }}
        >
          {phase ? phase.emoji : '·'}
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          fontSize="10"
          fill="#cbd5e1"
          style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
        >
          Jour {day}
        </text>

        {/* Curseur "tu es ici" */}
        <circle
          cx={cursorX}
          cy={cursorY}
          r="5"
          fill="#F4D27A"
          stroke="#0a0508"
          strokeWidth="2"
        >
          <animate
            attributeName="r"
            values="5;7;5"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function TimelineRow({ label, date, emoji, state }: { label: string; date: string; emoji: string; state: 'done' | 'upcoming' }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`text-lg ${state === 'upcoming' ? 'opacity-50' : ''}`}>{emoji}</div>
      <div className="flex-1">
        <p className={`text-sm ${state === 'done' ? 'text-night-200' : 'text-night-500'}`}>{label}</p>
      </div>
      <p className={`text-xs ${state === 'done' ? 'text-night-300' : 'text-night-500'}`}>
        {date ? formatFr(date) : '—'}
      </p>
    </div>
  );
}