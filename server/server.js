import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import * as Astronomy from 'astronomy-engine';
const { AstroTime, Body, GeoVector, SiderealTime, EclipticGeoMoon, Rotation_EQJ_ECL, RotateVector, Observer, Horizon, Equator, MakeTime, Ecliptic } = Astronomy;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import billingRouter, { stripeWebhookHandler, isStripeConfigured } from './billing.js';
import { registerGamificationRoutes } from './gamification.js';
import { CELESTE_VOICE, celesteSystemPrompt } from './celest-voice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET is missing or too short (>= 32 chars required). Refusing to boot.');
}
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.cheapestinference.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const PORT = process.env.PORT || 3001;

// CORS: en production, restreindre aux origines autorisées via CORS_ORIGIN (CSV).
// En dev (pas de CORS_ORIGIN), on permet tout pour le HMR Vite.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : null;

// ─── Web Push (VAPID) setup ────────────────────────────────
import webpush from 'web-push';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('🔔 Web Push: VAPID configured');
} else {
  console.log('⚠️  Web Push: VAPID keys missing — notifications disabled');
}

// ─── Database ──────────────────────────────────────────────
const db = new Database(join(__dirname, 'celeste.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    birth_data TEXT,
    natal_chart TEXT,
    is_premium INTEGER DEFAULT 0,
    scans_remaining INTEGER DEFAULT 7,
    trial_started_at INTEGER,
    premium_until INTEGER,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    streak_count INTEGER DEFAULT 0,
    streak_last_date TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    horoscope_summary TEXT,
    user_note TEXT,
    user_rating INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS horoscope_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS horoscope_global_daily (
    sun_sign TEXT NOT NULL,
    date TEXT NOT NULL,
    transits TEXT NOT NULL,
    content TEXT NOT NULL,
    generated_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (sun_sign, date)
  );

  -- P2: Personal cache keyed by (sun, moon, rising, date) for true personalization
  CREATE TABLE IF NOT EXISTS horoscope_personal_daily (
    sun_sign TEXT NOT NULL,
    moon_sign TEXT NOT NULL,
    rising_sign TEXT NOT NULL,
    date TEXT NOT NULL,
    transits TEXT NOT NULL,
    content TEXT NOT NULL,
    generated_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (sun_sign, moon_sign, rising_sign, date)
  );

  CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    received_at INTEGER NOT NULL
  );

  -- Migration safe : ajout colonnes Stripe si table users pré-existait sans elles
`);

// Safe migrations (idempotent)
const userCols = db.prepare("PRAGMA table_info(users)").all();
const hasCol = (name) => userCols.some(c => c.name === name);
if (!hasCol('stripe_customer_id')) {
  db.exec('ALTER TABLE users ADD COLUMN stripe_customer_id TEXT');
}
if (!hasCol('stripe_subscription_id')) {
  db.exec('ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT');
}
if (!hasCol('streak_count')) {
  db.exec('ALTER TABLE users ADD COLUMN streak_count INTEGER DEFAULT 0');
}
if (!hasCol('streak_last_date')) {
  db.exec('ALTER TABLE users ADD COLUMN streak_last_date TEXT');
}

// horoscope_cache migration — add summary column (per-day short version for week view)
const hcacheCols = db.prepare("PRAGMA table_info(horoscope_cache)").all();
if (!hcacheCols.find(c => c.name === 'summary')) {
  db.exec('ALTER TABLE horoscope_cache ADD COLUMN summary TEXT');
}

// horoscope_favorites table — Feature 5: bookmark phrases across all sections
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='horoscope_favorites'").get()) {
  db.exec(`
    CREATE TABLE horoscope_favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      section TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id, date, section)
    );
    CREATE INDEX idx_fav_user_date ON horoscope_favorites(user_id, date);
  `);
  console.log('⭐ Migration: horoscope_favorites table created');
}

// push_subscriptions table — Web Push API storage
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'").get()) {
  db.exec(`
    CREATE TABLE push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_push_user ON push_subscriptions(user_id);
  `);
}

// users columns for notification preferences
const userColsForNotif = db.prepare("PRAGMA table_info(users)").all();
if (!userColsForNotif.find(c => c.name === 'notification_hour')) {
  db.exec('ALTER TABLE users ADD COLUMN notification_hour INTEGER DEFAULT 9');
}
if (!userColsForNotif.find(c => c.name === 'last_notification_date')) {
  db.exec('ALTER TABLE users ADD COLUMN last_notification_date TEXT');
}
// Fix #6 — notification_timezone : offset du fuseau de l'utilisateur en heures (Number, -12 à +14).
// Permet au cron d'envoyer la notif à 9h LOCAL au lieu de 9h UTC (qui était décalé de +2h en été).
if (!userColsForNotif.find(c => c.name === 'notification_timezone')) {
  db.exec('ALTER TABLE users ADD COLUMN notification_timezone REAL DEFAULT 0');
}

// profiles table — multi-profile natal charts (family, friends, etc.)
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get()) {
  db.exec(`
    CREATE TABLE profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relation TEXT NOT NULL DEFAULT 'self',
      birth_data TEXT NOT NULL,
      is_self INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_profiles_user ON profiles(user_id);
  `);
}

// daily_rituals table — morning card + evening intention (Feature A1)
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_rituals'").get()) {
  db.exec(`
    CREATE TABLE daily_rituals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      morning_card TEXT,
      evening_intention TEXT,
      completed_morning INTEGER DEFAULT 0,
      completed_evening INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_rituals_user_date ON daily_rituals(user_id, date);
  `);
}

// onboarding_progress table — first-run guided tour (Feature A2)
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_progress'").get()) {
  db.exec(`
    CREATE TABLE onboarding_progress (
      user_id INTEGER PRIMARY KEY,
      completed_steps TEXT DEFAULT '{}',
      dismissed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

// weekly_challenges table — weekly astro growth challenge (Feature C3)
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_challenges'").get()) {
  db.exec(`
    CREATE TABLE weekly_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_id TEXT NOT NULL,                          -- 'YYYY-Www' ISO week
      theme TEXT,
      action TEXT,
      explanation TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      reflection_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, week_id)
    );
    CREATE INDEX idx_weekly_user_week ON weekly_challenges(user_id, week_id);
  `);
}

// ─── Streak helpers ────────────────────────────────────────
/** Local date as YYYY-MM-DD (avoids UTC offset bugs for streaks/cache keys). */
function localISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayISODate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Update streak for user after they viewed today's horoscope.
// Rules:
//  - If streak_last_date == today  → no-op (already counted today)
//  - If streak_last_date == yesterday → streak_count + 1
//  - Otherwise (gap or null) → streak_count = 1
// Returns the new streak count.
function updateStreak(userId, today) {
  const u = db.prepare('SELECT streak_count, streak_last_date FROM users WHERE id = ?').get(userId);
  if (!u) return 0;
  if (u.streak_last_date === today) return u.streak_count ?? 0;
  const yesterday = yesterdayISODate();
  const newCount = u.streak_last_date === yesterday ? (u.streak_count ?? 0) + 1 : 1;
  db.prepare('UPDATE users SET streak_count = ?, streak_last_date = ? WHERE id = ?')
    .run(newCount, today, userId);
  return newCount;
}

// ─── Ephemeris (server-side, astronomy-engine) ─────────────
const SIGNS = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];

function geoEclipticLongitude(planet, time) {
  if (planet === 'moon') {
    const ecl = EclipticGeoMoon(time);
    return ((ecl.lon % 360) + 360) % 360;
  }
  const bodies = {
    sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus,
    mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
    uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto,
  };
  const gv = GeoVector(bodies[planet], time, true);
  const rot = Rotation_EQJ_ECL();
  const ev = RotateVector(rot, gv);
  let lon = Math.atan2(ev.y, ev.x) * 180 / Math.PI;
  return ((lon % 360) + 360) % 360;
}

function isRetrograde(planet, time) {
  if (planet === 'sun' || planet === 'moon') return false;
  const lon1 = geoEclipticLongitude(planet, time);
  const tomorrow = new AstroTime(time.tt + 1.0);
  const lon2 = geoEclipticLongitude(planet, tomorrow);
  let d = lon2 - lon1; d = ((d+180)%360+360)%360-180;
  return d < 0;
}

// ─── Helper JSON.parse safe ───
// Retourne null si input null/undefined, fallback si fourni, throw une vraie
// erreur descriptive si le contenu est corrompu. Élimine les crashes silencieux
// sur birth_data, natal_chart, cache content corrompu.
function safeJsonParse(input, fallback = null, contextLabel = 'json') {
  if (input == null) return fallback;
  if (typeof input !== 'string') return input; // déjà un objet
  try {
    return JSON.parse(input);
  } catch (err) {
    console.warn(`[safeJsonParse] ${contextLabel} corrupted:`, err.message);
    return fallback;
  }
}

function getTransits(date) {
  const time = new AstroTime(date);
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  const result = {};
  for (const p of planets) {
    const lon = geoEclipticLongitude(p, time);
    result[p] = {
      sign: SIGNS[Math.floor(lon/30)],
      degree: Math.round(lon % 30 * 10) / 10,
      longitude: Math.round(lon * 100) / 100,
      retrograde: isRetrograde(p, time),
    };
  }
  return result;
}

function getNatalPositions(birthData, full = false) {
  // P1 #H — Validation input : crash silencieux sur dates/timezone manquants.
  if (!birthData || !birthData.date || !birthData.time ||
      typeof birthData.timezone !== 'number' || typeof birthData.latitude !== 'number' || typeof birthData.longitude !== 'number') {
    throw new Error('Invalid birth data: date, time, timezone, latitude, longitude required');
  }
  const local = new Date(`${birthData.date}T${birthData.time}:00`);
  // P1 #H — Date invalide → 'Invalid Date' → calculs astronomiques retournent NaN.
  if (isNaN(local.getTime())) {
    throw new Error(`Invalid birth date/time: ${birthData.date}T${birthData.time}`);
  }
  const utc = new Date(local.getTime() - birthData.timezone * 3600000);
  const time = new AstroTime(utc);
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  const result = {};
  for (const p of planets) {
    const lon = geoEclipticLongitude(p, time);
    result[p] = {
      sign: SIGNS[Math.floor(lon/30)],
      degree: Math.round(lon % 30 * 10) / 10,
      longitude: Math.round(lon * 100) / 100,
      retrograde: isRetrograde(p, time),
    };
  }
  // Ascendant + MC + Houses
  const gst = SiderealTime(time); // hours 0-24
  const gstDeg = gst * 15; // → degrees
  const lst = ((gstDeg + birthData.longitude) % 360 + 360) % 360;
  const eps = 23.4393 * Math.PI / 180;
  const latR = birthData.latitude * Math.PI / 180;
  const lstR = lst * Math.PI / 180;

  // MC (Midheaven) — ecliptic longitude on the upper meridian
  let mc = Math.atan2(Math.sin(lstR), Math.cos(lstR) * Math.cos(eps)) * 180 / Math.PI;
  mc = ((mc % 360) + 360) % 360;

  // Ascendant
  let asc = Math.atan2(-Math.cos(lstR), Math.sin(lstR)*Math.cos(eps)+Math.tan(latR)*Math.sin(eps)) * 180/Math.PI;
  asc = ((asc + 180) % 360 + 360) % 360;

  result.ascendant = { sign: SIGNS[Math.floor(asc/30)], degree: Math.round(asc%30 * 10) / 10, longitude: Math.round(asc * 100) / 100 };
  result.midheaven = { sign: SIGNS[Math.floor(mc/30)], degree: Math.round(mc%30 * 10) / 10, longitude: Math.round(mc * 100) / 100 };

  // Lunar Nodes (Mean Node)
  const T = (time.tt - 2451545.0) / 36525.0;
  let nodeLon = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000.0;
  nodeLon = ((nodeLon % 360) + 360) % 360;
  result.northNode = { sign: SIGNS[Math.floor(nodeLon/30)], degree: Math.round(nodeLon % 30 * 10) / 10, longitude: Math.round(nodeLon * 100) / 100 };
  result.southNode = { longitude: Math.round(((nodeLon + 180) % 360) * 100) / 100 };

  if (full) {
    // Equal House system: House 1 = Ascendant, each subsequent +30°
    result.houses = [];
    for (let i = 0; i < 12; i++) {
      const cuspLon = ((asc + i * 30) % 360 + 360) % 360;
      result.houses.push({
        number: i + 1,
        cusp: Math.round(cuspLon * 100) / 100,
        sign: SIGNS[Math.floor(cuspLon / 30)],
      });
    }

    // Aspects between planets
    const allBodies = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northNode'];
    const aspectTypes = [
      { name: 'conjunction', angle: 0, orb: 8, color: '#fbbf24' },
      { name: 'opposition', angle: 180, orb: 8, color: '#ef4444' },
      { name: 'trine', angle: 120, orb: 8, color: '#22d3ee' },
      { name: 'square', angle: 90, orb: 8, color: '#f97316' },
      { name: 'sextile', angle: 60, orb: 6, color: '#4ade80' },
    ];
    result.aspects = [];
    for (let i = 0; i < allBodies.length; i++) {
      for (let j = i + 1; j < allBodies.length; j++) {
        const p1 = allBodies[i], p2 = allBodies[j];
        const lon1 = result[p1]?.longitude;
        const lon2 = result[p2]?.longitude;
        if (lon1 == null || lon2 == null) continue;
        let diff = Math.abs(lon1 - lon2);
        if (diff > 180) diff = 360 - diff;
        for (const at of aspectTypes) {
          if (Math.abs(diff - at.angle) <= at.orb) {
            result.aspects.push({ p1, p2, type: at.name, angle: at.angle, orb: Math.round((Math.abs(diff - at.angle)) * 10) / 10, color: at.color });
            break;
          }
        }
      }
    }
  }
  return result;
}

// ─── LLM Horoscope Generation ──────────────────────────────
// Retry with exponential backoff on 429 (rate limit) and 5xx
async function callLLMWithRetry(messages, maxRetries = 3, maxTokens = 4096, extraBody = {}, timeoutMs = 45000) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(LLM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages,
          temperature: 0.85,
          max_tokens: maxTokens,
          ...extraBody,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) return await response.json();
      const errText = await response.text().catch(() => '');
      lastErr = new Error(`LLM ${response.status}`);
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          console.warn(`[LLM] attempt ${attempt + 1} ${response.status}, retry in ${delayMs}ms`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      console.error('[LLM] fatal:', response.status, errText.slice(0, 200));
      throw lastErr;
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        // P0 #10 — Log dynamique au lieu de "45s" hardcodé.
        console.warn(`[LLM] attempt ${attempt + 1} timed out after ${Math.round(timeoutMs / 1000)}s`);
        lastErr = new Error(`LLM timeout (${Math.round(timeoutMs / 1000)}s)`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw lastErr;
      }
      throw e;
    }
  }
  throw lastErr;
}

