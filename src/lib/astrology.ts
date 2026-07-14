import {
  AstroTime,
  Body,
  GeoVector,
  SiderealTime,
  EclipticGeoMoon,
  Rotation_EQJ_ECL,
  RotateVector,
} from 'astronomy-engine';
import type { BirthData, NatalChart, ZodiacSign, PlanetPosition, Planet, House } from '../types';
import { ZODIAC_ORDER, ZODIAC_SIGNS, signFromDegree, degreeInSign } from '../data/zodiac';

/**
 * CELESTE ASTROLOGY ENGINE v2
 *
 * Uses astronomy-engine — a NASA-grade astronomical calculation library
 * based on VSOP87/ELP2000 planetary theory. Accuracy: ±0.3° for all planets.
 *
 * This replaces the broken v1 manual Keplerian approximation that had a systematic
 * 180° error on the Sun and no retrograde detection for outer planets.
 */

const PLANET_BODIES: Record<string, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

/**
 * Get geocentric ecliptic longitude (tropical) of a body using astronomy-engine.
 * For the Moon, uses the dedicated EclipticGeoMoon function for maximum precision.
 * For other bodies, uses GeoVector + proper EQJ→ECL rotation matrix.
 */
function geoEclipticLongitude(planet: string, time: AstroTime): number {
  if (planet === 'moon') {
    const ecl = EclipticGeoMoon(time);
    return ((ecl.lon % 360) + 360) % 360;
  }

  const body = PLANET_BODIES[planet];
  if (!body) return 0;

  const gv = GeoVector(body, time, true);
  const rot = Rotation_EQJ_ECL();
  const ev = RotateVector(rot, gv);
  let lon = Math.atan2(ev.y, ev.x) * (180 / Math.PI);
  return ((lon % 360) + 360) % 360;
}

/**
 * Detect if a planet is retrograde by comparing its longitude now vs +1 day.
 */
function isRetrograde(planet: string, time: AstroTime): boolean {
  if (planet === 'sun' || planet === 'moon') return false;

  const lon1 = geoEclipticLongitude(planet, time);
  const tomorrow = new AstroTime(time.tt + 1.0);
  const lon2 = geoEclipticLongitude(planet, tomorrow);

  let diff = lon2 - lon1;
  diff = ((diff + 180) % 360 + 360) % 360 - 180;
  return diff < 0;
}

/**
 * Calculate exact ascendant degree from birth time and location.
 * Uses the precise SiderealTime function from astronomy-engine.
 */
function ascendantDegree(time: AstroTime, latitude: number, longitude: number): number {
  const gst = SiderealTime(time); // returns hours (0-24), NOT degrees!
  const gstDeg = gst * 15; // convert hours → degrees (1h = 15°)
  const lst = ((gstDeg + longitude) % 360 + 360) % 360;

  const eps = 23.4393 * (Math.PI / 180);
  const latRad = latitude * (Math.PI / 180);
  const lstRad = lst * (Math.PI / 180);

  let asc = Math.atan2(
    -Math.cos(lstRad),
    Math.sin(lstRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps),
  ) * (180 / Math.PI);
  asc = ((asc + 180) % 360 + 360) % 360; // +180°: formula gives descendant, flip to ascendant
  return asc;
}

/**
 * Calculate 12 houses using Equal House system.
 * House 1 cusp = Ascendant degree. Each subsequent house = +30°.
 */
function calculateHouses(ascDeg: number): { cusp: number; sign: ZodiacSign }[] {
  const houses: { cusp: number; sign: ZodiacSign }[] = [];
  for (let i = 0; i < 12; i++) {
    const cuspDeg = (ascDeg + i * 30) % 360;
    houses.push({ cusp: cuspDeg, sign: signFromDegree(cuspDeg) });
  }
  return houses;
}

/**
 * Determine which house a planet falls in based on its absolute longitude
 * and the ascendant degree (Equal House system).
 */
function houseFromLongitude(longitude: number, ascDeg: number): House {
  let relativeDeg = longitude - ascDeg;
  if (relativeDeg < 0) relativeDeg += 360;
  return (Math.floor(relativeDeg / 30) + 1) as House;
}

