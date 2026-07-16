import { AstroTime, Body, GeoVector, Rotation_EQJ_ECL, RotateVector } from 'astronomy-engine';

/**
 * dailyTransit.ts — détermine la planète dominante du jour pour la home (v8 audit).
 *
 * Calcul basé sur de vraies éphémérides (astronomy-engine) :
 * 1. Longitude géocentrique de Mercure, Vénus, Mars, Jupiter, Saturne à midi UTC
 * 2. Variation sur 24h (degré/jour)
 * 3. Planète avec le plus grand mouvement = dominante du jour (Mercure est champion)
 *
 * En cas de tie ou d'erreur, fallback sur dayOfYear % 5 (rotation stable).
 *
 * Note : on évite le bundle complet `astrology.ts` (~500KB) pour ne charger
 * que les fonctions utilisées ici (~80KB subset).
 */

type Transit = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
export type TransitKey = Transit;

const BODIES: Record<Transit, Body> = {
  mercury: Body.Mercury,
  venus:   Body.Venus,
  mars:    Body.Mars,
  jupiter: Body.Jupiter,
  saturn:  Body.Saturn,
};

function eclipticLon(body: Body, time: AstroTime): number {
  const gv = GeoVector(body, time, true);
  const rot = Rotation_EQJ_ECL();
  const ev = RotateVector(rot, gv);
  const lon = Math.atan2(ev.y, ev.x) * (180 / Math.PI);
  return ((lon % 360) + 360) % 360;
}

function signedDelta(a: number, b: number): number {
  let d = b - a;
  if (d >  180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

const TRANSITS: Transit[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];

/**
 * Mémoire cache (par jour calendaire UTC) — la home est consultée plusieurs fois
 * par jour, on évite de recalculer les éphémérides à chaque render.
 */
let cache: { dayKey: string; transit: Transit } | null = null;

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * Retourne la planète dominante du jour (celle qui bouge le plus vite).
 */
export function getDailyDominantTransit(now: Date = new Date()): Transit {
  const key = dayKey(now);
  if (cache?.dayKey === key) return cache.transit;

  // Midi UTC du jour + midi UTC du lendemain
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const tomorrow = new Date(today.getTime() + 86400000);
  const t1 = new AstroTime(today);
  const t2 = new AstroTime(tomorrow);

  try {
    let best: Transit = TRANSITS[(Math.floor(now.getTime() / 86400000)) % TRANSITS.length];
    let bestSpeed = -Infinity;

    for (const t of TRANSITS) {
      const lon1 = eclipticLon(BODIES[t], t1);
      const lon2 = eclipticLon(BODIES[t], t2);
      const speed = Math.abs(signedDelta(lon1, lon2));
      if (speed > bestSpeed) {
        bestSpeed = speed;
        best = t;
      }
    }

    cache = { dayKey: key, transit: best };
    return best;
  } catch {
    // Fallback rotation stable
    const fb = TRANSITS[(Math.floor(now.getTime() / 86400000)) % TRANSITS.length];
    cache = { dayKey: key, transit: fb };
    return fb;
  }
}

export const TRANSIT_INFO: Record<Transit, { label: string; glyph: string; dailyHook: string }> = {
  mercury: { label: 'Mercure',  glyph: '☿', dailyHook: 'Paroles, idées, mouvements — tout circule vite.' },
  venus:   { label: 'Vénus',    glyph: '♀', dailyHook: 'Ton cœur cherche une douceur, même minuscule.' },
  mars:    { label: 'Mars',     glyph: '♂', dailyHook: 'Une étincelle veut sortir — laisse-la.' },
  jupiter: { label: 'Jupiter',  glyph: '♃', dailyHook: 'Une porte s\'entrouvre. Tu peux viser plus large.' },
  saturn:  { label: 'Saturne',  glyph: '♄', dailyHook: 'Pose un geste concret, même petit. Le ciel ancre.' },
};