// ─── FALLBACK horoscopes (par signe, pré-écrits) ─────────────────
// Utilisés si le LLM rate-limit ou panne. Garantit un horoscope TOUJOURS disponible.
const FALLBACK_HOROSCOPES = {
  Aries: { general: "Le feu intérieur brûle fort aujourd'hui — agis, mais choisis ta bataille avec discernement.", amour: "Ta magnétise, mais l'autre a besoin d'être rassuré(e) autant qu'impressionné(e).", carriere: "Lance-toi sur le projet qui te trotte dans la tête depuis des semaines.", energie: 4, mood: "Combatif", luckyNumber: 7, luckyColor: "Rouge" },
  Taurus: { general: "Une journée pour ancrer, ralentir, savourer. La patience paie aujourd'hui plus que l'élan.", amour: "Les gestes tendres comptent plus que les grandes déclarations. Présence.", carriere: "Avance méthodique. Tu poses les bases solides.", energie: 3, mood: "Stable", luckyNumber: 4, luckyColor: "Vert forêt" },
  Gemini: { general: "Ton esprit vole d'idée en idée — canalise-le sur un seul sujet à la fois.", amour: "Communication, dialogue, légèreté. La curiosité nourrit le lien.", carriere: "Multiples pistes s'ouvrent — choisis, engage-toi.", energie: 4, mood: "Curieux", luckyNumber: 5, luckyColor: "Jaune" },
  Cancer: { general: "Lune en phase sensible aujourd'hui — écoute ton ventre plus que ta tête.", amour: "Coquille protectrice ou cœur ouvert ? Les deux à la fois.", carriere: "Ta sensibilité est un super-pouvoir, pas une faiblesse.", energie: 3, mood: "Introspectif", luckyNumber: 2, luckyColor: "Blanc argenté" },
  Leo: { general: "Rayonne sans écraser. Le leadership aujourd'hui, c'est inspirer.", amour: "Cœur en scène — sois généreux(se), mais laisse l'autre briller aussi.", carriere: "Visibilité, reconnaissance. Assume ta place au centre.", energie: 5, mood: "Lumineux", luckyNumber: 1, luckyColor: "Or" },
  Virgo: { general: "Le détail qui te sauve aujourd'hui. Prends le temps de bien faire.", amour: "L'attention aux petits gestes fait toute la différence.", carriere: "Organisation, méthode, clarté — c'est ton terrain de jeu.", energie: 3, mood: "Concentré", luckyNumber: 3, luckyColor: "Beige" },
  Libra: { general: "Équilibre, harmonie, mais aussi : sache dire ton vrai oui et ton vrai non.", amour: "Le lien se nourrit d'authenticité autant que de douceur.", carriere: "Négociations facilitées. Trouve l'accord élégant.", energie: 4, mood: "Harmonieux", luckyNumber: 6, luckyColor: "Rose poudré" },
  Scorpio: { general: "Plongée en profondeur. Tout ce qui est superficiel ne t'intéresse pas aujourd'hui.", amour: "Intensité magnétique. Laisse l'autre respirer dans ton espace.", carriere: "Stratégie, intuition, percée. Tu vois ce que d'autres ne voient pas.", energie: 4, mood: "Mystérieux", luckyNumber: 8, luckyColor: "Bordeaux" },
  Sagittarius: { general: "Élan d'aventure, besoin d'horizon. Une idée t'appelle au loin.", amour: "Liberté et engagement ne sont pas ennemis — dialogue.", carriere: "Vise haut, lance-toi, apprends de l'élan même imparfait.", energie: 4, mood: "Aventurier", luckyNumber: 9, luckyColor: "Bleu indigo" },
  Capricorn: { general: "Discipline et patience. Chaque pas compte. Le long terme t'appartient.", amour: "Construire, durable. La tendresse peut rimer avec constance.", carriere: "Avancement concret, reconnaissance du travail bien fait.", energie: 4, mood: "Déterminé", luckyNumber: 10, luckyColor: "Gris anthracite" },
  Aquarius: { general: "Vision décalée, idées qui sortent du cadre. Ose penser à l'envers.", amour: "Indépendance chérie, mais le lien vrai se construit.", carriere: "Innovation, originalité. Ton regard neuf est précieux.", energie: 4, mood: "Visionnaire", luckyNumber: 11, luckyColor: "Turquoise" },
  Pisces: { general: "Vague intuitive forte. Écoute tes rêves, ton imagination sait des choses.", amour: "Romantisme, compassion, fusion. Mais garde ton centre.", carriere: "Créativité, art, intuition. Laisse parler ta part sensible.", energie: 3, mood: "Rêveur", luckyNumber: 12, luckyColor: "Lavande" },
};
function personalizeHoroscope(base, natalPositions, transits, birthData) {
  const out = { ...base };
  const rising = natalPositions.rising?.sign;
  if (rising && rising !== natalPositions.sun?.sign) {
    const tag = `Avec ton ascendant ${rising}, cette énergie se vit avant tout dans ta manière d'apparaître au monde — la sphère de ta ${getAscendantHouseKeyword(rising)}.`;
    if (out.general && !out.general.includes(tag)) {
      out.general = out.general + '\n\n' + tag;
    }
  }
  return out;
}

function getAscendantHouseKeyword(risingSign) {
  // Crude house-of-life mapping per rising sign (1ère maison = moi, identité)
  const map = {
    Aries: '1ère maison (identité, élans personnels)',
    Taurus: '2ème maison (valeurs, ressources, sensorialité)',
    Gemini: '3ème maison (communication, proches, idées)',
    Cancer: '4ème maison (foyer, racines, intimité)',
    Leo: '5ème maison (créativité, plaisir, cœur)',
    Virgo: '6ème maison (quotidien, santé, service)',
    Libra: '7ème maison (relations, accords, autres)',
    Scorpio: '8ème maison (intimité profonde, transformations)',
    Sagittarius: '9ème maison (sens, voyages, philosophie)',
    Capricorn: '10ème maison (vocation, statut, ambitions)',
    Aquarius: '11ème maison (projets, communautés, idéaux)',
    Pisces: '12ème maison (intériorité, spiritualité, repli)',
  };
  return map[risingSign] || 'maison angulaire';
}
async function generateHoroscopeSummary(natalPositions, transits, sign, dateLabel) {
  const systemPrompt = celesteSystemPrompt("Tu écris à une amie qui consulte son ciel du jour. Tes résumés sont courts (2-3 phrases), poétiques mais terre-à-terre, jamais génériques. Tu écris en français.");

  const userPrompt = `Thème natal: ${Object.entries(natalPositions).map(([k,v]) => `${k} ${v.sign} ${v.degree}°`).join(', ')}.
Transits du ${dateLabel}: ${Object.entries(transits).map(([k,v]) => `${k} ${v.sign} ${v.degree}°`).join(', ')}.
Signe solaire: ${sign}.

Génère un résumé court en JSON:
{
  "general": "2 phrases sur l'énergie dominante du jour",
  "energie": un nombre de 1 à 5,
  "mood": "1-2 mots pour l'humeur",
  "luckyColor": "une couleur en français"
}

Réponds UNIQUEMENT avec le JSON.`;

  const data = await callLLMWithRetry([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], 2, 4096); // P1 #E — 2048 trop juste pour JSON complet → 4096.
  const msg = data.choices?.[0]?.message || {};
  const content = msg.content || msg.reasoning_content || '';
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in summary response');
  return JSON.parse(jsonMatch[0]);
}

async function generateHoroscope(natalPositions, transits, sign) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const systemPrompt = celesteSystemPrompt("Tu écris l'horoscope de quelqu'un qui te fait confiance. Tu te bases sur les vraies positions planétaires, pas sur du blabla générique. Ton ton est psychologique et humain — jamais prédictif, jamais moralisateur. Tu écris en français.");

  const userPrompt = `Voici le thème natal de la personne:
${Object.entries(natalPositions).map(([k,v]) => `${k}: ${v.sign} ${v.degree}°${v.retrograde ? ' ℞' : ''}`).join('\n')}

Voici les transits actuels (positions planétaires d'aujourd'hui ${today}):
${Object.entries(transits).map(([k,v]) => `${k}: ${v.sign} ${v.degree}°${v.retrograde ? ' ℞' : ''}`).join('\n')}

Le signe solaire est ${sign}.

Génère un horoscope PERSONNALISÉ en JSON avec ce format exact:
{
  "general": "2-3 phrases sur l'énergie générale de la journée, basées sur les aspects réels entre le thème natal et les transits",
  "amour": "1-2 phrase sur les relations, basée sur Vénus et la Lune",
  "carriere": "1-2 phrase sur le travail/projet, basée sur Saturne et Mercure",
  "energie": un nombre de 1 à 5,
  "mood": "1-2 mots décrivant l'humeur dominante",
  "luckyNumber": un nombre de 1 à 99,
  "luckyColor": "une couleur en français"
}

Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après.`;

  const data = await callLLMWithRetry([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], 3, 4096);
  const msg = data.choices?.[0]?.message || {};
  // Try content first, then reasoning_content (some reasoning models put JSON there)
  let content = msg.content || msg.reasoning_content || '';

  // Parse JSON from response (handle markdown code blocks)
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in LLM response (content len=' + (content?.length || 0) + ')');
  }
  return JSON.parse(jsonMatch[0]);
}

// ─── LLM Compatibility Generation ──────────────────────────
async function generateCompatibility(chart1, chart2, sign1, sign2, context = 'romantic') {
  const systemPrompt = celesteSystemPrompt("Tu analyses la compatibilité entre deux personnes avec nuance et chaleur — tu soulignes les forces ET les tensions, sans jamais être cruelle. Tu écris en français, ton vivant et humain.");

  const ctxConfig = {
    romantic: {
      label: 'amoureuse',
      angle: 'Analyse leur compatibilité amoureuse (chimique, attraction, communication intime, projets de vie à deux).',
      titleHint: 'un titre évocateur romantique (ex: L\'étincelle et la profondeur)',
    },
    family: {
      label: 'familiale',
      angle: 'Analyse leur dynamique familiale (soutien, tensions éventuelles, rituels, façon dont chacun exprime l\'attachement, héritage émotionnel).',
      titleHint: 'un titre évocateur familial (ex: Le fil invisible, Ancrage et envol)',
    },
    friend: {
      label: 'amicale',
      angle: 'Analyse leur amitié (complémentarité, activités partagées, loyauté, petits frictions du quotidien, façon dont ils se font mutuellement grandir).',
      titleHint: 'un titre évocateur amical (ex: Les inséparables, L\'écho fidèle)',
    },
    colleague: {
      label: 'professionnelle',
      angle: 'Analyse leur dynamique de travail (complémentarité des styles, fluidité de la collaboration, zones de friction possibles, comment ils peuvent co-créer efficacement).',
      titleHint: 'un titre évocateur professionnel (ex: Duo complémentaire, Forces en regard)',
    },
  };
  const ctx = ctxConfig[context] || ctxConfig.romantic;

  const userPrompt = `Personne 1 (signe solaire ${sign1}):
${Object.entries(chart1).map(([k,v]) => `${k}: ${v.sign} ${v.degree}°`).join('\n')}

Personne 2 (signe solaire ${sign2}):
${Object.entries(chart2).map(([k,v]) => `${k}: ${v.sign} ${v.degree}°`).join('\n')}

${ctx.angle} Réponds en JSON:
{
  "score": un nombre 0-100 basé sur l'harmonie des aspects pour ce contexte ${ctx.label},
  "title": ${ctx.titleHint},
  "strengths": ["force 1", "force 2", "force 3"],
  "challenges": ["défi 1", "défi 2"],
  "description": "2-3 phrases d'analyse globale nuancée adaptée au contexte ${ctx.label}"
}
Réponds UNIQUEMENT avec le JSON.`;

  const data = await callLLMWithRetry([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], 3);
  const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '';
  const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in LLM response');
  return JSON.parse(jsonMatch[0]);
}

// ─── Auth Middleware ───────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.db = db; // expose db to billing routes (portal, etc.)
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Rate limiters ─────────────────────────────────────────
// Login/register: prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// LLM endpoints: prevent quota burn (key by user id, fall back to IP via ipKeyGenerator helper for IPv6 safety)
const llmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 30,
  keyGenerator: (req) => req.user?.id?.toString() || ipKeyGenerator(req.ip),
  message: { error: 'Limite atteinte. Réessaie dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Server ────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, cb) {
    // Pas d'origin = requête same-origin ou curl ; on permet.
    if (!origin || !allowedOrigins) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

// P0 #22 — Headers de sécurité (Helmet). CSP laisse passer le CSS inline / Vite assets.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://api.cheapestinference.com', 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// P0 #23 — Fail-fast sur les routes hors-scope (scanners / bots).
// Économise CPU + log propre. Bloque les scans Next.js / MCP / ONVIF / SSH / etc.
const SCAN_PATTERNS = [
  /^\/_next(\/|$)/i,
  /^\/onvif(\/|$)/i,
  /^\/mcp(\/|$)/i,
  /^\/\.well-known(\/|$)/i,
  /^\/wp-(login|admin|content|includes|json)(\/|$)/i,
  /^\/phpmyadmin(\/|$)/i,
  /^\/\.env(\/|$|\.)/i,
  /^\/api\/route(\/|$)/i,
  /^\/app(\/|$)/i,
];
app.use((req, res, next) => {
  if (SCAN_PATTERNS.some(p => p.test(req.path))) {
    scanStats.count++;
    scanStats.lastPath = req.path;
    scanStats.lastIp = req.ip;
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// P0 #25 — Scan metrics: counter + flush every 5min so it shows in Render/Fly logs
// without flooding them. Helps you decide if fail2ban / Cloudflare is worth it.
const scanStats = { count: 0, lastPath: '', lastIp: '' };
setInterval(() => {
  if (scanStats.count > 0) {
    console.log(`[scan-blocked] ${scanStats.count} hits (last: ${scanStats.lastPath} from ${scanStats.lastIp})`);
    scanStats.count = 0;
  }
}, 5 * 60 * 1000);

// ─── Stripe webhook (raw body AVANT express.json) ──────────
// ⚠️ Doit être monté avant express.json() pour que la signature fonctionne
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    req.rawBody = req.body; // preserve raw body for signature verification
    stripeWebhookHandler(req, res, db);
  }
);

// JSON parser pour le reste de l'API
app.use(express.json({ limit: '2mb' }));

// ─── DEBUG: logger TOUTES les requêtes POST entrantes ───
// P0 #4 — Filtre les champs sensibles (password, token) avant de logger.
// Sans ce filtre, les mots de passe login/register étaient persistés en clair.
const SENSITIVE_FIELDS = ['password', 'token', 'jwt', 'authorization', 'secret'];
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = SENSITIVE_FIELDS.includes(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('[POST IN]', req.path, JSON.stringify({
      body: sanitizeBody(req.body),
      ip: req.ip,
      ua: (req.headers['user-agent'] || '').substring(0, 50),
    }));
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ephemeris: 'astronomy-engine v2' });
});

