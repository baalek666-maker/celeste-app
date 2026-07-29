import { useEffect, useMemo, useState } from 'react';
import { MoonPhase, Libration, MakeTime } from 'astronomy-engine';
import { localISODate } from '../lib/storage';

/**
 * DailyCycle v2 — croisement cycle hormonal × phase lunaire, AUTOMATIQUE.
 *
 * Logique :
 *   - L'utilisatrice saisit UNE seule chose : la date de début de ses dernières règles
 *     (par défaut : "aujourd'hui", 1 tap)
 *   - Tout le reste est calculé :
 *       phase hormonale (menstruelle / folliculaire / ovulatoire / lutéale)
 *       jour dans le cycle (1-35)
 *       prochaines règles estimées
 *       jour d'ovulation estimé
 *   - On croise avec la phase lunaire live (astronomy-engine)
 *   - On propose UN texte contextuel par jour, jamais générique
 *
 * Stockage : localStorage, deux clés :
 *   celeste_cycle_period_start  → 'YYYY-MM-DD' (date début règles)
 *   celeste_cycle_length        → number (durée cycle, défaut 28)
 *
 * Pas de backend, pas d'appel réseau. Hors ligne OK.
 *
 * v1 → v2 refonte :
 *   - AVANT : 4 chips à cliquer (l'utilisatrice devait deviner sa phase) → mauvaise UX
 *   - MAINTENANT : 1 date + auto-calcul de tout le cycle → valeur immédiate
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
    let signKey = '';
    try {
      const lib = Libration(date);
      const mlon = ((lib.mlon % 360) + 360) % 360;
      const signIdx = Math.floor(mlon / 30);
      const SIGNS = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];
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

/** Calcule le jour dans le cycle à partir de la date de début et de la longueur. */
function dayInCycle(start: string, length: number, refDate: Date = new Date()): number | null {
  try {
    const startDate = new Date(start + 'T00:00:00');
    if (isNaN(startDate.getTime())) return null;
    const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const diffDays = Math.floor((ref.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 0; // futur
    const cyclePos = ((diffDays % length) + length) % length;
    return cyclePos + 1; // 1-indexé
  } catch {
    return null;
  }
}

function phaseForDay(day: number | null, length: number): { key: string; label: string; emoji: string; desc: string } | null {
  if (day === null) return null;
  // Menstruelle : jours 1 à ~5 (durée moyenne des règles)
  // Folliculaire : jusqu'à l'ovulation
  // Ovulatoire : autour du jour length/2 (14 pour 28j)
  // Lutéale : le reste
  const ovulationDay = Math.round(length / 2);
  if (day <= 5)                       return { key: 'menstruelle',  label: 'Menstruelle',  emoji: '🌑', desc: 'Repos, lenteur, écoute' };
  if (day < ovulationDay - 1)         return { key: 'folliculaire', label: 'Folliculaire', emoji: '🌒', desc: 'Énergie qui monte, projets' };
  if (day <= ovulationDay + 1)        return { key: 'ovulatoire',   label: 'Ovulatoire',   emoji: '🌕', desc: 'Pic d\'énergie, magnétisme' };
  return                                     { key: 'luteale',      label: 'Lutéale',      emoji: '🌘', desc: 'Recentrage, lucidité' };
}

/** Texte contextuel selon la phase hormonale × la phase lunaire. */
function crossoverText(phaseKey: string, moon: MoonInfo, day: number | null): string {
  const moonFull = moon.phaseName === 'Pleine lune';
  const moonNew = moon.phaseName === 'Nouvelle lune';
  const moonWaxing = moon.angle > 0 && moon.angle < 180;
  const moonWaning = moon.angle >= 180;

  if (phaseKey === 'menstruelle') {
    if (moonNew) return 'Nouvelle lune + règles : double page blanche. Ton corps te dit arrête. Écoute-le.';
    if (moonFull) return 'Pleine lune + règles : ce que tu ressens est amplifié — donne-toi de la place.';
    return 'Phase de repos. Ce que la Lune fait au ciel, ton corps le fait en toi. Pas de forcing.';
  }
  if (phaseKey === 'folliculaire') {
    if (moonWaxing) return `Énergie montante, Lune croissante. Jour ${day} — tu redémarres. Lance ce que tu repousses.`;
    return `Énergie qui monte. Jour ${day} — plante les graines avant que la lumière redescende.`;
  }
  if (phaseKey === 'ovulatoire') {
    if (moonFull) return 'Pic hormonal + Pleine lune : ta lumière est à son maximum. Brille, mais garde pour après.';
    return `Jour ${day}, ovulation. Ton magnétisme est haut. C\'est le moment de dire oui — ou de te reposer vraiment.`;
  }
  // lutéale
  if (moonWaning) return `Lutéale + Lune décroissante. Jour ${day} — tu as besoin de moins, et c\'est très bien.`;
  return `Lutéale, Lune montante. Jour ${day} — ce qui te travaille demande à sortir. Écris-le plutôt que le garder.`;
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

export default function DailyCycle() {
  const moon = useMemo(() => computeMoonInfo(), []);
  const [start, setStart] = useState<string | null>(() => readStart());
  const [length, setLength] = useState<number>(() => readLength());
  const [today] = useState(() => localISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const day = dayInCycle(start ?? '', length);
  const phase = phaseForDay(day, length);

  // Auto-masquer le date input si on annule
  useEffect(() => {
    if (showDatePicker && start) {
      // Si on a déjà une date et qu'on rouvre, l'input s'affiche avec cette valeur
    }
  }, [showDatePicker, start]);

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

        {/* CTA principal : aujourd'hui */}
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

        {/* Lien discret : autre date */}
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

  // ─── CAS 2 : on a une date → calcul auto de tout ─────────────────
  const nextPeriod = addDays(start, length);
  const ovulationDay = addDays(start, Math.round(length / 2) - 1);
  const progressPct = day === null ? 0 : Math.round((day / length) * 100);

  return (
    <div className="space-y-4">
      {/* ── Header + reset */}
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

      {/* ── Carte phase du jour — LE hero */}
      {phase && (
        <div className="glass rounded-2xl p-5 border border-gold-500/30 bg-gradient-to-br from-gold-500/5 to-cosmic-500/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-night-400 text-xs uppercase tracking-wider">Tu en es ici</p>
            <p className="text-night-500 text-[10px]">Jour {day} / {length}</p>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-5xl" aria-hidden="true">{phase.emoji}</div>
            <div className="flex-1">
              <p className="text-night-100 font-bold text-lg">{phase.label}</p>
              <p className="text-night-400 text-xs mt-0.5">{phase.desc}</p>
            </div>
          </div>
          {/* Barre de progression du cycle */}
          <div className="w-full h-1.5 rounded-full bg-night-800/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cosmic-500 via-cosmic-400 to-gold-400 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(251,191,36,0.4)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Carte Lune du jour */}
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

      {/* ── Croisement — LE texte à valeur ajoutée */}
      {phase && (
        <div className="glass rounded-2xl p-5 border border-gold-500/20 animate-fade-in">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Ce que ça dit aujourd'hui</p>
          <p className="text-night-100 text-sm leading-relaxed italic">
            {crossoverText(phase.key, moon, day)}
          </p>
        </div>
      )}

      {/* ── Timeline : règles passées / ovulation / prochaines règles */}
      <div className="glass rounded-2xl p-5">
        <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Calendrier de ton cycle</p>
        <div className="space-y-2.5">
          <TimelineRow
            label="Dernières règles"
            date={start}
            emoji="🌑"
            state="done"
          />
          <TimelineRow
            label="Ovulation estimée"
            date={ovulationDay}
            emoji="🌕"
            state={day !== null && day >= Math.round(length / 2) - 1 ? 'done' : 'upcoming'}
          />
          <TimelineRow
            label="Prochaines règles"
            date={nextPeriod}
            emoji="🌑"
            state="upcoming"
          />
        </div>
      </div>

      {/* ── Ajustement durée du cycle */}
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
