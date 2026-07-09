export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type Planet =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export type House = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type Element = 'fire' | 'earth' | 'air' | 'water';
export type Modality = 'cardinal' | 'fixed' | 'mutable';

export interface PlanetPosition {
  planet: Planet;
  sign: ZodiacSign;
  degree: number;       // 0-30 within sign
  house: House;
  retrograde: boolean;
  longitude?: number;   // absolute ecliptic longitude 0-360 (for transit calculations)
}

export interface BirthData {
  date: string;         // ISO date
  time: string;         // HH:mm
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: number;     // UTC offset
}

export interface NatalChart {
  sun: ZodiacSign;
  moon: ZodiacSign;
  rising: ZodiacSign;   // ascendant
  positions: PlanetPosition[];
  houses: { cusp: number; sign: ZodiacSign }[];
  elements: { fire: number; earth: number; air: number; water: number };
  modalities: { cardinal: number; fixed: number; mutable: number };
}

export interface User {
  email: string;
  name: string;
  birthData: BirthData | null;
  natalChart: NatalChart | null;
  isPremium: boolean;
  scansRemaining: number;
  trialStartedAt: number | null;
  premiumUntil: number | null;
  createdAt: number;
}

export interface HoroscopeEntry {
  date: string;
  general: string;
  love: string;
  career: string;
  energy: number;      // 1-5
  mood: string;
  luckyNumber: number;
  luckyColor: string;
}

export interface CompatibilityResult {
  yourSun: ZodiacSign;
  theirSun: ZodiacSign;
  yourMoon: ZodiacSign;
  theirMoon: ZodiacSign;
  score: number;        // 0-100
  title: string;
  strengths: string[];
  challenges: string[];
  description: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  horoscopeSummary: string;
  userNote: string;
  userRating: number;   // 1-5
}

export interface DailyEntry {
  date: string;
  text: string;
}