// ─── Natal Chart (full data for premium wheel) ────────────
app.get('/api/natal-chart', auth, (req, res) => {
  let row = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(req.user.id);
  // Fallback: if no profile row, try users.birth_data
  if (!row || !row.birth_data) {
    row = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(req.user.id);
  }
  if (!row || !row.birth_data) {
    return res.status(400).json({ error: 'No birth data found' });
  }
  const birthData = safeJsonParse(row.birth_data, null, 'chart birth_data');
  if (!birthData) return res.status(500).json({ error: 'Corrupted birth data' });
  const natal = getNatalPositions(birthData, true);
  res.json({ natal });
});

// ─── Planet Interpretation (LLM-powered, cached) ───────────
db.exec(`CREATE TABLE IF NOT EXISTS planet_interpretations (
  user_id INTEGER NOT NULL,
  planet TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY(user_id, planet)
)`);

// Global shared templates — generated ONCE, reused for ALL users
// (planet, sign) → interpretation. Pre-populated by bootstrapTemplates().
db.exec(`CREATE TABLE IF NOT EXISTS interpretation_templates (
  planet TEXT NOT NULL,
  sign TEXT NOT NULL,
  degree INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  general TEXT NOT NULL,
  in_sign TEXT NOT NULL,
  degree_symbolic TEXT NOT NULL,
  keywords TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY(planet, sign, degree, language)
)`);

const PLANET_FR = {
  sun: 'Soleil', moon: 'Lune', mercury: 'Mercure', venus: 'Vénus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne',
  uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluton',
};
const PLANET_SYMBOLS = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
};
const ASPECT_FR = {
  conjunction: 'conjonte', opposition: 'opposition', trine: 'trigone',
  square: 'carré', sextile: 'sextile', semisextile: 'semi-sextile',
  semisquare: 'semi-carré', quincunx: 'quinconce',
};
const SIGN_ELEMENTS = {
  'Bélier': 'Feu', 'Lion': 'Feu', 'Sagittaire': 'Feu',
  'Taureau': 'Terre', 'Vierge': 'Terre', 'Capricorne': 'Terre',
  'Gémeaux': 'Air', 'Balance': 'Air', 'Verseau': 'Air',
  'Cancer': 'Eau', 'Scorpion': 'Eau', 'Poissons': 'Eau',
};

function findHouse(longitude, houses) {
  for (let i = 0; i < 12; i++) {
    const cusp1 = houses[i].cusp;
    const cusp2 = houses[(i + 1) % 12].cusp;
    if (cusp2 > cusp1) {
      if (longitude >= cusp1 && longitude < cusp2) return i + 1;
    } else {
      if (longitude >= cusp1 || longitude < cusp2) return i + 1;
    }
  }
  return 1;
}
async function generatePlanetInterpretation(planet, natal) {
  const planetData = natal[planet];
  if (!planetData) throw new Error(`Planet ${planet} not found`);

  const planetName = PLANET_FR[planet] || planet;
  const symbol = PLANET_SYMBOLS[planet] || '';
  const signName = planetData.sign;
  const element = SIGN_ELEMENTS[signName] || '';
  const deg = Math.floor(planetData.degree);
  const min = Math.floor((planetData.degree - deg) * 60);
  const retroStr = planetData.retrograde ? ' (rétrograde)' : '';
  const houseNum = findHouse(planetData.longitude, natal.houses);

  // Collect aspects involving this planet
  const aspects = (natal.aspects || []).filter(a => a.p1 === planet || a.p2 === planet).map(a => {
    const other = a.p1 === planet ? a.p2 : a.p1;
    const otherName = PLANET_FR[other] || other;
    const aspectName = ASPECT_FR[a.type] || a.type;
    const orbSign = a.orb >= 0 ? '+' : '';
    const orbDeg = Math.floor(a.orb);
    const orbMin = Math.floor((Math.abs(a.orb) - Math.abs(orbDeg)) * 60);
    return {
      other, otherName, aspectName,
      text: `${otherName} ${aspectName} ${planetName} orbe ${orbSign}${orbDeg}°${String(orbMin).padStart(2,'0')}'`,
      orb: a.orb, color: a.color,
    };
  });

  const metadata = {
    planet, planetName, symbol, sign: signName, element,
    degree: planetData.degree,
    degreeStr: `${deg}°${String(min).padStart(2,'0')}'`,
    retrograde: !!planetData.retrograde,
    house: houseNum,
    aspects,
  };

  // ── Tier 1: GLOBAL TEMPLATE CACHE (shared across all users) ──
  // Pre-populated by bootstrapTemplates() and lazily filled on first hit.
  const degBucket = Math.floor(deg / 10); // 0, 1, 2 (décan)
  const tmpl = db.prepare(
    'SELECT general, in_sign, degree_symbolic, keywords FROM interpretation_templates WHERE planet = ? AND sign = ? AND degree = ? AND language = ?'
  ).get(planet, signName, degBucket, 'fr');

  if (tmpl) {
    console.log(`[planet-interp] template hit (planet=${planet}, sign=${signName}, decan=${degBucket})`);
    return {
      ...metadata,
      general: tmpl.general,
      inSign: tmpl.in_sign,
      degreeSymbolic: tmpl.degree_symbolic,
      keywords: JSON.parse(tmpl.keywords),
      source: 'template-cache',
      cacheHit: true,
    };
  }

  // ── Tier 2: LLM generation (lazy: fills the template cache too) ──
  console.log(`[planet-interp] LLM fallback (planet=${planet}, sign=${signName}, decan=${degBucket})`);
  const systemPrompt = celesteSystemPrompt("Tu expliques l'astrologie comme une amie qui s'y connaît vraiment — claire, vivante, jamais pédante. Tu évites le jargon technique, et quand tu l'utilises tu l'expliques simplement. Tu écris en français.");

  const userPrompt = `Génère une interprétation pour ${planetName} (${symbol}) dans le thème natal de cette personne. Tu lui parles directement (tu tutoies).

Position exacte: ${planetName} ${deg}°${String(min).padStart(2,'0')}' ${signName} (élément ${element})${retroStr}, Maison ${houseNum}.
${aspects.length > 0 ? `Aspects reçus: ${aspects.map(a => a.text).join('; ')}.` : 'Aucun aspect majeur.'}

Réponds UNIQUEMENT en JSON valide:
{
  "general": "Ce que ${planetName} représente pour toi (250-350 mots). Explique son rôle simplement — ce qu'elle dit de toi, comment elle se manifeste dans ta vie. Si ${planetData.retrograde ? 'elle est rétrograde' : 'elle est directe'}, explique ce que ça change concrètement pour toi.",
  "inSign": "${planetName} en ${signName} — ce que ça dit de toi (180-250 mots). Ce qui te caractérise avec cette combinaison: tes forces, tes nuances, comment ça se joue dans ton quotidien. ${planetData.retrograde ? 'Précise l\'effet concret de la rétrogradation.' : ''}",
  "degree": "Le degré ${deg} ${signName} et son symbolisme (80-120 mots). Commence par une image évocatrice entre guillemets, puis explique ce qu'elle dit de toi.",
  "temperament": "Tempérament (ex: Nerveux, Bilieux, Sanguin, Lymphatique)",
  "characterology": "Caractérologie en 3-4 mots (ex: Non-Emotif, Actif, Secondaire)",
  "keywords": ["5 mots-clés pertinents"]
}`;

  let parsed;
  try {
    const data = await callLLMWithRetry([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 4, 4000, { response_format: { type: 'json_object' } });

    const msg = data.choices?.[0]?.message || {};
    let content = (msg.content || msg.reasoning_content || '').trim();
    if (!content) throw new Error('Empty LLM response');
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in planet interpretation LLM response');
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (llmErr) {
    console.warn(`[planet-interp] LLM failed (${llmErr.message}), using FALLBACK template`);
    // Fallback: minimal but always-available text
    parsed = {
      general: `${planetName} (${symbol}) en astrologie — position en ${signName} (élément ${element}), Maison ${houseNum}. ${planetData.retrograde ? 'En phase rétrograde, son énergie s\'intériorise et se réinterprète.' : 'En marche directe, son énergie s\'exprime vers l\'extérieur.'} Réinterprétation détaillée dès que le service est rétabli.`,
      inSign: `${planetName} en ${signName} — combinaison de l'archétype ${planetName} avec les qualités ${element === 'Feu' ? 'enthousiastes, créatives et impulsives' : element === 'Terre' ? 'stables, concrètes et pratiques' : element === 'Air' ? 'intellectuelles, communicatives et sociales' : 'émotionnelles, intuitives et profondes'} du signe. Affinage en cours.`,
      degree: `Degré ${deg} ${signName} — symbolisme traditionnel à compléter. Position ${planetData.retrograde ? 'rétrograde' : 'directe'}.`,
      keywords: [planetName, signName, `${houseNum}e maison`, planetData.retrograde ? 'Rétrograde' : 'Direct', element],
    };
    parsed.isFallback = true;
  }

  // Persist to GLOBAL template cache (next user = 0 LLM calls)
  try {
    db.prepare(`INSERT OR REPLACE INTO interpretation_templates
      (planet, sign, degree, language, general, in_sign, degree_symbolic, keywords, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))`).run(
      planet, signName, degBucket, 'fr',
      parsed.general || '',
      parsed.inSign || '',
      parsed.degree || '',
      JSON.stringify(parsed.keywords || []),
    );
  } catch (e) {
    console.warn('[planet-interp] template write failed:', e.message);
  }

  return {
    ...metadata,
    general: parsed.general,
    inSign: parsed.inSign,
    degreeSymbolic: parsed.degree,
    keywords: parsed.keywords,
    source: parsed.isFallback ? 'fallback' : 'llm',
    cacheHit: false,
  };
}

app.get('/api/natal-chart/planet/:name', auth, async (req, res) => {
  try {
    const planet = req.params.name;
    const validPlanets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
    if (!validPlanets.includes(planet)) {
      return res.status(400).json({ error: 'Invalid planet name' });
    }

    // Check cache
    const cached = db.prepare('SELECT data FROM planet_interpretations WHERE user_id = ? AND planet = ?').get(req.user.id, planet);
    if (cached) {
      return res.json(safeJsonParse(cached.data, null, 'planet_interp_cache'));
    }

    // Get natal data
    const row = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(req.user.id);
    if (!row || !row.birth_data) {
      return res.status(400).json({ error: 'No birth data found' });
    }
    const birthData = safeJsonParse(row.birth_data, null, 'planet_interp birth_data');
    if (!birthData) return res.status(400).json({ error: 'Corrupted partner birth data' });
    const natal = getNatalPositions(birthData, true);

    const interpretation = await generatePlanetInterpretation(planet, natal);

    // Save to cache
    db.prepare('INSERT OR REPLACE INTO planet_interpretations (user_id, planet, data) VALUES (?, ?, ?)')
      .run(req.user.id, planet, JSON.stringify(interpretation));

    res.json(interpretation);
  } catch (err) {
    console.error('[planet-interpretation]', err.message);
    res.status(500).json({ error: 'Failed to generate interpretation: ' + err.message });
  }
});

// ─── Moon phase (public — used by Home widget) ─────────────
// Uses astronomy-engine for ±1h precision. Cache-friendly:
// the phase only changes ~hourly, so we round to the hour.
const MOON_PHASES = [
  { name: 'Nouvelle Lune', emoji: '🌑', description: 'Temps des nouveaux commencements', min: 0,    max: 1.845 },
  { name: 'Premier croissant', emoji: '🌒', description: 'Intention et croissance', min: 1.845, max: 5.535 },
  { name: 'Premier quartier', emoji: '🌓', description: 'Action et décision',     min: 5.535, max: 9.225 },
  { name: 'Gibbeuse croissante', emoji: '🌔', description: 'Affinement et ajustement', min: 9.225, max: 12.915 },
  { name: 'Pleine Lune', emoji: '🌕', description: 'Illumination et clarté',  min: 12.915, max: 16.605 },
  { name: 'Gibbeuse décroissante', emoji: '🌖', description: 'Gratitude et partage',   min: 16.605, max: 20.295 },
  { name: 'Dernier quartier', emoji: '🌗', description: 'Lâcher prise et pardon', min: 20.295, max: 23.985 },
  { name: 'Dernier croissant', emoji: '🌘', description: 'Introspection et repos', min: 23.985, max: 27.675 },
  { name: 'Nouvelle Lune', emoji: '🌑', description: 'Temps des nouveaux commencements', min: 27.675, max: 29.530 },
];

function moonPhaseForDate(date) {
  // Sun-Moon ecliptic longitude difference → phase angle (0..360°).
  // 0° = new moon, 180° = full moon, 270° = last quarter.
  const sunLon  = ((geoEclipticLongitude('sun',  new AstroTime(date)) % 360) + 360) % 360;
  const moonLon = ((EclipticGeoMoon(new AstroTime(date)).lon % 360) + 360) % 360;
  let diff = moonLon - sunLon;
  if (diff < 0) diff += 360;
  // 29.530 days synodic month, so age (days since new moon) = diff/360 * 29.530
  const age = (diff / 360) * 29.530;
  const phase = MOON_PHASES.find(p => age >= p.min && age < p.max) || MOON_PHASES[0];
  return { name: phase.name, emoji: phase.emoji, description: phase.description, age: Math.round(age * 10) / 10 };
}

app.get('/api/astro/moon-phase', (req, res) => {
  try {
    const dateParam = req.query.date;
    let date = new Date();
    if (typeof dateParam === 'string') {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) date = parsed;
    }
    // Round to the hour — phase barely changes in 60min, big cache win.
    date.setMinutes(0, 0, 0);
    res.json({ ...moonPhaseForDate(date), date: date.toISOString() });
  } catch (e) {
    res.status(500).json({ error: 'Failed to compute moon phase' });
  }
});

// ─── Auth: Register ────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 min)' });

  const emailLower = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: 'Format d\'email invalide' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLower);
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(emailLower, hash);
  const token = jwt.sign({ id: result.lastInsertRowid, email: emailLower }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: result.lastInsertRowid, email: emailLower, isPremium: false, scansRemaining: 3 } });
});