/**
 * Calculate current transit positions (for daily horoscope).
 * Returns the geocentric ecliptic longitude of all planets at the given time.
 */
export function calculateTransits(date: Date): Record<Planet, { longitude: number; sign: ZodiacSign; retrograde: boolean }> {
  const time = new AstroTime(date);
  const planets: Planet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

  const result = {} as Record<Planet, { longitude: number; sign: ZodiacSign; retrograde: boolean }>;
  for (const p of planets) {
    const lon = geoEclipticLongitude(p, time);
    result[p] = {
      longitude: lon,
      sign: signFromDegree(lon),
      retrograde: isRetrograde(p, time),
    };
  }
  return result;
}

/**
 * MAIN: Calculate full natal chart from birth data.
 */
export function calculateNatalChart(birth: BirthData): NatalChart {
  // Construire la date directement en UTC pour éviter la double correction timezone.
  // birth.date = "YYYY-MM-DD", birth.time = "HH:MM"
  const [yStr, mStr, dStr] = birth.date.split('-');
  const [hhStr, mmStr] = birth.time.split(':');
  const y = Number(yStr), m = Number(mStr), d = Number(dStr);
  const hh = Number(hhStr), mm = Number(mmStr);
  // Date UTC représentant l'heure locale de naissance, puis on retire l'offset timezone
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0) - birth.timezone * 3600000;
  const utcDate = new Date(utcMs);
  const time = new AstroTime(utcDate);

  const planets: Planet[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

  const positions: PlanetPosition[] = planets.map((planet) => {
    const longitude = geoEclipticLongitude(planet, time);
    return {
      planet,
      sign: signFromDegree(longitude),
      degree: degreeInSign(longitude),
      house: 1 as House,
      retrograde: isRetrograde(planet, time),
      longitude,
    } as PlanetPosition;
  });

  const ascDeg = ascendantDegree(time, birth.latitude, birth.longitude);
  const rising = signFromDegree(ascDeg);

  positions.forEach((pos) => {
    pos.house = houseFromLongitude(pos.longitude!, ascDeg);
  });

  const houses = calculateHouses(ascDeg);

  const elements = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalities = { cardinal: 0, fixed: 0, mutable: 0 };

  positions.forEach((pos) => {
    const signData = ZODIAC_SIGNS[pos.sign];
    elements[signData.element]++;
    modalities[signData.modality]++;
  });

  const sunSign = positions.find((p) => p.planet === 'sun')!.sign;
  const moonSign = positions.find((p) => p.planet === 'moon')!.sign;

  return {
    sun: sunSign,
    moon: moonSign,
    rising,
    positions,
    houses,
    elements,
    modalities,
  };
}

/**
 * Get element balance description
 */
export function elementDescription(elements: {
  fire: number;
  earth: number;
  air: number;
  water: number;
}): string {
  const max = Math.max(elements.fire, elements.earth, elements.air, elements.water);
  if (elements.fire === max)
    return 'Une énergie passionnée et créatrice. Vous êtes moteur, vous initiez et inspirez.';
  if (elements.earth === max)
    return 'Une nature pragmatique et ancrée. Vous construisez solidement et cultivez la patience.';
  if (elements.air === max)
    return 'Un esprit libre et communicant. Vous pensez, reliez et faites circuler les idées.';
  return 'Une sensibilité profonde et intuitive. Vous ressentez, imaginez et fusionnez avec votre environnement.';
}

/**
 * Compatibility score between two signs (aspect-theory based).
 * NOTE: horoscope.ts imports its own element-based signCompatibility from data/zodiac.ts.
 * This version uses astrological aspects (conjunction, sextile, square, trine, opposition).
 */
export function signCompatibility(sign1: ZodiacSign, sign2: ZodiacSign): number {
  const idx1 = ZODIAC_ORDER.indexOf(sign1);
  const idx2 = ZODIAC_ORDER.indexOf(sign2);
  const diff = Math.abs(idx1 - idx2);
  const distance = diff <= 6 ? diff : 12 - diff;

  // distance 0=conjunction, 1=semi-sextile, 2=sextile, 3=square,
  //          4=trine, 5=quincunx, 6=opposition
  const scores = [85, 50, 65, 35, 80, 45, 38];
  return scores[distance] ?? 55;
}