// ─── Auth: Logout ───────────────────────────────────────────
// Endpoint minimal pour traçabilité + invalidation côté serveur (best-effort).
// Note: le vrai logout reste client-side (clear localStorage JWT) puisque le JWT
// est stateless. Cet endpoint sert juste à logger l'événement pour analytics/sécurité.
app.post('/api/auth/logout', auth, (req, res) => {
  try {
    const userId = req.user?.id;
    console.log(`[auth] logout user_id=${userId} at ${new Date().toISOString()}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] logout error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Auth: Login ───────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      isPremium: !!user.is_premium,
      scansRemaining: user.scans_remaining,
      birthData: safeJsonParse(user.birth_data, null, 'register auth birth_data'),
      streak: user.streak_count ?? 0,
    },
  });
});

// ─── Birth data validation helper (Fix #5 — date validation côté serveur) ──
// Accepte les formats YYYY-MM-DD. Refuse : dates futures, dates invalides (31 février),
// et tout objet non conformant au schéma BirthData.
function validateBirthData(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Données de naissance manquantes ou invalides.' };
  }
  const { date, time, city, country, latitude, longitude, timezone } = input;

  // Date — YYYY-MM-DD strict
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Date de naissance requise (format YYYY-MM-DD).' };
  }
  // Vérifier que la chaîne correspond à une date calendrier existante.
  // new Date('2026-02-31') === new Date('2026-03-03') silencieusement — on contourne.
  const [yStr, mStr, dStr] = date.split('-');
  const y = Number(yStr), m = Number(mStr), d = Number(dStr);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return { ok: false, error: 'Date de naissance invalide (ex: 31 février).' };
  }
  // Pas de date future (laisser 24h de marge pour les users dans d'autres fuseaux)
  const nowUtc = new Date();
  if (probe.getTime() > nowUtc.getTime() + 86400000) {
    return { ok: false, error: 'La date de naissance ne peut pas être dans le futur.' };
  }
  // Pas plus de 150 ans en arrière (sanity check, données corrompues)
  if (probe.getTime() < nowUtc.getTime() - 150 * 365 * 86400000) {
    return { ok: false, error: 'Date de naissance trop ancienne.' };
  }

  // Heure — HH:MM
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, error: 'Heure de naissance requise (format HH:MM).' };
  }
  const [hh, mm] = time.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return { ok: false, error: 'Heure de naissance invalide.' };
  }

  // Ville + coords
  if (typeof city !== 'string' || city.length < 1 || city.length > 100) {
    return { ok: false, error: 'Ville de naissance requise.' };
  }
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    return { ok: false, error: 'Latitude invalide.' };
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Longitude invalide.' };
  }
  if (typeof timezone !== 'number' || timezone < -12 || timezone > 14) {
    return { ok: false, error: 'Fuseau horaire invalide.' };
  }

  return { ok: true, birthData: { date, time, city, country: country || '', latitude, longitude, timezone } };
}

// ─── Save birth data (Fix #5 — validation) ─────────────────────
app.post('/api/profile/birth-data', auth, (req, res) => {
  const check = validateBirthData(req.body?.birthData);
  if (!check.ok) return res.status(400).json({ error: check.error });
  db.prepare('UPDATE users SET birth_data = ? WHERE id = ?').run(JSON.stringify(check.birthData), req.user.id);
  // Also upsert into profiles (is_self=1) so /api/natal-chart and other routes work
  const existing = db.prepare('SELECT id FROM profiles WHERE user_id = ? AND is_self = 1').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE profiles SET birth_data = ? WHERE id = ?').run(JSON.stringify(check.birthData), existing.id);
  } else {
    db.prepare('INSERT INTO profiles (user_id, name, relation, is_self, birth_data) VALUES (?, ?, ?, 1, ?)')
      .run(req.user.id, 'Moi', 'self', JSON.stringify(check.birthData));
  }
  res.json({ ok: true, birthData: check.birthData });
});

// ─── Get profile ───────────────────────────────────────────
app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    email: user.email,
    isPremium: !!user.is_premium,
    scansRemaining: user.scans_remaining,
    birthData: safeJsonParse(user.birth_data, null, 'login auth birth_data'),
    premiumUntil: user.premium_until,
    streak: user.streak_count ?? 0,
  });
});

// ─── Account deletion (Fix #1 — RGPD right to be forgotten) ──────────────
// DELETE /api/account — supprime le compte et TOUTES ses données personnelles.
// Conformité RGPD Art. 17 (droit à l'effacement) + App Store / Google Play guidelines
// qui exigent un mécanisme de suppression de compte.
//
// Tables purgées (toutes avec user_id FK → users.id) :
//   - users (la row elle-même)
//   - profiles (multi-profils)
//   - push_subscriptions (notifications)
//   - daily_rituals
//   - onboarding_progress
//   - horoscope_favorites (Feature 5)
//   - journal_entries
//   - stripe_events (idempotence) — uniquement ceux du userId
//   - gamification_* (streak, achievements) — best-effort
//
// Le token JWT devient inutilisable après suppression (user introuvable en DB).
app.delete('/api/account', auth, (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

  // Vérifie existence du compte avant suppression (compte peut avoir été
  // supprimé via une autre session, ou token volé d'un compte effacé).
  try {
    const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
    if (!exists) return res.status(401).json({ error: 'Compte introuvable. Reconnecte-toi.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur vérification compte.' });
  }

  try {
    const tx = db.transaction(() => {
      // 1. Cascade explicite — toutes les tables liées à ce user
      const tables = [
        'profiles',
        'push_subscriptions',
        'daily_rituals',
        'onboarding_progress',
        'horoscope_favorites',
        'journal_entries',
        'user_xp',
        'daily_quests',
        'user_badges',
        'xp_log',
        'astro_portraits',
        'horoscope_feedback',
      ];
      for (const t of tables) {
        try {
          db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
        } catch (err) {
          // Table inexistante (migration pas encore passée) — non bloquant
          console.warn(`[delete-account] table ${t} skip:`, err.message);
        }
      }
      // 2. Stripe events référencés — best-effort, ne plante pas si vide
      try { db.prepare('DELETE FROM stripe_events WHERE type LIKE ?').run(`%${userId}%`); }
      catch (err) { console.warn('[delete-account] stripe_events skip:', err.message); }
      // 3. Gamification tables — essayer plusieurs noms courants
      for (const gt of ['gamification_achievements', 'gamification_streaks', 'gamification_xp']) {
        try { db.prepare(`DELETE FROM ${gt} WHERE user_id = ?`).run(userId); }
        catch { /* table inexistante — OK */ }
      }
      // 4. L'utilisateur lui-même
      const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      if (result.changes === 0) {
        throw new Error('Compte introuvable.');
      }
      return result.changes;
    });
    const deleted = tx();
    console.log(`[delete-account] ✅ Compte user ${userId} supprimé (${deleted} row)`);
    return res.json({ ok: true, deletedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[delete-account] ❌', err.message);
    return res.status(500).json({ error: 'Suppression impossible. Réessaie ou contacte le support.' });
  }
});

// ─── Multi-profile CRUD (Feature 8) ────────────────────────
// List all profiles (own natal + saved family/friends)
app.get('/api/profiles', auth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, relation, birth_data, is_self, created_at FROM profiles WHERE user_id = ? ORDER BY is_self DESC, created_at ASC'
  ).all(req.user.id);
  res.json({
    profiles: rows.map(r => ({
      id: r.id,
      name: r.name,
      relation: r.relation,
      isSelf: !!r.is_self,
      birthData: safeJsonParse(r.birth_data, null, `profile #${r.id} birth_data`),
      createdAt: r.created_at,
    })),
  });
});

// Create a new profile
app.post('/api/profiles', auth, (req, res) => {
  const { name, relation, birthData, isSelf } = req.body || {};
  if (!name || !birthData) return res.status(400).json({ error: 'name and birthData are required' });
  const safeName = String(name).slice(0, 60).trim();
  const safeRelation = ['self', 'family', 'friend', 'partner', 'child', 'other'].includes(relation) ? relation : 'other';
  if (!birthData.date || !birthData.time || !birthData.city) {
    return res.status(400).json({ error: 'birthData must include date, time, city' });
  }
  const cleanBd = {
    date: birthData.date,
    time: birthData.time,
    city: birthData.city,
    country: birthData.country || '',
    latitude: Number(birthData.latitude) || 0,
    longitude: Number(birthData.longitude) || 0,
    timezone: Number(birthData.timezone) || 0,
  };
  // Uniqueness: only one is_self per user
  if (isSelf) {
    db.prepare('UPDATE profiles SET is_self = 0 WHERE user_id = ?').run(req.user.id);
  }
  const result = db.prepare(
    'INSERT INTO profiles (user_id, name, relation, birth_data, is_self) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, safeName, safeRelation, JSON.stringify(cleanBd), isSelf ? 1 : 0);
  res.json({ ok: true, id: result.lastInsertRowid });
});

// Update a profile
app.put('/api/profiles/:id', auth, (req, res) => {
  const profileId = parseInt(req.params.id, 10);
  if (!Number.isFinite(profileId)) return res.status(400).json({ error: 'Invalid profile id' });
  const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Profile not found' });
  const { name, relation, birthData, isSelf } = req.body || {};
  const newName = name ? String(name).slice(0, 60).trim() : existing.name;
  const newRelation = relation && ['self', 'family', 'friend', 'partner', 'child', 'other'].includes(relation) ? relation : existing.relation;
  let newBd = existing.birth_data;
  if (birthData) {
    if (!birthData.date || !birthData.time || !birthData.city) {
      return res.status(400).json({ error: 'birthData must include date, time, city' });
    }
    newBd = JSON.stringify({
      date: birthData.date,
      time: birthData.time,
      city: birthData.city,
      country: birthData.country || '',
      latitude: Number(birthData.latitude) || 0,
      longitude: Number(birthData.longitude) || 0,
      timezone: Number(birthData.timezone) || 0,
    });
  }
  if (isSelf) {
    db.prepare('UPDATE profiles SET is_self = 0 WHERE user_id = ? AND id != ?').run(req.user.id, profileId);
  }
  const newIsSelf = isSelf === undefined ? existing.is_self : (isSelf ? 1 : 0);
  db.prepare('UPDATE profiles SET name = ?, relation = ?, birth_data = ?, is_self = ? WHERE id = ?').run(
    newName, newRelation, newBd, newIsSelf, profileId
  );
  res.json({ ok: true });
});

// Delete a profile
app.delete('/api/profiles/:id', auth, (req, res) => {
  const profileId = parseInt(req.params.id, 10);
  if (!Number.isFinite(profileId)) return res.status(400).json({ error: 'Invalid profile id' });
  const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Profile not found' });
  db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
  res.json({ ok: true });
});

// Get a single profile with birth data (for re-use in other endpoints)
app.get('/api/profiles/:id', auth, (req, res) => {
  const profileId = parseInt(req.params.id, 10);
  if (!Number.isFinite(profileId)) return res.status(400).json({ error: 'Invalid profile id' });
  const r = db.prepare('SELECT id, name, relation, birth_data, is_self, created_at FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
  if (!r) return res.status(404).json({ error: 'Profile not found' });
  res.json({
    id: r.id,
    name: r.name,
    relation: r.relation,
    isSelf: !!r.is_self,
    // P0 #5 — Guard contre birth_data NULL (profil créé sans données).
    birthData: safeJsonParse(r.birth_data, null, `partner profile #${r.id} birth_data`),
    createdAt: r.created_at,
  });
});

// ─── Horoscope (LLM-powered, PERSONAL cache per sun+moon+rising+date) ───────
// Architecture P2: cache personnalisé (sun, moon, rising, date) ≈ 1728 combos max.
// Le LLM reçoit TOUTES les positions natales → le cache doit refléter cette personnalité.
// Fallback: si pas de cache perso, on essaie le cache global (sun, date) puis LLM.
app.post('/api/horoscope', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Birth data required' });

    const now = Date.now();
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);

    const today = localISODate();

    // Per-user cache hit (legacy horoscope_cache table)
    const userCached = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, today);
    if (userCached) {
      const streak = updateStreak(req.user.id, today);
      return res.json({ ...safeJsonParse(userCached.content, {}, 'horoscope_cache.content'), streak });
    }

    const birthData = safeJsonParse(user.birth_data, null, 'horoscope birth_data');
    if (!birthData) return res.status(400).json({ error: 'No valid birth data. Please update your profile.' });
    const natalPositions = getNatalPositions(birthData);
    const transits = getTransits(new Date());
    const sunSign = natalPositions.sun.sign;
    const moonSign = natalPositions.moon?.sign || 'unknown';
    const risingSign = natalPositions.ascendant?.sign || 'unknown';
    const transitsStr = JSON.stringify(transits);

    // ── Tier 1: PERSONAL cache (sun + moon + rising + date) ──
    const personalCached = db.prepare(
      'SELECT content FROM horoscope_personal_daily WHERE sun_sign = ? AND moon_sign = ? AND rising_sign = ? AND date = ?'
    ).get(sunSign, moonSign, risingSign, today);

    let horoscope;
    let usedFallbackLLM = false;

    if (personalCached) {
      console.log(`[horoscope] personal hit (sun=${sunSign}, moon=${moonSign}, rising=${risingSign}, date=${today})`);
      const base = JSON.parse(personalCached.content);
      horoscope = personalizeHoroscope(base, natalPositions, transits, birthData);
    } else {
      // ── Tier 2: LLM generation with graceful fallback ──
      console.log(`[horoscope] LLM miss (sun=${sunSign}, moon=${moonSign}, rising=${risingSign}, date=${today})`);
      let base;
      try {
        base = await generateHoroscope(natalPositions, transits, sunSign);
      } catch (llmErr) {
        console.warn(`[horoscope] LLM failed (${llmErr.message}), using FALLBACK for sign=${sunSign}`);
        base = { ...FALLBACK_HOROSCOPES[sunSign] || FALLBACK_HOROSCOPES.Aries, isFallback: true };
        usedFallbackLLM = true;
      }

      // Persist PERSONAL cache (sun + moon + rising + date)
      try {
        db.prepare(`INSERT OR IGNORE INTO horoscope_personal_daily
          (sun_sign, moon_sign, rising_sign, date, transits, content) VALUES (?, ?, ?, ?, ?, ?)`).run(
          sunSign, moonSign, risingSign, today, transitsStr, JSON.stringify(base),
        );
      } catch (e) {
        console.warn('[horoscope] personal cache write failed:', e.message);
      }

      // Also persist in global cache for week view / other users with same sun sign
      try {
        db.prepare(`INSERT OR IGNORE INTO horoscope_global_daily
          (sun_sign, date, transits, content) VALUES (?, ?, ?, ?)`).run(
          sunSign, today, transitsStr, JSON.stringify(base),
        );
      } catch (e) {
        console.warn('[horoscope] global cache write failed:', e.message);
      }

      horoscope = personalizeHoroscope(base, natalPositions, transits, birthData);
    }

    // Free-tier gate (only when we actually generated a fresh horoscope)
    if (!isPremium && !personalCached) {
      if ((user.scans_remaining ?? 0) <= 0) {
        return res.status(402).json({ error: 'Free scans exhausted', code: 'paywall_required', scansRemaining: 0 });
      }
      db.prepare('UPDATE users SET scans_remaining = scans_remaining - 1 WHERE id = ?').run(req.user.id);
    }

    // Per-user cache for fast subsequent loads
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content) VALUES (?, ?, ?)')
      .run(req.user.id, today, JSON.stringify(horoscope));

    const streak = updateStreak(req.user.id, today);
    const remaining = isPremium ? null : Math.max(0, (user.scans_remaining ?? 0) - (personalCached ? 0 : 1));
    res.json({ ...horoscope, scansRemaining: remaining, streak });
  } catch (err) {
    console.error('Horoscope error:', err.message);
    res.status(500).json({ error: 'Failed to generate horoscope', detail: err.message });
  }
});

// ─── Horoscope Week (7-day summary view) ──────────────────
// Premium: 7 days | Free: 3 days (J-1 to J+1)
app.get('/api/horoscope/week', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Birth data required' });

    const now = Date.now();
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);

    const days = isPremium ? 7 : 3; // Free gets J-1..J+1, Premium gets J-3..J+3
    const offsetStart = isPremium ? -3 : -1;
    const offsetEnd = isPremium ? 3 : 1;

    const birthData = safeJsonParse(user.birth_data, null, 'weekly-horoscope birth_data');
    if (!birthData) return res.status(400).json({ error: 'No valid birth data. Please update your profile.' });
    const natalPositions = getNatalPositions(birthData);
    const sunSign = natalPositions.sun.sign;

    const results = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First, hydrate from cache for all requested days (one round-trip)
    for (let offset = offsetStart; offset <= offsetEnd; offset++) {
      const day = new Date(today);
      day.setDate(today.getDate() + offset);
      const isoDate = day.toISOString().split('T')[0];

      // P0 #2 — Schéma corrigé : colonne 'content' (et non 'summary').
      const cached = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, isoDate);
      if (cached?.content) {
        results.push({
          date: isoDate,
          offset,
          weekday: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
          summary: safeJsonParse(cached.content, null, 'horoscope_daily_cache'),
          cached: true,
        });
      }
    }

    // Compute which days still need generation
    const haveDate = new Set(results.map(r => r.date));
    const missing = [];
    for (let offset = offsetStart; offset <= offsetEnd; offset++) {
      const day = new Date(today);
      day.setDate(today.getDate() + offset);
      const isoDate = day.toISOString().split('T')[0];
      if (!haveDate.has(isoDate)) missing.push({ offset, isoDate, day });
    }

    // Generate missing summaries sequentially (avoids 429 burst)
    // Premium-only: free users must hit /api/horoscope first to start trial
    if (missing.length > 0 && isPremium) {
      for (const { offset, isoDate, day } of missing) {
        try {
          const transits = getTransits(day);
          const dateLabel = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
          const summary = await generateHoroscopeSummary(natalPositions, transits, sunSign, dateLabel);

          // Save to cache (upsert: keep existing content if any)
          const existing = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, isoDate);
          if (existing) {
            db.prepare('UPDATE horoscope_cache SET summary = ? WHERE user_id = ? AND date = ?')
              .run(JSON.stringify(summary), req.user.id, isoDate);
          } else {
            db.prepare('INSERT INTO horoscope_cache (user_id, date, content, summary) VALUES (?, ?, ?, ?)')
              .run(req.user.id, isoDate, '{}', JSON.stringify(summary));
          }

          results.push({
            date: isoDate,
            offset,
            weekday: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
            summary,
            cached: false,
          });
        } catch (err) {
          console.warn(`[week] skip ${isoDate}: ${err.message}`);
          results.push({
            date: isoDate,
            offset,
            weekday: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
            summary: null,
            cached: false,
            error: err.message,
          });
        }
      }
    }

    // Sort by date
    results.sort((a, b) => a.offset - b.offset);

    res.json({
      days: results,
      isPremium,
      rangeDays: days,
      generated: missing.filter(m => !results.find(r => r.date === m.isoDate && r.error)).length,
    });
  } catch (err) {
    console.error('Week horoscope error:', err.message);
    res.status(500).json({ error: 'Failed to generate week', detail: err.message });
  }
});

// ─── Tarot — Daily Draw (LLM-powered, cached per day) ─────
const TAROT_DECK = [
  { id: 0, name: 'Le Fou', roman: '0', emoji: '🃏', archetype: 'Liberté, commencement, spontanéité', upright: 'Un nouveau départ t\'appelle. Ose le saut.', reversed: 'L\'impulsivité risque de t\'égarer.' },
  { id: 1, name: 'Le Bateleur', roman: 'I', emoji: '🎩', archetype: 'Créativité, habileté, initiative', upright: 'Tu as tous les outils en main.', reversed: 'Attention aux illusions.' },
  { id: 2, name: 'La Papesse', roman: 'II', emoji: '🌙', archetype: 'Intuition, savoir caché, mystère', upright: 'Écoute ta voix intérieure.', reversed: 'Tu ignores ta sagesse.' },
  { id: 3, name: 'L\'Impératrice', roman: 'III', emoji: '👑', archetype: 'Fécondité, abondance, création', upright: 'La créativité coule.', reversed: 'Un blocage créatif.' },
  { id: 4, name: 'L\'Empereur', roman: 'IV', emoji: '🏛️', archetype: 'Autorité, structure, maîtrise', upright: 'Prends les rennes.', reversed: 'La rigidité te limite.' },
  { id: 5, name: 'Le Pape', roman: 'V', emoji: '🔑', archetype: 'Sagesse, enseignement, spiritualité', upright: 'Un guide croise ton chemin.', reversed: 'Remets en question les croyances.' },
  { id: 6, name: 'L\'Amoureux', roman: 'VI', emoji: '💕', archetype: 'Choix du cœur, union, dualité', upright: 'Un choix de cœur se présente.', reversed: 'Une indécision sentimentale.' },
  { id: 7, name: 'Le Chariot', roman: 'VII', emoji: '⚔️', archetype: 'Victoire, volonté, maîtrise', upright: 'Ta détermination mène à la victoire.', reversed: 'L\'agitation te disperse.' },
  { id: 8, name: 'La Justice', roman: 'VIII', emoji: '⚖️', archetype: 'Équilibre, vérité, justesse', upright: 'L\'équité prévaut.', reversed: 'Un déséquilibre à corriger.' },
  { id: 9, name: 'L\'Ermite', roman: 'IX', emoji: '🏮', archetype: 'Introspection, retraite, lumière intérieure', upright: 'Ta lumière intérieure guide.', reversed: 'L\'isolement devient repli.' },
  { id: 10, name: 'La Roue de Fortune', roman: 'X', emoji: '🎡', archetype: 'Cycles, destin, changement', upright: 'La roue tourne en ta faveur.', reversed: 'Un cycle se ferme.' },
  { id: 11, name: 'La Force', roman: 'XI', emoji: '🦁', archetype: 'Courage, douceur, maîtrise de soi', upright: 'Ta force intérieure dompte les obstacles.', reversed: 'Le doute affaiblit.' },
  { id: 12, name: 'Le Pendu', roman: 'XII', emoji: '🙃', archetype: 'Lâcher prise, vision nouvelle', upright: 'Vois les choses autrement.', reversed: 'La stagnation te frustre.' },
  { id: 13, name: 'L\'Arcane sans nom', roman: 'XIII', emoji: '🦋', archetype: 'Transformation, fin, renaissance', upright: 'Une transformation profonde est en cours.', reversed: 'Tu résistes à une fin nécessaire.' },
  { id: 14, name: 'Tempérance', roman: 'XIV', emoji: '🕊️', archetype: 'Harmonie, patience, alchimie', upright: 'Trouvez le juste milieu.', reversed: 'L\'excès déséquilibre.' },
  { id: 15, name: 'Le Diable', roman: 'XV', emoji: '🔥', archetype: 'Désir, attachement, ombre', upright: 'Confronte tes peurs.', reversed: 'Tu te libères d\'une chaîne.' },
  { id: 16, name: 'La Maison Dieu', roman: 'XVI', emoji: '⚡', archetype: 'Changement soudain, révélation', upright: 'Un éclair de vérité bouscule.', reversed: 'Tu évites un changement.' },
  { id: 17, name: 'L\'Étoile', roman: 'XVII', emoji: '⭐', archetype: 'Espoir, inspiration, guidance', upright: 'L\'espoir revient.', reversed: 'Le découragement voile.' },
  { id: 18, name: 'La Lune', roman: 'XVIII', emoji: '🌛', archetype: 'Illusion, rêves, inconscient', upright: 'Tes rêves contiennent des messages.', reversed: 'Les peurs se dissipent.' },
  { id: 19, name: 'Le Soleil', roman: 'XIX', emoji: '🌞', archetype: 'Joie, succès, vitalité', upright: 'La joie et le succès rayonnent.', reversed: 'Une ombre voile l\'enthousiasme.' },
  { id: 20, name: 'Le Jugement', roman: 'XX', emoji: '📯', archetype: 'Renaissance, appel, rédemption', upright: 'Un appel à t\'élever.', reversed: 'Un doute persiste.' },
  { id: 21, name: 'Le Monde', roman: 'XXI', emoji: '🌍', archetype: 'Achèvement, plénitude, accomplissement', upright: 'Un cycle s\'achève dans la plénitude.', reversed: 'La finalité est proche.' },
];

app.get('/api/tarot/daily', auth, llmLimiter, async (req, res) => {
  const today = localISODate(); // Hoisted out of try so catch can use it
  let sunSign = 'inconnu';      // Hoisted so catch fallback works
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    // Check cache
    const cached = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, `tarot:${today}`);
    if (cached) return res.json(safeJsonParse(cached.content, null, 'tarot_cache'));

    // Deterministic daily card: hash of userId + date
    const seed = (req.user.id * 9301 + today.split('-').reduce((a, p) => a + parseInt(p), 0) * 49297) % 233280;
    const cardId = seed % 22;
    const isReversed = seed % 3 === 0; // ~33% chance reversed
    const card = TAROT_DECK[cardId];

    // Get user's sun sign for personalization
    if (user?.birth_data) {
      const bd = safeJsonParse(user.birth_data, null, 'llm sun sign birth_data');
      if (bd) {
        try {
          const natal = getNatalPositions(bd);
          sunSign = natal.sun?.sign || 'inconnu';
        } catch (err) {
          console.warn('[llm] sun sign compute failed:', err.message);
        }
      }
    }

    // LLM interpretation
    const systemPrompt = celesteSystemPrompt("Tu tires les cartes avec tendresse et justesse. Tes interprétations sont courtes, poétiques, humaines — jamais hermétiques. Tu écris en français.");
    const userPrompt = `Carte tirée: ${card.name} (${card.roman})${isReversed ? ' — position inversée' : ' — position droite'}.
Signe solaire de la personne: ${sunSign}.
Mots-clés: ${card.archetype}.

Génère en JSON:
{
  "cardName": "${card.name}",
  "cardId": ${card.id},
  "roman": "${card.roman}",
  "emoji": "${card.emoji}",
  "isReversed": ${isReversed},
  "archetype": "${card.archetype}",
  "message": "2 phrases courtes et poétiques résumant l'énergie de la carte pour aujourd'hui",
  "question": "une question de réflexion ouverte pour la journée",
  "reading": "Un paragraphe détaillé (100-150 mots) reliant cette carte à ton signe (${sunSign}), aux transits du moment, et à ce que cette énergie signifie concrètement pour ta journée. Des conseils pratiques, des choses à surveiller. Écris comme une amie qui te parle — pas de jargon, pas de style hermétique."
}

Réponds UNIQUEMENT avec le JSON.`;

    const data = await callLLMWithRetry([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 2);
    const msg = data.choices?.[0]?.message || {};
    const content = msg.content || msg.reasoning_content || '';
    let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    let result;
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback: static card data
      result = {
        cardName: card.name, cardId: card.id, roman: card.roman, emoji: card.emoji,
        isReversed, archetype: card.archetype,
        message: isReversed ? card.reversed : card.upright,
        question: 'Que te dit cette carte aujourd\'hui ?',
        reading: `${card.archetype}. ${isReversed ? card.reversed : card.upright} En tant que ${sunSign}, cette énergie résonne particulièrement avec ton chemin solaire. Les configurations du moment t'invitent à intégrer pleinement ce message dans ta journée.`,
      };
    }

    // Ensure fields exist
    result.cardId ??= card.id;
    result.roman ??= card.roman;
    result.emoji ??= card.emoji;
    result.isReversed ??= isReversed;
    result.archetype ??= card.archetype;
    result.message ??= isReversed ? card.reversed : card.upright;
    result.question ??= 'Que te dit cette carte aujourd\'hui ?';
    result.reading ??= `${card.archetype}. ${isReversed ? card.reversed : card.upright} En tant que ${sunSign}, cette énergie résonne avec ton chemin solaire. Les configurations planétaires du moment amplifient cette influence : laisse-la guider tes choix de la journée.`;

    // Cache for the day
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content) VALUES (?, ?, ?)')
      .run(req.user.id, `tarot:${today}`, JSON.stringify(result));

    res.json(result);
  } catch (err) {
    console.error('Tarot error:', err.message);
    // Fallback: return static card data so the app never crashes
    const fbCardId = (() => {
      const u = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(req.user.id);
      const seed = u?.birth_data ? Array.from(u.birth_data + today).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) : Math.floor(Math.random() * 22);
      return seed % 22;
    })();
    const fbIsReversed = fbCardId % 3 === 0;
    const fallbackCard = TAROT_DECK[fbCardId];
    const fbSun = typeof sunSign !== 'undefined' ? sunSign : 'inconnu';
    const fallbackResult = {
      cardName: fallbackCard.name,
      cardId: fallbackCard.id,
      roman: fallbackCard.roman,
      emoji: fallbackCard.emoji,
      isReversed: fbIsReversed,
      archetype: fallbackCard.archetype,
      message: fbIsReversed ? fallbackCard.reversed : fallbackCard.upright,
      question: 'Que te dit cette carte aujourd\'hui ?',
      reading: `${fallbackCard.archetype}. ${fbIsReversed ? fallbackCard.reversed : fallbackCard.upright} En tant que ${fbSun}, cette énergie résonne avec ton chemin solaire. Les configurations planétaires du moment amplifient cette influence : laisse-la guider tes choix de la journée.`,
    };
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content) VALUES (?, ?, ?)')
      .run(req.user.id, `tarot:${today}`, JSON.stringify(fallbackResult));
    res.json(fallbackResult);
  }
});

// ─── Compatibility (LLM-powered) ───────────────────────────
app.post('/api/compatibility', auth, llmLimiter, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Your birth data required' });

    // Premium expiry check
    const now = Date.now();
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);

// P0 #3 + #9 — Décrément APRÈS succès LLM (pas avant) + clamp à 0.
    let scansRemaining = null;
    if (!isPremium) {
      if ((user.scans_remaining ?? 0) <= 0) {
        return res.status(402).json({ error: 'Free scans exhausted', code: 'paywall_required', scansRemaining: 0 });
      }
      scansRemaining = Math.max(0, (user.scans_remaining ?? 1) - 1);
    }

    const { partnerBirthData, context } = req.body;
    if (!partnerBirthData) return res.status(400).json({ error: 'Partner birth data required' });

    // Validate context (default romantic)
    const validContexts = ['romantic', 'family', 'friend', 'colleague'];
    const ctx = validContexts.includes(context) ? context : 'romantic';

    // Lightweight validation of partner birth data
    if (typeof partnerBirthData !== 'object' ||
        !partnerBirthData.date || !/^\d{4}-\d{2}-\d{2}$/.test(partnerBirthData.date) ||
        !partnerBirthData.time || !/^\d{2}:\d{2}$/.test(partnerBirthData.time) ||
        typeof partnerBirthData.latitude !== 'number' || Math.abs(partnerBirthData.latitude) > 90 ||
        typeof partnerBirthData.longitude !== 'number' || Math.abs(partnerBirthData.longitude) > 180) {
      return res.status(400).json({ error: 'Invalid partner birth data format' });
    }

    const userBd = safeJsonParse(user.birth_data, null, 'compat route user birth_data');
    if (!userBd) return res.status(400).json({ error: 'No valid birth data. Please update your profile.' });
    const chart1 = getNatalPositions(userBd);
    const chart2 = getNatalPositions(partnerBirthData);

    const result = await generateCompatibility(chart1, chart2, chart1.sun.sign, chart2.sun.sign, ctx);

    // P0 #3 — Décrément conditionné au succès du LLM.
    if (!isPremium && scansRemaining !== null) {
      db.prepare('UPDATE users SET scans_remaining = ? WHERE id = ?').run(scansRemaining, req.user.id);
    }

    res.json({
      ...result,
      context: ctx,
      yourSun: chart1.sun.sign,
      theirSun: chart2.sun.sign,
      yourMoon: chart1.moon.sign,
      theirMoon: chart2.moon.sign,
      scansRemaining: isPremium ? null : scansRemaining,
    });
  } catch (err) {
    console.error('Compatibility error:', err.message);
    res.status(500).json({ error: 'Failed', detail: err.message });
  }
});

// ─── Journal ───────────────────────────────────────────────
app.get('/api/journal', auth, (req, res) => {
  const entries = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90').all(req.user.id);
  res.json(entries.map(e => ({
    id: e.id, date: e.date, horoscopeSummary: e.horoscope_summary,
    userNote: e.user_note, userRating: e.user_rating,
  })));
});

app.post('/api/journal', auth, (req, res) => {
  const { date, horoscopeSummary, userNote, userRating } = req.body;
  const id = `${req.user.id}-${date}`;
  db.prepare(`INSERT OR REPLACE INTO journal_entries (id, user_id, date, horoscope_summary, user_note, user_rating)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, req.user.id, date, horoscopeSummary, userNote, userRating || 0);
  res.json({ ok: true });
});

// ─── Premium status ────────────────────────────────────────
// ⚠️ Cet endpoint est DÉSACTIVÉ. Le premium ne peut plus être activé
// que par le webhook Stripe après un vrai paiement. Garde la route
// pour renvoyer un message clair à un éventuel client obsolète.
app.post('/api/premium/activate', auth, (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: 'Les paiements ne sont pas encore configurés sur cette instance.',
      code: 'stripe_not_configured',
    });
  }
  return res.status(402).json({
    error: 'Cet endpoint est désactivé. Utilise POST /api/billing/create-checkout pour t\'abonner.',
    code: 'use_checkout_endpoint',
  });
});

// ─── Billing routes (Stripe) ───────────────────────────────
// /status est public (le frontend veut savoir si Stripe est configuré sans auth)
// /create-checkout, /portal, /verify-session sont protégés par auth (dans le router)
app.get('/api/billing/status', (req, res) => res.json({ configured: isStripeConfigured() }));
app.use('/api/billing', auth, billingRouter);

// ─── Web Push endpoints ────────────────────────────────────
// Public endpoint — frontend needs the public key to subscribe
app.get('/api/notifications/vapid-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.get('/api/notifications/status', auth, (req, res) => {
  const u = db.prepare('SELECT notification_hour, last_notification_date FROM users WHERE id = ?').get(req.user.id);
  const subs = db.prepare('SELECT COUNT(*) as n FROM push_subscriptions WHERE user_id = ?').get(req.user.id);
  res.json({
    enabled: subs.n > 0,
    subscriptionCount: subs.n,
    hour: u?.notification_hour ?? 9,
    lastSent: u?.last_notification_date || null,
  });
});

app.post('/api/notifications/subscribe', auth, async (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push not configured' });
  const { subscription, hour, timezone } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  try {
    db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, user_agent = excluded.user_agent
    `).run(req.user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, req.headers['user-agent'] || '');
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      // Fix #6 — sauvegarder le TZ en parallèle de l'heure pour que le cron notifie à l'heure locale
      const tz = (typeof timezone === 'number' && timezone >= -12 && timezone <= 14) ? timezone : 0;
      db.prepare('UPDATE users SET notification_hour = ?, notification_timezone = ? WHERE id = ?').run(hour, tz, req.user.id);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err.message);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

app.delete('/api/notifications/unsubscribe', auth, (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(req.user.id, endpoint);
  } else {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.user.id);
  }
  res.json({ ok: true });
});

app.patch('/api/notifications/preferences', auth, (req, res) => {
  const { hour } = req.body || {};
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return res.status(400).json({ error: 'hour must be 0-23' });
  }
  db.prepare('UPDATE users SET notification_hour = ? WHERE id = ?').run(hour, req.user.id);
  res.json({ ok: true });
});

// Send test notification to current user (all their devices)
app.post('/api/notifications/test', auth, async (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push not configured' });
  const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(req.user.id);
  if (subs.length === 0) return res.status(404).json({ error: 'No active subscription' });
  const payload = JSON.stringify({
    title: '✨ Céleste — test',
    body: 'Si tu lis ceci, les notifications marchent. 🌙',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    url: '/',
  });
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }, payload)));
  const sent = results.filter(r => r.status === 'fulfilled').length;
  // Cleanup dead subs (410 Gone)
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subs[i].endpoint);
    }
  });
  res.json({ sent, total: subs.length });
});

// ─── Transits of the day (Feature 6) ─────────────────────────
app.get('/api/transits/today', auth, (req, res) => {
  try {
    const now = new Date();
    const date = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      now.getUTCHours(), now.getUTCMinutes()
    ));
    const transits = getTransits(date);
    res.json({ date: date.toISOString(), transits });
  } catch (err) {
    console.error('transits error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Daily Aspects (Feature 9) ───────────────────────────────
// Cache table for the day's planetary aspects (LLM-generated, refreshed daily)
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_aspects_cache (
    date TEXT PRIMARY KEY,
    aspects_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const PLANET_NAMES_FR = {
  sun: 'Soleil', moon: 'Lune', mercury: 'Mercure', venus: 'Vénus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne', uranus: 'Uranus',
  neptune: 'Neptune', pluto: 'Pluton'
};
const ASPECT_NAMES_FR = {
  conjunction: 'conjonction', opposition: 'opposition', trine: 'trigone',
  square: 'carré', sextile: 'sextile', quincunx: 'quinconce'
};
const ASPECT_GLYPHS = {
  conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹', quincunx: '⚻'
};
const PLANET_GLYPHS = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇'
};

// Geometrically compute major aspects between planets for a given date
function computeDailyAspects(date) {
  const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const aspects = [];
  const aspectDefs = [
    { name: 'conjunction', angle: 0, orb: 6, nature: 'neutre' },
    { name: 'opposition', angle: 180, orb: 6, nature: 'tension' },
    { name: 'trine', angle: 120, orb: 5, nature: 'harmonique' },
    { name: 'square', angle: 90, orb: 5, nature: 'tension' },
    { name: 'sextile', angle: 60, orb: 4, nature: 'harmonique' }
  ];
  // Get current positions in ecliptic longitude (0-360°)
  const rot = Rotation_EQJ_ECL(date);
  const positions = {};
  for (const p of planets) {
    const body = p === 'sun' ? Body.Sun
      : p === 'moon' ? Body.Moon
      : p === 'mercury' ? Body.Mercury
      : p === 'venus' ? Body.Venus
      : p === 'mars' ? Body.Mars
      : p === 'jupiter' ? Body.Jupiter
      : p === 'saturn' ? Body.Saturn : null;
    if (!body) continue;
    const eqVec = GeoVector(body, date, true);
    const eclVec = RotateVector(rot, eqVec);
    const lon = (Math.atan2(eclVec.y, eclVec.x) * 180 / Math.PI + 360) % 360;
    positions[p] = lon;
  }
  // Pairwise aspects
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = positions[planets[i]];
      const b = positions[planets[j]];
      if (a == null || b == null) continue;
      let diff = Math.abs(a - b);
      if (diff > 180) diff = 360 - diff;
      for (const def of aspectDefs) {
        if (Math.abs(diff - def.angle) <= def.orb) {
          aspects.push({
            p1: planets[i], p2: planets[j],
            aspect: def.name,
            nature: def.nature,
            orb: Math.round((Math.abs(diff - def.angle)) * 10) / 10
          });
          break;
        }
      }
    }
  }
  // Sort: tensions first (most actionable), then harmonics, then neutrals
  const natureOrder = { tension: 0, harmonique: 1, neutre: 2 };
  aspects.sort((x, y) => natureOrder[x.nature] - natureOrder[y.nature]);
  return aspects.slice(0, 5); // top 5
}

async function interpretAspects(aspects, date) {
  if (aspects.length === 0) return aspects;
  const lines = aspects.map((a, i) =>
    `${i + 1}. ${PLANET_NAMES_FR[a.p1]} ${ASPECT_NAMES_FR[a.aspect]} ${PLANET_NAMES_FR[a.p2]} (orbe ${a.orb}°, ${a.nature})`
  ).join('\n');
  const prompt = `Tu es Celeste, astrologue francophone bienveillante. Pour chaque aspect planétaire ci-dessous, écris une INTERPRÉTATION courte (1 phrase, 15-25 mots) et un CONSEIL actionnable (1 phrase, 10-20 mots).
Ton: chaleureux, moderne, terre-à-terre, jamais culpabilisant. Tu tutoies.
Retourne UNIQUEMENT un JSON valide, sans texte autour, exactement:
{"aspects":[{"i":1,"interprétation":"...","conseil":"..."},...]}
Le nombre d'éléments doit correspondre aux aspects fournis.
Date: ${date.toISOString().split('T')[0]}
${lines}`;
  try {
    const resp = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Be' + 'arer ' + LLM_API_KEY },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: celesteSystemPrompt("Tu interprètes les aspects astrologiques. Ton: chaleureux, moderne, terre-à-terre, jamais culpabilisant. Réponds uniquement en JSON valide.") },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });
    if (!resp.ok) throw new Error('LLM ' + resp.status);
    const data = await resp.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    const cleaned = text.replace(/^```json\n?/i, '').replace(/```$/i, '').trim();
    const parsed = safeJsonParse(cleaned, null, 'aspect-interpretation LLM response');
    if (!parsed || !Array.isArray(parsed.aspects)) {
      console.warn('[aspect-llm] Invalid JSON, falling back to generic');
      return aspects.map(a => ({
        ...a,
        p1Name: PLANET_NAMES_FR[a.p1] || a.p1,
        p2Name: PLANET_NAMES_FR[a.p2] || a.p2,
        interpretation: `${PLANET_NAMES_FR[a.p1] || a.p1} ${a.aspect.toLowerCase()} ${PLANET_NAMES_FR[a.p2] || a.p2} — énergie à canaliser aujourd'hui.`,
        advice: 'Prends un moment pour observer cette dynamique intérieure.',
      }));
    }
    return aspects.map((a, i) => ({
      ...a,
      p1Name: PLANET_NAMES_FR[a.p1], p2Name: PLANET_NAMES_FR[a.p2],
      p1Glyph: PLANET_GLYPHS[a.p1], p2Glyph: PLANET_GLYPHS[a.p2],
      aspectFr: ASPECT_NAMES_FR[a.aspect], aspectGlyph: ASPECT_GLYPHS[a.aspect],
      interpretation: parsed.aspects?.[i]?.interprétation || parsed.aspects?.[i]?.interpretation || '',
      conseil: parsed.aspects?.[i]?.conseil || ''
    }));
  } catch (err) {
    console.error('aspect LLM error:', err.message);
    // Fallback: return aspects without interpretation
    return aspects.map(a => ({
      ...a,
      p1Name: PLANET_NAMES_FR[a.p1], p2Name: PLANET_NAMES_FR[a.p2],
      p1Glyph: PLANET_GLYPHS[a.p1], p2Glyph: PLANET_GLYPHS[a.p2],
      aspectFr: ASPECT_NAMES_FR[a.aspect], aspectGlyph: ASPECT_GLYPHS[a.aspect],
      interpretation: '', conseil: ''
    }));
  }
}

app.get('/api/aspects/today', auth, async (req, res) => {
  try {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    // Check cache
    const cached = db.prepare('SELECT aspects_json FROM daily_aspects_cache WHERE date = ?').get(dateKey);
    if (cached) {
      const aspects = safeJsonParse(cached.aspects_json, [], 'daily_aspects_cache');
      return res.json({ date: dateKey, aspects, cached: true });
    }
    // Compute + interpret + cache
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0));
    const rawAspects = computeDailyAspects(date);
    const aspects = await interpretAspects(rawAspects, date);
    db.prepare('INSERT OR REPLACE INTO daily_aspects_cache (date, aspects_json) VALUES (?, ?)').run(
      dateKey, JSON.stringify(aspects)
    );
    res.json({ date: dateKey, aspects, cached: false });
  } catch (err) {
    console.error('aspects error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Favorites (Feature 5) ──────────────────────────────────
// Bookmark a phrase from any horoscope section
app.post('/api/favorites', auth, (req, res) => {
  const { date, section, content } = req.body || {};
  if (!date || !section || !content) {
    return res.status(400).json({ error: 'date, section, content required' });
  }
  if (content.length > 1000) return res.status(400).json({ error: 'content too long' });
  try {
    // Toggle: if exists, remove; else add
    const existing = db.prepare(
      'SELECT id FROM horoscope_favorites WHERE user_id = ? AND date = ? AND section = ?'
    ).get(req.user.id, date, section);
    if (existing) {
      db.prepare('DELETE FROM horoscope_favorites WHERE id = ?').run(existing.id);
      return res.json({ ok: true, action: 'removed', id: existing.id });
    }
    const result = db.prepare(
      'INSERT INTO horoscope_favorites (user_id, date, section, content) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, date, section, content);
    res.json({ ok: true, action: 'added', id: result.lastInsertRowid });
  } catch (err) {
    console.error('favorite error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// List user favorites (newest first)
app.get('/api/favorites', auth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const favorites = db.prepare(
    'SELECT id, date, section, content, created_at FROM horoscope_favorites WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(req.user.id, limit);
  res.json({ favorites });
});

// Delete a specific favorite by id
app.delete('/api/favorites/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  const result = db.prepare(
    'DELETE FROM horoscope_favorites WHERE id = ? AND user_id = ?'
  ).run(id, req.user.id);
  res.json({ ok: true, deleted: result.changes });
});

// Quick check: which sections of today are favorited (for UI stars)
app.get('/api/favorites/today', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const favs = db.prepare(
    'SELECT section FROM horoscope_favorites WHERE user_id = ? AND date = ?'
  ).all(req.user.id, today);
  res.json({ sections: favs.map(f => f.section) });
});

// ─── Asteroid positions (Feature B2) ───────────────────────
// Mean orbital elements at J2000 for main asteroids (simplified Kepler).
const ASTEROIDS = {
  chiron:  { name: 'Chiron',    theme: 'blessure guérisseuse',   a: 13.65, e: 0.379, i:  6.93, node: 209.3, argPeri: 339.8, M0:  92.3, period: 50.7  },
  ceres:   { name: 'Cérès',     theme: 'maternage et abondance', a:  2.77, e: 0.076, i: 10.59, node:  80.41, argPeri:  71.0, M0:  78.6, period: 4.60  },
  pallas:  { name: 'Pallas',    theme: 'sagesse et stratégie',   a:  2.77, e: 0.231, i: 34.84, node: 173.1, argPeri: 309.9, M0: 134.7, period: 4.61  },
  juno:    { name: 'Junon',     theme: 'partenariat et engagement', a: 2.67, e: 0.258, i: 12.98, node: 169.9, argPeri: 247.7, M0:  71.2, period: 4.36 },
  vesta:   { name: 'Vesta',     theme: 'dévouement et foyer',    a:  2.36, e: 0.088, i:  7.14, node: 103.9, argPeri: 149.8, M0: 109.7, period: 3.63  }
};

function solveKepler(M, e, tol = 1e-7) {
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

function asteroidEclipticLon(el, date) {
  const J2000 = Date.UTC(2000, 0, 1, 12);
  const years = (date.getTime() - J2000) / (365.25 * 86400000);
  const n = 360 / el.period;
  const iRad = el.i * Math.PI / 180;
  const nodeRad = el.node * Math.PI / 180;
  const argPeriRad = el.argPeri * Math.PI / 180;
  const M = (((el.M0 + n * years) % 360) + 360) % 360 * Math.PI / 180;
  const E = solveKepler(M, el.e);
  const xPrime = el.a * (Math.cos(E) - el.e);
  const yPrime = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const cN = Math.cos(nodeRad), sN = Math.sin(nodeRad);
  const cA = Math.cos(argPeriRad), sA = Math.sin(argPeriRad);
  const cI = Math.cos(iRad), sI = Math.sin(iRad);
  const xEcl = (cN * cA - sN * sA * cI) * xPrime + (-cN * sA - sN * cA * cI) * yPrime;
  const yEcl = (sN * cA + cN * sA * cI) * xPrime + (-sN * sA + cN * cA * cI) * yPrime;
  let lon = Math.atan2(yEcl, xEcl) * 180 / Math.PI;
  lon = ((lon % 360) + 360) % 360;
  return lon;
}

app.get('/api/chart/asteroids', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'birth_data missing' });
    const birth = safeJsonParse(user.birth_data, null, 'birth_data');
    if (!birth) return res.status(400).json({ error: 'Corrupted birth data. Please update your profile.' });
    const [y, m, d] = birth.date.split('-').map(Number);
    const [h, min] = (birth.time || '12:00').split(':').map(Number);
    const birthDate = new Date(Date.UTC(y, m - 1, d, h, min, 0));
    const positions = Object.entries(ASTEROIDS).map(([key, el]) => {
      const lon = asteroidEclipticLon(el, birthDate);
      const signInfo = degToSign(lon);
      return {
        key,
        name: el.name,
        theme: el.theme,
        sign: signInfo.sign,
        degree: Number(signInfo.degree.toFixed(2)),
        absDeg: Number(lon.toFixed(2))
      };
    });
    // LLM interpretation grouped
    const summary = positions.map(p => `${p.name} en ${p.sign} (${p.degree}°)`).join(', ');
    let interpretation = null;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(LLM_API_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Be' + 'arer ' + LLM_API_KEY },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: celesteSystemPrompt("Astrologue bienveillante. Réponds UNIQUEMENT en français, court (max 80 mots).") },
            { role: 'user', content: `Voici les placements natals d'astéroïdes d'un utilisateur : ${summary}. Donne une interprétation douce et synthétique reliant ces placements aux thèmes : blessure guérisseuse (Chiron), maternel/ressource (Cérès), stratégie (Pallas), engagement (Junon), foyer intérieur (Vesta). Sois concrète et personnelle.` }
          ],
          temperature: 0.7,
          max_tokens: 180
        })
      });
      clearTimeout(to);
      const dj = await r.json();
      interpretation = dj.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.warn('asteroids LLM fail (fallback null):', e?.name || e?.message);
    }
    res.json({
      positions,
      interpretation,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('asteroids error:', err?.message, err?.stack);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Lunar Nodes (Feature B3) ────────────────────────────────────
// North Node (Tête du Dragon) and South Node (Queue du Dragon) — karmic axis.
// True Node = (Sun geocentric ecliptic longitude) − (Moon geocentric ecliptic longitude)
// South Node is exactly 180° opposite the North Node.
app.get('/api/chart/lunar-nodes', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'birth_data missing' });
    const birth = safeJsonParse(user.birth_data, null, 'birth_data');
    if (!birth) return res.status(400).json({ error: 'Corrupted birth data. Please update your profile.' });
    const [y, m, d] = birth.date.split('-').map(Number);
    const [h, min] = (birth.time || '12:00').split(':').map(Number);
    const t = Astronomy.MakeTime(new Date(Date.UTC(y, m - 1, d, h, min, 0)));

    // Sun geocentric ecliptic longitude (Earth helio + 180°, see astronomy-engine-patterns)
    const sunLon = (((Astronomy.EclipticLongitude(Astronomy.Body.Earth, t) + 180) % 360) + 360) % 360;
    // Moon geocentric ecliptic longitude (built-in)
    const moonLon = Astronomy.EclipticLongitude(Astronomy.Body.Moon, t);
    // True North Node = Sun - Moon (mod 360)
    const northLon = (((sunLon - moonLon) % 360) + 360) % 360;
    const southLon = (((northLon + 180) % 360) + 360) % 360;

    const north = { ...degToSign(northLon), role: 'north' };
    const south = { ...degToSign(southLon), role: 'south' };

    // LLM interpretation with 8s timeout
    const summary = `Nœud Nord en ${north.sign} (${north.degree}°), Nœud Sud en ${south.sign} (${south.degree}°)`;
    let interpretation = null;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(LLM_API_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Be' + 'arer ' + LLM_API_KEY },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: celesteSystemPrompt("Astrologue bienveillante. Réponds UNIQUEMENT en français, court (max 70 mots).") },
            { role: 'user', content: `Voici les nœuds lunaires natals d'un utilisateur : ${summary}. Le Nœud Sud représente ce qu'il maîtrise déjà (passé, confort), le Nœud Nord représente ce vers quoi son âme veut évoluer (mission, croissance). Donne une interprétation douce reliant ces deux pôles à son chemin d'évolution.` }
          ],
          temperature: 0.7,
          max_tokens: 160
        })
      });
      clearTimeout(to);
      const dj = await r.json();
      interpretation = dj.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.warn('lunar-nodes LLM fail (fallback null):', e?.name || e?.message);
    }

    res.json({
      northNode: north,
      southNode: south,
      interpretation,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('lunar-nodes error:', err?.message, err?.stack);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Weekly Astro Challenge (Feature C3) ─────────────────
// ISO week id 'YYYY-Www' (1-53)
function isoWeekId(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;       // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of week
  const firstThursday = (year) => new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((date - firstThursday(date.getUTCFullYear())) / 86400000 - 3 + ((firstThursday(date.getUTCFullYear()).getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

app.get('/api/challenge/week', auth, async (req, res) => {
  try {
    const weekId = isoWeekId();
    const existing = db.prepare('SELECT * FROM weekly_challenges WHERE user_id = ? AND week_id = ?').get(req.user.id, weekId);
    if (existing) {
      return res.json({
        weekId,
        theme: existing.theme,
        action: existing.action,
        explanation: existing.explanation,
        completed: !!existing.completed,
        reflectionNote: existing.reflection_note,
        generatedAt: existing.created_at
      });
    }

    // Generate a new challenge for this user/week
    const user = db.prepare('SELECT birth_data, natal_chart FROM users WHERE id = ?').get(req.user.id);
    let ctx = '';
    try {
      const chart = user?.natal_chart ? safeJsonParse(user.natal_chart, null, 'users.natal_chart') : null;
      if (chart) ctx = `Thème natal : Soleil ${chart.sun || '?'}, Lune ${chart.moon || '?'}, Ascendant ${chart.rising || '?'}.`;
    } catch {}

    let theme = 'Ouverture', action = 'Dis « je t\'écoute » à quelqu\'un qui parle peu aujourd\'hui.', explanation = 'Une pause d\'écoute aide à laisser émerger ce qui cherche à être entendu.';
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(LLM_API_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Be' + 'arer ' + LLM_API_KEY },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: celesteSystemPrompt("Réponds UNIQUEMENT en JSON valide, sans markdown.") },
            { role: 'user', content: `${ctx}\nPropose un défi d'évolution spirituelle pour cette semaine (semaine ${weekId}). Réponds en JSON strict avec EXACTEMENT 3 clés: "theme" (1 mot thème astrologique: curiosité/vulnérabilité/lâcher-prise/etc), "action" (1 action concrète courte, <20 mots, et faisable en 1 jour), "explanation" (50 mots max: pourquoi ce défi).` }
          ],
          temperature: 0.85,
          max_tokens: 200
        })
      });
      clearTimeout(to);
      const dj = await r.json();
      const txt = dj.choices?.[0]?.message?.content || '';
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.theme) theme = String(parsed.theme).trim();
        if (parsed.action) action = String(parsed.action).trim();
        if (parsed.explanation) explanation = String(parsed.explanation).trim();
      }
    } catch (e) {
      console.warn('weekly-challenge LLM fail (using seed defaults):', e?.name || e?.message);
    }

    db.prepare('INSERT INTO weekly_challenges (user_id, week_id, theme, action, explanation) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, weekId, theme, action, explanation);

    res.json({
      weekId, theme, action, explanation,
      completed: false, reflectionNote: null,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('weekly-challenge error:', err?.message, err?.stack);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/challenge/week/complete', auth, async (req, res) => {
  try {
    const weekId = isoWeekId();
    const note = String(req.body?.note || '').slice(0, 600);
    const r = db.prepare(`UPDATE weekly_challenges
                          SET completed = 1, completed_at = ?, reflection_note = ?
                          WHERE user_id = ? AND week_id = ?`)
                 .run(new Date().toISOString(), note, req.user.id, weekId);
    if (r.changes === 0) return res.status(404).json({ error: 'No challenge for this week' });
    res.json({ ok: true });
  } catch (err) {
    console.error('weekly-challenge/complete error:', err?.message, err?.stack);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Astrological Houses (Feature B1) ────────────────────
// Equal House system: each house cusp is exactly 30° from Ascendant.
const ZODIAC_ARC_ORDER = [
  'Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'
];

function degToSign(deg) {
  const normDeg = ((deg % 360) + 360) % 360;
  const signIdx = Math.floor(normDeg / 30);
  const signDeg = normDeg - signIdx * 30;
  return { sign: ZODIAC_ARC_ORDER[signIdx], degree: signDeg, absDeg: normDeg };
}

function computeHouses(birth) {
  // Equal House system: only Ascendant needed; other cusps = Asc + (N-1)*30°.
  // Ascendant ≈ atan2(-cos(LST), sin(LST)*cos(ε) - tan(lat)*sin(ε))
  const [year, month, day] = birth.date.split('-').map(Number);
  const [hour, minute] = (birth.time || '12:00').split(':').map(Number);
  const obsLat = birth.lat ?? 48.85;
  const obsLng = birth.lng ?? 2.35;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const astroTime = MakeTime(date);
  const lstHours = SiderealTime(astroTime) + obsLng / 15;
  const obliquity = 23.4392911 * Math.PI / 180;
  const lstRad = (lstHours * 15) * Math.PI / 180;
  const latRad = obsLat * Math.PI / 180;
  const y = -Math.cos(lstRad);
  const x = Math.sin(lstRad) * Math.cos(obliquity) - Math.tan(latRad) * Math.sin(obliquity);
  let ascLon = Math.atan2(y, x) * 180 / Math.PI;
  ascLon = ((ascLon % 360) + 360) % 360;
  const asc = degToSign(ascLon);
  const houses = [];
  for (let i = 1; i <= 12; i++) {
    const cuspLon = (ascLon + (i - 1) * 30) % 360;
    houses.push({ num: i, ...degToSign(cuspLon) });
  }
  return { asc, houses };
}

const HOUSE_THEMES = {
  1: 'identité et apparence',
  2: 'valeurs et ressources',
  3: 'communication et entourage',
  4: 'foyer et racines',
  5: 'créativité et amour',
  6: 'travail et santé',
  7: 'partenariats et autres',
  8: 'transformation et héritage',
  9: 'philosophie et voyages',
  10: 'carrière et vocation',
  11: 'communauté et projets',
  12: 'intériorité et spiritualité'
};

async function interpretHouses(asc, sunSign) {
  const theme = HOUSE_THEMES[1];
  const prompt = `Tu es Celeste, astrologue chaleureuse. L'Ascendant natal d'un utilisateur est en ${asc.sign} (${asc.degree.toFixed(1)}°), son Soleil en ${sunSign}.
En 2 phrases max (40 mots), explique ce que l'Ascendant ${asc.sign} révèle sur sa manière d'aborder la vie, et quel est le conseil du jour lié à la maison 1 (${theme}).`;
  try {
    const r = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Be' + 'arer ' + LLM_API_KEY
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: celesteSystemPrompt("Astrologue bienveillante. Réponds UNIQUEMENT en français, court, jamais plus de 40 mots.") },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 120
      })
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

app.get('/api/chart/houses', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'birth_data missing' });
    const birth = safeJsonParse(user.birth_data, null, 'birth_data');
    if (!birth) return res.status(400).json({ error: 'Corrupted birth data. Please update your profile.' });
    const { asc, houses } = computeHouses(birth);
    // Compute sun sign from birth date if not stored
    let sunSign = birth.zodiacSign || 'unknown';
    if (sunSign === 'unknown' && birth.date) {
      const [y, m, d] = birth.date.split('-').map(Number);
      const [h, min] = (birth.time || '12:00').split(':').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, h, min, 0));
      try {
        // Sun geocentric ecliptic longitude ≈ Earth heliocentric longitude + 180°
        const earthLon = Astronomy.EclipticLongitude(Astronomy.Body.Earth, Astronomy.MakeTime(dt));
        const sunDeg = (((earthLon + 180) % 360) + 360) % 360;
        sunSign = ZODIAC_ARC_ORDER[Math.floor(sunDeg / 30)];
      } catch (e) {
        sunSign = 'unknown';
      }
    }
    const interpretation = await interpretHouses(asc, sunSign);
    res.json({
      system: 'Equal House',
      ascendant: asc,
      sunSign,
      houses: houses.map(h => ({
        num: h.num,
        sign: h.sign,
        degree: Number(h.degree.toFixed(2)),
        absDeg: Number(h.absDeg.toFixed(2)),
        theme: HOUSE_THEMES[h.num]
      })),
      interpretation,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('houses error:', err?.message, err?.stack || err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Daily Rituals (Feature A1) ─────────────────────────────
async function generateRitualContent(userId, date) {
  const user = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const birth = safeJsonParse(user.birth_data, null, 'getCachedStreak birth_data');
  const sunSign = birth?.zodiacSign || 'unknown';
  const today = date.toISOString().split('T')[0];
  const prompt = `Tu es Celeste, astrologue francophone bienveillante. Pour une personne de signe solaire ${sunSign}, génère le rituel du ${today} au format JSON strict:
{"morningCard": "<carte du matin: conseil énergétique en 1 phrase, 15-25 mots, ton chaleureux tutoyé>", "eveningIntention": "<intention du soir: question/reflexion douce en 1 phrase, 10-20 mots>"}
Retourne UNIQUEMENT le JSON, rien d'autre. Pas de markdown.`;
  try {
    const resp = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Be' + 'arer ' + LLM_API_KEY },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: celesteSystemPrompt("Réponds uniquement en JSON valide.") },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 200
      })
    });
    if (!resp.ok) throw new Error('LLM ' + resp.status);
    const data = await resp.json();
    const text = (data.choices?.[0]?.message?.content || '').trim()
      .replace(/^```json\n?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(text);
    return {
      morningCard: parsed.morningCard || 'Prends un instant pour respirer et te centrer avant de démarrer ta journée.',
      eveningIntention: parsed.eveningIntention || 'Avant de dormir, note une chose pour laquelle tu es reconnaissant(e).'
    };
  } catch (err) {
    console.error('ritual LLM error:', err.message);
    return {
      morningCard: 'Prends un instant pour respirer et te centrer avant de démarrer ta journée.',
      eveningIntention: 'Avant de dormir, note une chose pour laquelle tu es reconnaissant(e).'
    };
  }
}

app.get('/api/rituals/today', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let row = db.prepare(
      'SELECT * FROM daily_rituals WHERE user_id = ? AND date = ?'
    ).get(req.user.id, today);
    if (!row) {
      const content = await generateRitualContent(req.user.id, new Date());
      db.prepare(
        'INSERT INTO daily_rituals (user_id, date, morning_card, evening_intention) VALUES (?, ?, ?, ?)'
      ).run(req.user.id, today, content.morningCard, content.eveningIntention);
      row = db.prepare(
        'SELECT * FROM daily_rituals WHERE user_id = ? AND date = ?'
      ).get(req.user.id, today);
    }
    res.json({
      date: today,
      morningCard: row.morning_card,
      eveningIntention: row.evening_intention,
      completedMorning: !!row.completed_morning,
      completedEvening: !!row.completed_evening
    });
  } catch (err) {
    console.error('ritual today error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/rituals/today/complete', auth, async (req, res) => {
  const { period } = req.body || {};
  if (!['morning', 'evening'].includes(period)) {
    return res.status(400).json({ error: 'period must be morning or evening' });
  }
  const today = localISODate();
  try {
    // Ensure a real row exists (generate content if missing) before marking complete
    let row = db.prepare('SELECT * FROM daily_rituals WHERE user_id = ? AND date = ?').get(req.user.id, today);
    if (!row) {
      const content = await generateRitualContent(req.user.id, new Date());
      db.prepare(
        'INSERT INTO daily_rituals (user_id, date, morning_card, evening_intention) VALUES (?, ?, ?, ?)'
      ).run(req.user.id, today, content.morningCard, content.eveningIntention);
    }
    const col = period === 'morning' ? 'completed_morning' : 'completed_evening';
    db.prepare(`UPDATE daily_rituals SET ${col} = 1 WHERE user_id = ? AND date = ?`).run(req.user.id, today);
    res.json({ ok: true, period, date: today });
  } catch (err) {
    console.error('ritual complete error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/rituals/history', auth, (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const rows = db.prepare(
      'SELECT date, completed_morning, completed_evening FROM daily_rituals WHERE user_id = ? ORDER BY date DESC LIMIT ?'
    ).all(req.user.id, days);
    res.json({ days: rows });
  } catch (err) {
    console.error('ritual history error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Onboarding Progress (Feature A2) ─────────────────────────
const ONBOARDING_STEPS = [
  { key: 'birthdata',     label: 'Renseigne ta date de naissance',   icon: '🎂' },
  { key: 'firsthoroscope', label: 'Découvre ton horoscope du jour', icon: '✨' },
  { key: 'notification',  label: 'Active les notifications',         icon: '🔔' },
  { key: 'ritual',        label: 'Essaie ton premier rituel',        icon: '🌙' },
  { key: 'compatibility', label: 'Teste la compatibilité',            icon: '💞' }
];

app.get('/api/onboarding/progress', auth, (req, res) => {
  try {
    const row = db.prepare(
      'SELECT completed_steps, dismissed FROM onboarding_progress WHERE user_id = ?'
    ).get(req.user.id);
    const completed = row ? JSON.parse(row.completed_steps || '{}') : {};
    res.json({
      steps: ONBOARDING_STEPS.map(s => ({ ...s, completed: !!completed[s.key] })),
      dismissed: !!(row && row.dismissed),
      completedCount: Object.values(completed).filter(Boolean).length,
      totalCount: ONBOARDING_STEPS.length
    });
  } catch (err) {
    console.error('onboarding get error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/onboarding/step', auth, (req, res) => {
  const { step } = req.body || {};
  if (!ONBOARDING_STEPS.find(s => s.key === step)) {
    return res.status(400).json({ error: 'unknown step' });
  }
  try {
    const existing = db.prepare(
      'SELECT completed_steps FROM onboarding_progress WHERE user_id = ?'
    ).get(req.user.id);
    const completed = existing ? JSON.parse(existing.completed_steps || '{}') : {};
    completed[step] = true;
    const json = JSON.stringify(completed);
    if (existing) {
      db.prepare(
        'UPDATE onboarding_progress SET completed_steps = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).run(json, req.user.id);
    } else {
      db.prepare(
        'INSERT INTO onboarding_progress (user_id, completed_steps) VALUES (?, ?)'
      ).run(req.user.id, json);
    }
    res.json({ ok: true, step, completed });
  } catch (err) {
    console.error('onboarding step error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/onboarding/dismiss', auth, (req, res) => {
  try {
    db.prepare(
      `INSERT INTO onboarding_progress (user_id, dismissed, updated_at)
       VALUES (?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET dismissed = 1, updated_at = CURRENT_TIMESTAMP`
    ).run(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('onboarding dismiss error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Premium Status (Feature A3) ─────────────────────────
app.get('/api/premium/status', auth, (req, res) => {
  try {
    const user = db.prepare(
      'SELECT is_premium, premium_until FROM users WHERE id = ?'
    ).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const now = Date.now();
    const isPremium = user.is_premium === 1 || (user.premium_until && user.premium_until > now);
    let plan = 'free';
    if (user.is_premium === 1) plan = 'lifetime';
    else if (user.premium_until && user.premium_until > now) {
      const days = (user.premium_until - now) / 86400000;
      plan = days > 365 ? 'yearly' : 'monthly';
    }
    const daysRemaining = (user.premium_until && user.premium_until > now)
      ? Math.ceil((user.premium_until - now) / 86400000) : null;
    res.json({
      isPremium,
      plan,
      premiumUntil: user.premium_until && user.premium_until > now
        ? new Date(user.premium_until * 1000).toISOString() : null,
      daysRemaining,
      benefits: isPremium ? [
        'Compatibilités illimitées',
        'Tous les profils multi-personnes',
        'Notifications push avancées',
        'Exports PDF HD'
      ] : [
        '3 scans de compatibilité offerts',
        '1 profil personnel'
      ]
    });
  } catch (err) {
    console.error('premium status error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Gamification: XP, Levels, Quests, Badges, Portrait, Cosmic Events ───
registerGamificationRoutes(app, db, auth, callLLMWithRetry, getNatalPositions);

// ═══════════════════════════════════════════════════════════════════════════
// P1 + P7: CRON SCHEDULER — Daily push notifications + Re-engagement J+3/J+7
// Architecture sans node-cron: setInterval qui check toutes les 30 min.
//   1. Daily horoscope push (chaque user à son notification_hour)
//   2. Re-engagement J+3/J+7 pour users inactifs (P7)
// ═══════════════════════════════════════════════════════════════════════════
async function sendPushToUser(userId, payload) {
  if (!VAPID_PUBLIC_KEY) return { sent: 0, reason: 'push not configured' };
  const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId);
  if (subs.length === 0) return { sent: 0, reason: 'no subscription' };

  const payloadStr = JSON.stringify(payload);
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }, payloadStr)));

  const sent = results.filter(r => r.status === 'fulfilled').length;
  // Cleanup dead subs (410 Gone)
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subs[i].endpoint);
    }
  });
  return { sent, total: subs.length };
}

async function runDailyPushJob() {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const today = now.toISOString().split('T')[0];

    // Fix #6 — on notifie chaque user quand son HEURE LOCALE correspond à son notification_hour.
    // Le cron tourne toutes les 30 min, donc on accepte un delta de ±30 min (notification sent
    // si utcHour-floor(tz) == notification_hour OU utcHour-floor(tz)+24 == notification_hour).
    //
    // Ancienne logique : `targetHour = utcHour` → un user qui voulait 9h FR était notifié à
    // 9h UTC (= 11h FR en été). C'est le bug fixé ici.
    const users = db.prepare(`
      SELECT id, email, notification_hour, notification_timezone, last_notification_date, is_premium
      FROM users
      WHERE (last_notification_date IS NULL OR last_notification_date != ?)
        AND notification_hour IS NOT NULL
    `).all(today);

    if (users.length === 0) return;

    console.log(`[cron:daily-push] ${users.length} user(s) candidats à l'heure UTC ${utcHour}:${utcMinute}`);

    for (const user of users) {
      const tz = Number(user.notification_timezone ?? 0);
      // Heure locale approximative : UTC + tz (ignore les minutes pour ne pas rater la fenêtre cron)
      let localHour = (utcHour - Math.floor(tz) + 24) % 24;
      // Accepter un delta de 1h pour couvrir les crons 30 min (sinon les users à :30 sont ratés)
      const hourMatches = (localHour === user.notification_hour)
        || (localHour === ((user.notification_hour + 1) % 24) && utcMinute >= 30);

      if (!hourMatches) continue;

      // VMF voice: warm, specific, anti-generic. Varie le message selon le contexte.
      const pushVariants = [
        'Les planètes ont bougé cette nuit. Un petit coup d\'œil ?',
        'Ton ciel du jour est prêt. Pas de blabla — juste du vrai.',
        'Nouveau transit aujourd\'hui. Viens voir ce que ça dit de toi.',
        'Ton horoscope t\'attend. Pas le même qu\'hier — le ciel a tourné.',
      ];
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const body = pushVariants[dayOfYear % pushVariants.length];
      const payload = {
        title: '✨ Céleste',
        body: user.is_premium ? body : body + ' (gratuit)',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'celeste-daily',
        url: '/?screen=horoscope',
        data: { type: 'daily', userId: user.id },
      };
      const result = await sendPushToUser(user.id, payload);
      if (result.sent > 0) {
        db.prepare('UPDATE users SET last_notification_date = ? WHERE id = ?').run(today, user.id);
        console.log(`[cron:daily-push] sent to user ${user.id} (local ${user.notification_hour}h TZ=${tz}, ${result.sent} device(s))`);
      }
    }
  } catch (err) {
    console.error('[cron:daily-push] error:', err.message);
  }
}

// P7: Re-engagement for inactive users (J+3 and J+7)
async function runReengagementJob() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];

    // J+3: users whose last horoscope view was ~3 days ago
    const threeDaysAgo = now - 3 * 86400;
    const sevenDaysAgo = now - 7 * 86400;

    // Find premium users with push subscriptions who haven't checked in
    // Using last horoscope_cache date as proxy for last activity
    const inactiveUsers = db.prepare(`
      SELECT DISTINCT u.id, u.email, u.last_notification_date,
             MAX(hc.date) as last_horoscope_date
      FROM users u
      JOIN push_subscriptions ps ON ps.user_id = u.id
      LEFT JOIN horoscope_cache hc ON hc.user_id = u.id
      GROUP BY u.id
    `).all();

    let sent3 = 0, sent7 = 0;

    for (const user of inactiveUsers) {
      // Skip if already notified today (avoid spam)
      if (user.last_notification_date === today) continue;

      const lastActivityDate = user.last_horoscope_date
        ? Math.floor(new Date(user.last_horoscope_date + 'T00:00:00Z').getTime() / 1000)
        : null;

      // If user registered but never viewed horoscope, use registration date
      const regRow = db.prepare('SELECT created_at FROM users WHERE id = ?').get(user.id);
      const regEpoch = regRow?.created_at || now;
      const inactiveSince = lastActivityDate || regEpoch;
      const daysInactive = Math.floor((now - inactiveSince) / 86400);

      let payload = null;

      if (daysInactive >= 7 && (!user.last_notification_date || user.last_notification_date !== today)) {
        // J+7: stronger nudge
        payload = {
          title: '🌙 Les étoiles te réclament',
          body: 'Ça fait une semaine. Le ciel a beaucoup changé — ton horoscope t\'attend.',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'celeste-reenagage-7',
          url: '/?screen=horoscope',
          data: { type: 'reengage-7', userId: user.id },
        };
        sent7++;
      } else if (daysInactive >= 3 && daysInactive < 7) {
        // J+3: gentle reminder
        payload = {
          title: '✦ Ton horoscope est prêt',
          body: 'Tu n\'as pas consulté Céleste depuis 3 jours. Un petit coup d\'œil ?',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'celeste-reengage-3',
          url: '/?screen=horoscope',
          data: { type: 'reengage-3', userId: user.id },
        };
        sent3++;
      }

      if (payload) {
        const result = await sendPushToUser(user.id, payload);
        if (result.sent > 0) {
          db.prepare('UPDATE users SET last_notification_date = ? WHERE id = ?').run(today, user.id);
        }
      }
    }

    if (sent3 + sent7 > 0) {
      console.log(`[cron:reengagement] J+3: ${sent3} users, J+7: ${sent7} users notified`);
    }
  } catch (err) {
    console.error('[cron:reengagement] error:', err.message);
  }
}

// Start scheduler: check every 30 minutes
const CRON_INTERVAL_MS = 30 * 60 * 1000;
let cronInterval = null;

function startCronScheduler() {
  if (cronInterval) return;
  console.log('[cron] Scheduler started (check every 30 min)');
  // Run once at startup (after 60s delay to let server warm up)
  setTimeout(() => {
    runDailyPushJob();
    runReengagementJob();
  }, 60_000);
  // Then every 30 min
  cronInterval = setInterval(() => {
    runDailyPushJob();
    runReengagementJob();
  }, CRON_INTERVAL_MS);
}

startCronScheduler();

// ─── Serve static frontend in production ───────────────────
// Hashed assets (/assets/index-XXXXXX.js) can be cached forever — content-addressed
app.use('/assets', express.static(join(__dirname, '..', 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Non-hashed static files (icons, manifest, sw.js) — short cache + revalidate
app.use(express.static(join(__dirname, '..', 'dist'), {
  maxAge: 0,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache, must-revalidate'),
}));

// SPA fallback: index.html must NEVER be cached (it references hashed assets)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌟 Céleste server running on http://localhost:${PORT}`);
  console.log(`   Ephemeris: astronomy-engine (±0.3° accuracy)`);
  console.log(`   LLM: ${LLM_MODEL} via ${LLM_API_URL.split('/v1')[0]}`);
});
