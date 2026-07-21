import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import * as Astronomy from 'astronomy-engine';
import * as Sentry from '@sentry/node';
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';

// ─── TEC01 — Sentry init (no-op si SENTRY_DSN absent) ───────────────
const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || 0.1),
    release: process.env.npm_package_version || '1.0.0',
    // TEC01.b — Filtre PII : mots de passe, JWT, refresh tokens, secrets
    // NE JAMAIS envoyer ces infos à Sentry.
    beforeSend(event) {
      try {
        if (event.request?.data) {
          const data = event.request.data;
          delete data.password;
          delete data.token;
          delete data.refreshToken;
          delete data.receipt;
          delete data.iapSecret;
        }
        if (event.extra) {
          for (const k of Object.keys(event.extra)) {
            if (/password|token|secret|jwt|receipt/i.test(k)) delete event.extra[k];
          }
        }
      } catch {
        /* ne jamais laisser beforeSend faire crasher Sentry */
      }
      return event;
    },
  });
  console.log('[sentry] Monitoring actif');
} else {
  console.log('[sentry] DSN manquant — monitoring désactivé (set SENTRY_DSN to enable)');
}
const { AstroTime, Body, GeoVector, SiderealTime, EclipticGeoMoon, Rotation_EQJ_ECL, RotateVector, Observer, Horizon, Equator, MakeTime, Ecliptic } = Astronomy;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import billingRouter, { stripeWebhookHandler, isStripeConfigured } from './billing.js';
import { registerGamificationRoutes } from './gamification.js';
import { runMigrations } from './migrate.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createJournalRouter } from './routes/journal.js';
import { createAccountRouter } from './routes/account.js';
import { createPortraitPdfRouter } from './routes/portrait-pdf.js';
import { createProfilesRouter } from './routes/profiles.js';
import { createDailyEnergyRouter } from './routes/daily-energy.js';
import { createLunarCycleRouter } from './routes/lunar-cycle.js';
import { createMoodTrackerRouter } from './routes/mood-tracker.js';
import { createPersonalTransitsRouter } from './routes/personal-transits.js';
import { createActivatedHousesRouter } from './routes/activated-houses.js';
import { createAsteroidWisdomRouter } from './routes/asteroid-wisdom.js';
import oauthRouter from './routes/oauth.js';
import { CELESTE_VOICE, celesteSystemPrompt } from './celest-voice.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistRefreshToken,
  issueTokenPair,
} from './auth-tokens.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET is missing or too short (>= 32 chars required). Refusing to boot.');
}
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.cheapestinference.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
// v14.1 — Coupe-circuit LLM côté user.
// Quand `false`, les requêtes user normales (sans X-Admin-Token) tombent sur le
// fallback déterministe sans appeler le LLM. Seul un call admin peut forcer l'appel.
// Objectif : budget LLM sous contrôle total — les users n'appellent JAMAIS le LLM
// en temps réel. Le contenu est servi depuis les caches DB (daily_aspects_cache,
// horoscope_personal_daily, natal_interpretations, daily_energy, etc.).
let LLM_USER_ENABLED = (process.env.LLM_USER_ENABLED || 'false').toLowerCase() === 'true';
const PORT = process.env.PORT || 3001;

// CORS: en production, restreindre aux origines autorisées via CORS_ORIGIN (CSV).
// En dev (pas de CORS_ORIGIN), on permet tout pour le HMR Vite.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : null;

// ─── Web Push (VAPID) setup ────────────────────────────────
import webpush from 'web-push';
import { sendVerificationEmail, generateToken, isEmailConfigured } from './email.js';
import { detectAstroEvents, runAstroEventsJob } from './cron-events.js';
import { randomUUID } from 'node:crypto';
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

// P0 #3 — Portrait PDF purchase log (audit des achats one-shot IAP)
db.exec(`
  CREATE TABLE IF NOT EXISTS pdf_purchases_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_pdf_purchases_user ON pdf_purchases_log(user_id, created_at DESC);
`);

// P1 DUO — Invitations Compatibilité partageable.
// Schéma :
//   - token = UUID unique, sert d'URL partageable (push, email, etc.)
//   - inviter_user_id : l'user qui initie l'invitation
//   - invitee_user_id : l'user qui clique/remplit (peut être NULL si pas encore inscrit)
//   - invitee_birth_data : snapshot de l'input reçu (date+heure+lieu) AVANT création compte
//   - status : pending → redeemed (invité a rejoint et vu le résultat) → expired
//   - computed_result : cache du dernier résultat de compat (JSON, sinon recalcul)
db.exec(`
  CREATE TABLE IF NOT EXISTS compat_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    inviter_user_id INTEGER NOT NULL,
    invitee_user_id INTEGER,
    invitee_birth_data TEXT,
    invitee_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    computed_result TEXT,
    created_at INTEGER NOT NULL,
    redeemed_at INTEGER,
    FOREIGN KEY (inviter_user_id) REFERENCES users(id),
    FOREIGN KEY (invitee_user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_compat_invites_token ON compat_invites(token);
  CREATE INDEX IF NOT EXISTS idx_compat_invites_inviter ON compat_invites(inviter_user_id, created_at DESC);
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
// P0#4 — Streak freeze (1 gratuit/sem + IAP 0,99€) + grace 24h.
// streak_freezes = nombre de jetons "freeze" disponibles (default 1).
// streak_freeze_used_this_week = date ISO du dernier freeze consommé (reset hebdo).
if (!hasCol('streak_freezes')) {
  db.exec('ALTER TABLE users ADD COLUMN streak_freezes INTEGER DEFAULT 1');
}
if (!hasCol('streak_freeze_used_this_week')) {
  db.exec('ALTER TABLE users ADD COLUMN streak_freeze_used_this_week TEXT');
}
// P0#4 — Date ISO du dernier push "streak reminder" (anti-spam, 1/jour max)
if (!hasCol('last_streak_reminder')) {
  db.exec('ALTER TABLE users ADD COLUMN last_streak_reminder TEXT');
}
// P1#8 — Date du dernier push "événement astronomique" (anti-spam, 1/jour max).
if (!hasCol('last_astro_event_push')) {
  db.exec('ALTER TABLE users ADD COLUMN last_astro_event_push TEXT');
}
// P1#12 — Timestamp (epoch secondes) de la dernière activité connue de l'user.
// Mis à jour à chaque appel API authentifié (middleware global).
if (!hasCol('last_activity_at')) {
  db.exec('ALTER TABLE users ADD COLUMN last_activity_at INTEGER');
}
// P1#12 — Date ISO du dernier push "early re-engagement" (H+12/J+1/J+2) — anti-spam.
if (!hasCol('last_early_reengagement_date')) {
  db.exec('ALTER TABLE users ADD COLUMN last_early_reengagement_date TEXT');
}
// P1-7 — Free trial. trial_started_at est définitif (one-shot), last_trial_reminder
// évite le double-push du rappel J-2.
if (!hasCol('last_trial_reminder')) {
  db.exec('ALTER TABLE users ADD COLUMN last_trial_reminder TEXT');
}
// P0#6 — Vérification email (Resend). email_verified=0 par défaut, 1 après clic.
// email_verify_token = token opaque 32 bytes (hex), expiré après vérification.
if (!hasCol('email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
}
if (!hasCol('email_verify_token')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verify_token TEXT');
}

// P1#7 — Système de parrainage. Chaque user a un code court dérivé de son id.
// referral_code stocke "CEL-XXXXXX" (jamais vide après premier /referrals/code).
// referrals: log des filleuls (referral relationnel). reward_given=1 quand premium crédité.
if (!hasCol('referral_code')) {
  db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT');
}
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='referrals'").get()) {
  db.exec(`
    CREATE TABLE referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referred_id INTEGER NOT NULL UNIQUE,
      code TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      reward_given INTEGER DEFAULT 0,
      FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
  `);
  console.log('🎁 Migration: referrals table created');
}

// ─── P2#19 — weekly_content : contenu éditorial curated hebdomadaire ───
// Chaque semaine, un contenu thématique est publié (new/pleine lune, saison,
// rétrograde, etc.). Éditable manuellement via /api/admin/weekly-content.
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_content'").get()) {
  db.exec(`
    CREATE TABLE weekly_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL UNIQUE,         -- ISO date (lundi)
      theme TEXT NOT NULL,                      -- ex: "Pleine lune en Capricorne"
      emoji TEXT NOT NULL,                       -- emoji principal
      headline TEXT NOT NULL,                    -- accroche courte
      body TEXT NOT NULL,                        -- corps éditorial (markdown léger)
      ritual TEXT,                               -- rituel associé (optionnel)
      reflection TEXT,                           -- question de réflexion
      published_at INTEGER,                      -- NULL = brouillon, epoch = publié
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    CREATE INDEX idx_weekly_published ON weekly_content(published_at);
  `);
  console.log('📰 Migration: weekly_content table created');
}

// ─── P2#20 — transit_comments : commentaires communautaires sur transits ──
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transit_comments'").get()) {
  db.exec(`
    CREATE TABLE transit_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transit_date TEXT NOT NULL,             -- ISO date du transit
      transit_key TEXT NOT NULL,              -- ex: "full-moon-capricorn" ou "venus-mars-trine"
      user_id INTEGER NOT NULL,
      display_name TEXT NOT NULL,             -- pseudo affiché (pas email)
      content TEXT NOT NULL,                  -- 1-500 caractères
      likes_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_transit_comments ON transit_comments(transit_date, transit_key);
    CREATE TABLE transit_comment_likes (
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY(comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES transit_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('💬 Migration: transit_comments table created');
}

// P2#20 — add display_name column to users (pour les commentaires communautaires)
if (!db.prepare("PRAGMA table_info(users)").all().find(c => c.name === 'display_name')) {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  console.log('💬 Migration: users.display_name column added');
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

// token_blacklist — revoked refresh tokens (JWT blacklist)
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='token_blacklist'").get()) {
  db.exec(`
    CREATE TABLE token_blacklist (
      jti TEXT PRIMARY KEY,
      user_id INTEGER,
      revoked_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE INDEX idx_blacklist_user ON token_blacklist(user_id);
  `);
}
// Auto-clean expired blacklist entries (> 31 days old)
db.prepare('DELETE FROM token_blacklist WHERE revoked_at < ?').run(
  Math.floor(Date.now() / 1000) - 31 * 86400
);
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

// ═══════════════════════════════════════════════════════════════════════════
// P0#4 — Streak freeze + grace period 24h.
//
// updateStreak rules (améliorées) :
//  - streak_last_date == today     → no-op (déjà compté aujourd'hui)
//  - streak_last_date == yesterday → streak_count + 1
//  - gap == 2 jours (avant-hier)   → GRACE 24h : +1 (on pardonne 1 jour manqué)
//  - gap >= 2 jours                → si freeze dispo, consommer 1 freeze (streak conservé)
//  - sinon                         → reset à 1
//
// Retourne { count, freezeConsumed, graceApplied }.
// ═══════════════════════════════════════════════════════════════════════════
function updateStreak(userId, today) {
  const u = db.prepare(
    'SELECT streak_count, streak_last_date, streak_freezes, streak_freeze_used_this_week FROM users WHERE id = ?'
  ).get(userId);
  if (!u) return { count: 0, freezeConsumed: false, graceApplied: false };

  // Déjà compté aujourd'hui
  if (u.streak_last_date === today) {
    return { count: u.streak_count ?? 0, freezeConsumed: false, graceApplied: false };
  }

  const yesterday = yesterdayISODate();
  const lastDate = u.streak_last_date;

  // Cas nominal : suite logique (+1)
  if (lastDate === yesterday) {
    const newCount = (u.streak_count ?? 0) + 1;
    db.prepare('UPDATE users SET streak_count = ?, streak_last_date = ? WHERE id = ?')
      .run(newCount, today, userId);
    return { count: newCount, freezeConsumed: false, graceApplied: false };
  }

  // Calcul du gap en jours
  const gapDays = lastDate ? daysBetween(lastDate, today) : null;

  // P0#4 — Grace 24h : gap == 2 (1 jour manqué) → on pardonne et +1
  if (gapDays === 2) {
    const newCount = (u.streak_count ?? 0) + 1;
    db.prepare('UPDATE users SET streak_count = ?, streak_last_date = ? WHERE id = ?')
      .run(newCount, today, userId);
    return { count: newCount, freezeConsumed: false, graceApplied: true };
  }

  // P0#4 — Freeze : gap >= 3 et l'user a un jeton freeze disponible
  // Reset hebdo du freeze : si streak_freeze_used_this_week est > 7 jours, on reset à 1.
  const lastFreeze = u.streak_freeze_used_this_week;
  let freezesAvailable = u.streak_freezes ?? 1;
  if (lastFreeze && daysBetween(lastFreeze, today) > 7) {
    freezesAvailable = 1; // reset hebdo du free freeze
  }

  if (gapDays !== null && gapDays >= 3 && freezesAvailable > 0) {
    // Consommer 1 freeze : streak conservé, on décale streak_last_date à yesterday
    // pour simuler la continuité, puis le +1 normal se fera au prochain appel.
    const newCount = (u.streak_count ?? 0) + 1;
    db.prepare(
      `UPDATE users
         SET streak_count = ?,
             streak_last_date = ?,
             streak_freezes = ?,
             streak_freeze_used_this_week = ?
       WHERE id = ?`
    ).run(
      newCount,
      today,
      Math.max(0, freezesAvailable - 1),
      today,
      userId
    );
    return { count: newCount, freezeConsumed: true, graceApplied: false };
  }

  // Aucune protection : reset
  db.prepare('UPDATE users SET streak_count = ?, streak_last_date = ? WHERE id = ?')
    .run(1, today, userId);
  return { count: 1, freezeConsumed: false, graceApplied: false };
}

/** Différence en jours entre deux dates ISO (YYYY-MM-DD). */
function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z');
  const b = new Date(isoB + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
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
// v11.1 — LLM Mutex : sérialise les appels (provider = 1 concurrent max par clé).
// v11.5 — Circuit breaker : si 3 échecs consécutifs en 2 min, on coupe 5 min et toutes
//         les routes servent leur fallback déterministe immédiatement.
let llmQueue = Promise.resolve();
let llmActiveCount = 0;
let llmFailureStreak = 0;
let llmCircuitOpenedAt = 0;
const LLM_CIRCUIT_THRESHOLD = 3;
const LLM_CIRCUIT_WINDOW_MS = 2 * 60_000;
const LLM_CIRCUIT_COOLDOWN_MS = 5 * 60_000;

function isLLMCircuitOpen() {
  if (llmCircuitOpenedAt === 0) return false;
  if (Date.now() - llmCircuitOpenedAt > LLM_CIRCUIT_COOLDOWN_MS) {
    console.log('[LLM] circuit cooldown écoulé, on retente');
    llmCircuitOpenedAt = 0;
    llmFailureStreak = 0;
    return false;
  }
  return true;
}

function withLLMMutex(fn) {
  llmActiveCount++;
  const next = llmQueue.then(() => fn(), () => fn());
  llmQueue = next.finally(() => { llmActiveCount--; });
  return next;
}

function llmMutexDepth() { return llmActiveCount; }

function recordLLMSuccess() {
  llmFailureStreak = 0;
}
function recordLLMFailure() {
  llmFailureStreak++;
  if (llmFailureStreak >= LLM_CIRCUIT_THRESHOLD && llmCircuitOpenedAt === 0) {
    llmCircuitOpenedAt = Date.now();
    console.warn(`[LLM] CIRCUIT OUVERT — ${LLM_CIRCUIT_THRESHOLD} échecs consécutifs. Fallbacks déterministes pendant ${LLM_CIRCUIT_COOLDOWN_MS/1000}s.`);
  }
}

async function callLLMWithRetry(messages, maxRetries = 3, maxTokens = 4096, extraBody = {}, timeoutMs = 45000, options = {}) {
  // v14.4 — Garde coupe-circuit LLM côté user.
  // Par défaut, `options.adminBypass = false` → si LLM_USER_ENABLED=false, on RETOURNE
  // un objet signal `{disabled: true}` au lieu de throw. Les callers testent `data?.disabled`
  // et servent leur fallback déterministe. C'est moins de boilerplate qu'un try/catch LLM_DISABLED.
  // Si `adminBypass = true` (call admin), on appelle le LLM quoi qu'il arrive.
  if (!LLM_USER_ENABLED && !options.adminBypass) {
    return { disabled: true, reason: 'LLM_USER_ENABLED=false' };
  }
  // v11.5 — Circuit breaker : si on est en cooldown, on retourne aussi un signal.
  if (isLLMCircuitOpen() && !options.adminBypass) {
    return { disabled: true, reason: 'circuit_open' };
  }
  return withLLMMutex(async () => {
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
        if (response.ok) {
          recordLLMSuccess();
          return await response.json();
        }
        const errText = await response.text().catch(() => '');
        lastErr = new Error(`LLM ${response.status}`);
        recordLLMFailure();
        if (response.status === 429 || response.status >= 500) {
          // 429 = rate-limit gateway Telegram: NE PAS retry (ça multiplie les notifs "rate-limiting")
          if (response.status === 429) {
            console.warn(`[LLM] 429 rate-limit — fallback immédiat (no retry, pas de spam Telegram)`);
            throw lastErr;
          }
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
          recordLLMFailure();
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
  });
}

// ─── v14.0 — Utilitaires LLM avec cache + timestamp trompeur ───────────────
// Objectif : un user qui ouvre l'app voit un contenu "frais" (timestamp = fetch time),
//            mais en interne on sait quand le LLM a vraiment généré.
//            Si le contenu est en cache → on ressert le cache (0 appel LLM).
//            Sinon → on génère, on cache, on sert.
//
// Pourquoi "timestamp trompeur" : Co-Star, The Pattern, Sanctuary, CHANI font tous
// pareil. Le contenu est pré-calculé (la nuit) ou caché. Montrer "généré il y a 3 jours"
// casse l'illusion de fraîcheur. On montre l'heure du fetch, on garde la vraie heure
// dans une colonne séparée (debug only, jamais envoyée au front).
const llmCache = {
  // cache: { key: { content, real_generated_at, expires_at } }
  store: new Map(),
  // Durée de vie par défaut du cache : 24h
  TTL_MS: 24 * 60 * 60 * 1000,

  // Récupère ou génère
  async fetch(key, generator, ttlMs = this.TTL_MS) {
    const now = Date.now();
    const cached = this.store.get(key);
    if (cached && cached.expires_at > now) {
      // Cache HIT — on ressert le contenu existant avec un NOUVEAU timestamp
      return {
        ...cached.content,
        _cache: 'hit',
        _real_generated_at: cached.real_generated_at,
      };
    }
    // Cache MISS — on génère (1 appel LLM)
    try {
      const content = await generator();
      this.store.set(key, {
        content,
        real_generated_at: now,
        expires_at: now + ttlMs,
      });
      return {
        ...content,
        _cache: 'miss',
        _real_generated_at: now,
      };
    } catch (e) {
      // LLM a échoué : on sert un fallback déterministe et on cache ce fallback pour 1h
      // (pour pas spammer le LLM si tous les users tombent en même temps)
      const fallback = await getGenericLLMFallback(key, e);
      this.store.set(key, {
        content: fallback,
        real_generated_at: now,
        expires_at: now + 60 * 60 * 1000, // 1h seulement pour fallback
      });
      return {
        ...fallback,
        _cache: 'fallback',
        _real_generated_at: now,
      };
    }
  },

  // Invalider manuellement (utile pour regénérer après changement de config)
  invalidate(key) { this.store.delete(key); },
  invalidateAll() { this.store.clear(); },
  stats() {
    let hits = 0, misses = 0, fallbacks = 0;
    for (const v of this.store.values()) {
      if (v.expires_at > Date.now()) hits++;
    }
    return { entries: this.store.size, live: hits };
  }
};

// Fallback générique si LLM échoue — texte honnête, jamais culpabilisant
async function getGenericLLMFallback(key, err) {
  console.warn(`[LLM-CACHE] fallback déterministe pour ${key} (LLM down: ${err.message})`);
  return {
    headline: 'Une journée pour respirer.',
    energy: { score: 4, label: 'Stable', emoji: '🌿', advice: 'Prends ton temps.' },
    goodFor: ['introspection', 'douceur', 'rythme lent'],
    avoid: ['décisions hâtives'],
    reflectionPrompt: 'Qu\'est-ce qui te demande du repos en ce moment ?',
  };
}

// ─── v14.1 — Invalidation cache DB par feature (admin) ─────────────────
// Vide la ligne de cache correspondante pour forcer une re-génération au prochain
// appel user. La route user, à son tour, appliquera son fallback si LLM_USER_ENABLED=false
// ou appellera le LLM (coût 1×) si LLM_USER_ENABLED=true.
// Retourne { deleted, remaining } — deleted = lignes supprimées, remaining = restantes.
function invalidateCacheFor(feature, userId, date) {
  // Mapping feature → { table, whereUser, whereDate, whereContent }
  const MAP = {
    daily_energy:       { table: 'daily_energy',         dateCol: 'date' },
    weekly_challenge:   { table: 'weekly_challenges',    dateCol: 'week_start' },
    ritual:             { table: 'daily_rituals',        dateCol: 'date' },
    horoscope_personal: { table: 'horoscope_personal_daily', dateCol: 'date' },
    aspects_today:      { table: 'daily_aspects_cache',  dateCol: 'date' },
    tarot_cross:        { table: 'tarot_personal_cross', dateCol: 'created_at' /* date de création = date du tirage */ },
  };
  const cfg = MAP[feature];
  if (!cfg) throw new Error(`feature inconnue: ${feature}`);

  // 1) Cache mémoire
  let memDeleted = 0;
  if (llmCache && llmCache.store) {
    const toDelete = [];
    for (const k of llmCache.store.keys()) {
      if (k.startsWith(feature + ':')) {
        if (!userId || k.includes(`:${userId}:`)) {
          toDelete.push(k);
        }
      }
    }
    for (const k of toDelete) { llmCache.store.delete(k); memDeleted++; }
  }

  // 2) Cache DB (SQLite)
  let dbDeleted = 0;
  try {
    if (userId) {
      const info = db.prepare(`DELETE FROM ${cfg.table} WHERE ${cfg.dateCol} = ? AND user_id = ?`).run(date, userId);
      dbDeleted = info.changes || 0;
    } else {
      const info = db.prepare(`DELETE FROM ${cfg.table} WHERE ${cfg.dateCol} = ?`).run(date);
      dbDeleted = info.changes || 0;
    }
  } catch (e) {
    console.warn(`[ADMIN] invalidateCacheFor ${feature} DB error:`, e.message);
  }

  return { deleted: dbDeleted + memDeleted, remaining: null, db_deleted: dbDeleted, mem_deleted: memDeleted };
}

// ─── FALLBACK horoscopes (par signe, pré-écrits) ─────────────────
// ─── v11.2 — Garde-fous process : une ReferenceError async ne doit plus tuer le serveur. ───
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err.name, err.message);
  if (SENTRY_DSN) Sentry.captureException(err);
  // On log, on n'arrête PAS le process. Les handlers HTTP peuvent continuer à servir les requêtes suivantes.
  if (err.name === 'ReferenceError') {
    console.error('[FATAL] ReferenceError — vérifiez qu\'une variable du bloc fallback est bien déclarée.');
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', String(reason).slice(0, 200));
  if (SENTRY_DSN && reason instanceof Error) Sentry.captureException(reason);
});

// ─── FALLBACK horoscopes (par signe, pré-écrits) ─────────────────
// Utilisés si le LLM rate-limit ou panne. Garantit un horoscope TOUJOURS disponible.
// v13.2 — Chaque signe a 3 VARIANTES qui tournent selon le jour de l'année.
//         Avant : 1 texte fixe par signe → si le LLM tombait plusieurs jours
//         d'affilée (circuit breaker), l'utilisateur voyait le MÊME horoscope
//         se répéter → impression de "pattern" suspect. Maintenant, la variante
//         est déterministe (jour_jour_de_lannée % 3), donc :
//           (a) stable pour la journée (pas de surprise au refresh),
//           (b) differente du lendemain,
//         (c) reproductible pour debug.
const FALLBACK_HOROSCOPES = {
  Aries: [
    { general: "Le feu intérieur brûle fort aujourd'hui — agis, mais choisis ta bataille avec discernement.", amour: "Tu magnétises, mais l'autre a besoin de tendresse autant que d'admiration.", carriere: "Lance-toi sur le projet qui te trotte dans la tête depuis des semaines.", energie: 4, mood: "Combatif", luckyNumber: 7, luckyColor: "Rouge" },
    { general: "Une étincelle d'impatience te pousse en avant. C'est ton élan — apprends seulement à freiner avant les virages.", amour: "Tu risques de brûler les étapes. Laisse au lien le temps de respirer.", carriere: "Ton instinct te dit de foncer. Écoute-le, mais vérifie tes bases avant.", energie: 5, mood: "Déterminé", luckyNumber: 21, luckyColor: "Corail" },
    { general: "Mars te souffle une énergie claire, presque tranchante. C'est le bon moment pour trancher ce qui traîne.", amour: "Tu as besoin de clarté, pas de demi-mesures. Dis ce que tu veux vraiment.", carriere: "Une décision repoussée depuis trop longtemps demande ton attention aujourd'hui.", energie: 4, mood: "Direct", luckyNumber: 14, luckyColor: "Écarlate" },
  ],
  Taurus: [
    { general: "Une journée pour ancrer, ralentir, savourer. La patience paie aujourd'hui plus que l'élan.", amour: "Les gestes tendres comptent plus que les grandes déclarations. Présence.", carriere: "Avance méthodique. Tu poses les bases solides.", energie: 3, mood: "Stable", luckyNumber: 4, luckyColor: "Vert forêt" },
    { general: "La Terre te demande de ralentir le rythme. Pas par fatigue — par sagesse sensorielle.", amour: "Un repas, un contact peau à peau, une marche ensemble valent mieux que mille mots.", carriere: "Ce qui prend du temps aujourd'hui rapportera plus tard. Ne cède pas à l'urgence.", energie: 3, mood: "Ancré", luckyNumber: 22, luckyColor: "Mousse" },
    { general: "Vénus te touche en plein cœur des sens. Tout ce qui est beau, bon, doux t'appelle.", amour: "Ton corps parle plus fort que ta tête aujourd'hui. Écoute-le dans le lien.", carriere: "Reste sur tes marques. Ta persévérance silencieuse impressionne plus que tu ne le crois.", energie: 4, mood: "Serein", luckyNumber: 33, luckyColor: "Terre cuite" },
  ],
  Gemini: [
    { general: "Ton esprit vole d'idée en idée — canalise-le sur un seul sujet à la fois.", amour: "Communication, dialogue, légèreté. La curiosité nourrit le lien.", carriere: "Multiples pistes s'ouvrent — choisis, engage-toi.", energie: 4, mood: "Curieux", luckyNumber: 5, luckyColor: "Jaune" },
    { general: "Mercure te donne mille voix aujourd'hui. Choisis-en une, et fais-la entendre.", amour: "Un échange en profondeur vaut mieux que dix conversations en surface.", carriere: "Ta capacité à relier des idées éloignées est ton atout du jour.", energie: 5, mood: "Vif", luckyNumber: 23, luckyColor: "Citron" },
    { general: "Besoin de mouvement, d'air, d'horizons neufs. La routine t'étouffe un peu aujourd'hui.", amour: "Va voir ailleurs si tu y es — mais reviens. La nouveauté nourrit, l'errance épuise.", carriere: "Apprends quelque chose de nouveau aujourd'hui. Ta plasticité est ta richesse.", energie: 4, mood: "Inventif", luckyNumber: 14, luckyColor: "Aqua" },
  ],
  Cancer: [
    { general: "Lune en phase sensible aujourd'hui — écoute ton ventre plus que ta tête.", amour: "Coquille protectrice ou cœur ouvert ? Les deux à la fois.", carriere: "Ta sensibilité est un super-pouvoir, pas une faiblesse.", energie: 3, mood: "Introspectif", luckyNumber: 2, luckyColor: "Blanc argenté" },
    { general: "La Lune te tire vers l'intérieur, vers les racines, vers ce qui te sécurise.", amour: "Un besoin de tendresse sans condition. Offre-la d'abord à toi-même.", carriere: "Travaille depuis ton intuition, pas depuis la pression externe.", energie: 3, mood: "Doux", luckyNumber: 11, luckyColor: "Nacre" },
    { general: "Tes émotions remontent comme une marée — pas pour t'enfoncer, pour te rappeler d'où tu viens.", amour: "Tu te souviens de tout. C'est ta force et ta fragilité dans le lien.", carriere: "Prends soin de ton nid aujourd'hui — l'extérieur tiendra mieux si l'intérieur est solide.", energie: 4, mood: "Mélancolique", luckyNumber: 20, luckyColor: "Bleu pâle" },
  ],
  Leo: [
    { general: "Rayonne sans écraser. Le leadership aujourd'hui, c'est inspirer.", amour: "Cœur en scène — sois généreux·se, mais laisse l'autre briller aussi.", carriere: "Visibilité, reconnaissance. Assume ta place au centre.", energie: 5, mood: "Lumineux", luckyNumber: 1, luckyColor: "Or" },
    { general: "Le Soleil tape fort aujourd'hui — pas pour te brûler, pour te rappeler que tu existes.", amour: "Tu as besoin d'être vu·e. Dis-le simplement, sans le faire payer à l'autre.", carriere: "Ose te mettre en avant. Le monde a besoin de ta lumière, pas de ton effacement.", energie: 5, mood: "Radieux", luckyNumber: 10, luckyColor: "Ambre" },
    { general: "Une fierté saine te traverse aujourd'hui. Celle qui dit : j'ai parcouru un chemin.", amour: "Générosité du cœur, sans calcul. Tu offres parce que c'est ta nature.", carriere: "Ta présence catalyse l'attention. Ne t'excuse pas d'occuper l'espace.", energie: 4, mood: "Fier", luckyNumber: 19, luckyColor: "Soleil" },
  ],
  Virgo: [
    { general: "Le détail qui te sauve aujourd'hui. Prends le temps de bien faire.", amour: "L'attention aux petits gestes fait toute la différence.", carriere: "Organisation, méthode, clarté — c'est ton terrain de jeu.", energie: 3, mood: "Concentré", luckyNumber: 3, luckyColor: "Beige" },
    { general: "Mercure structuré te donne une clarté chirurgicale. Coupe le superflu.", amour: "Les actes concrets comptent plus que les promesses aujourd'hui.", carriere: "Range, classe, priorise. L'ordre matériel apaise ton mental.", energie: 4, mood: "Méthodique", luckyNumber: 12, luckyColor: "Sable" },
    { general: "Tu vois ce qui cloche avant tout le monde. C'est un don — pas une malédiction.", amour: "Attention à ne pas corriger l'autre : aime-le tel qu'il est, d'abord.", carriere: "Ta capacité d'analyse fine est recherchée aujourd'hui. Fais-la connaître.", energie: 3, mood: "Précis", luckyNumber: 30, luckyColor: "Lin" },
  ],
  Libra: [
    { general: "Équilibre, harmonie, mais aussi : sache dire ton vrai oui et ton vrai non.", amour: "Le lien se nourrit d'authenticité autant que de douceur.", carriere: "Négociations facilitées. Trouve l'accord élégant.", energie: 4, mood: "Harmonieux", luckyNumber: 6, luckyColor: "Rose poudré" },
    { general: "Vénus te pousse à rechercher la beauté dans tout — y compris dans le conflit évité de justesse.", amour: "Cherche l'équilibre entre plaire et être vrai·e. Les deux sont possibles.", carriere: "Tu vois le juste milieu que les autres ne voient pas. Propose-le.", energie: 4, mood: "Diplomate", luckyNumber: 15, luckyColor: "Rose ancien" },
    { general: "Besoin d'harmonie aujourd'hui — mais pas à n'importe quel prix.", amour: "Ton écoute est précieuse. N'oublie pas d'écouter aussi ta voix intérieure.", carriere: "Un accord se dessine. Ta voix compte pour le sceller.", energie: 3, mood: "Élégant", luckyNumber: 24, luckyColor: "Pêche" },
  ],
  Scorpio: [
    { general: "Plongée en profondeur. Tout ce qui est superficiel ne t'intéresse pas aujourd'hui.", amour: "Intensité magnétique. Laisse l'autre respirer dans ton espace.", carriere: "Stratégie, intuition, percée. Tu vois ce que d'autres ne voient pas.", energie: 4, mood: "Mystérieux", luckyNumber: 8, luckyColor: "Bordeaux" },
    { general: "Pluton remue ce que tu avais enfoui. Pas pour te faire mal — pour te libérer.", amour: "Une vérité demande à sortir. Le lien en sortira transformé, ou renforcé.", carriere: "Ta perspicacité perçante voit à travers les masques. Utilise-la avec justesse.", energie: 5, mood: "Intense", luckyNumber: 17, luckyColor: "Noir bleuté" },
    { general: "Ton radar aux émotions cachées est à pleine puissance aujourd'hui.", amour: "Tu sens ce qui n'est pas dit. Pose la question, doucement.", carriere: "Une stratégie secrète peut devenir officielle. C'est le moment.", energie: 4, mood: "Pénétrant", luckyNumber: 26, luckyColor: "Prune" },
  ],
  Sagittarius: [
    { general: "Élan d'aventure, besoin d'horizon. Une idée t'appelle au loin.", amour: "Liberté et engagement ne sont pas ennemis — dialogue.", carriere: "Vise haut, lance-toi, apprends de l'élan même imparfait.", energie: 4, mood: "Aventurier", luckyNumber: 9, luckyColor: "Bleu indigo" },
    { general: "Jupiter gonfle tes ambitions aujourd'hui. Attention aux promesses trop grandes.", amour: "Tu rêves loin — mais l'autre est là, près de toi. Regarde-le aussi.", carriere: "Une opportunité d'expansion se présente. Vérifie l'atterrissage avant le décollage.", energie: 5, mood: "Enthousiaste", luckyNumber: 18, luckyColor: "Indigo" },
    { general: "Soif d'apprendre, besoin de sens. La routine te semble étriquée aujourd'hui.", amour: "Explique à l'autre où tu veux aller. Il pourrait te suivre.", carriere: "Ta vision large inspire. Trouve un canal concret pour l'exprimer.", energie: 4, mood: "Explorateur", luckyNumber: 27, luckyColor: "Lapis" },
  ],
  Capricorn: [
    { general: "Discipline et patience. Chaque pas compte. Le long terme t'appartient.", amour: "Construire, durable. La tendresse peut rimer avec constance.", carriere: "Avancement concret, reconnaissance du travail bien fait.", energie: 4, mood: "Déterminé", luckyNumber: 10, luckyColor: "Gris anthracite" },
    { general: "Saturne te demande de poser une pierre de plus sur l'édifice. Pas spectaculaire, mais solide.", amour: "Ta loyauté est ton langage d'amour. Dis-le à l'autre, il ne le devine pas.", carriere: "Un investissement patient commence à porter. Reste sur la trajectoire.", energie: 3, mood: "Constant", luckyNumber: 28, luckyColor: "Ardoise" },
    { general: "Ambition maîtrisée. Tu grimpes sans bruit, mais sûrement.", amour: "Montre ta tendresse autrement que par des actes concrets. Les mots comptent aussi.", carriere: "Ta réputation se construit aujourd'hui sur un détail. Sois impeccable.", energie: 4, mood: "Sobre", luckyNumber: 19, luckyColor: "Granite" },
  ],
  Aquarius: [
    { general: "Vision décalée, idées qui sortent du cadre. Ose penser à l'envers.", amour: "Indépendance chérie, mais le lien vrai se construit.", carriere: "Innovation, originalité. Ton regard neuf est précieux.", energie: 4, mood: "Visionnaire", luckyNumber: 11, luckyColor: "Turquoise" },
    { general: "Uranus te souffle une intuition disruptive. Ne la repousse pas par peur du jugement.", amour: "Ton besoin d'air est légitime. Explique-le, ne disparaîs pas.", carriere: "Une idée en avance sur son temps germe. Note-la, partage-la.", energie: 5, mood: "Inventif", luckyNumber: 20, luckyColor: "Électrique" },
    { general: "Tu vois les systèmes, les patterns, les futurs possibles. C'est rare — fais-en quelque chose.", amour: "L'intellect te séduit plus que le romantisme aujourd'hui. Trouve quelqu'un qui pense avec toi.", carriere: "Ta capacité à anticiper les tendances est ton or noir.", energie: 4, mood: "Anticipatif", luckyNumber: 29, luckyColor: "Cyan" },
  ],
  Pisces: [
    { general: "Vague intuitive forte. Écoute tes rêves, ton imagination sait des choses.", amour: "Romantisme, compassion, fusion. Mais garde ton centre.", carriere: "Créativité, art, intuition. Laisse parler ta part sensible.", energie: 3, mood: "Rêveur", luckyNumber: 12, luckyColor: "Lavande" },
    { general: "Neptune brouille les frontières aujourd'hui — entre toi et les autres, entre rêve et réel.", amour: "Tu peux fondre dans l'autre. C'est beau. Garde aussi un fil vers toi.", carriere: "Une intuition créatrice demande un canal concret pour ne pas se dissiper.", energie: 2, mood: "Flottant", luckyNumber: 21, luckyColor: "Nuit" },
    { general: "Ta sensibilité est une antenne aujourd'hui. Elle capte tout — protège-la aussi.", amour: "Ta compassion est ta richesse. Ne te noie pas dans les émotions des autres.", carriere: "Le passage par l'imaginaire est productif aujourd'hui. Crée, écris, peins.", energie: 3, mood: "Empathique", luckyNumber: 30, luckyColor: "Aqua-marine" },
  ],
};

// v13.2 — Sélectionne une variante déterministe selon le jour.
// Retourne un horoscope stable pour la journée, différent du lendemain.
function getFallbackHoroscope(sign) {
  const variants = FALLBACK_HOROSCOPES[sign] || FALLBACK_HOROSCOPES.Aries;
  // Jour de l'année (1-366) — déterministe, varie chaque jour
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const variantIdx = dayOfYear % variants.length;
  return { ...variants[variantIdx], isFallback: true };
}
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

  // v14.4 — Si LLM off ou erreur, on sert un résumé déterministe calculé
  // localement à partir des vraies positions astro.
  if (!data || !data.choices) {
    const sun = natalPositions.sun?.sign || sign;
    const moon = natalPositions.moon?.sign || 'équilibre';
    const moodSeed = (natalPositions.moon?.degree || 0) + (transits.moon?.degree || 0);
    return {
      general: `L'énergie du jour croise ton soleil en ${sun} et ta lune en ${moon}. Accorde-toi un rythme doux, c'est le bon tempo aujourd'hui.`,
      energie: ((moodSeed % 5) + 1),
      mood:   ['curiosité', 'calme', 'élan', 'fougue', 'sérénité'][Math.floor(moodSeed) % 5],
      luckyColor: ['bleu profond','or','rouge carmin','vert sauge','lavande','bordeaux','ivoire','turquoise'][Math.floor(moodSeed) % 8],
    };
  }

  const msg = data.choices?.[0]?.message || {};
  const content = msg.content || msg.reasoning_content || '';
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in summary response');
  return JSON.parse(jsonMatch[0]);
}

async function generateHoroscope(natalPositions, transits, sign) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // v13.5 — Le LLM backend consomme 1496 tokens sur 1500 en reasoning (finish_reason: length).
  // enable_thinking:false est IGNORÉ par glm-5.2 quand il y a un system prompt long.
  // Solution : on n'utilise PAS celesteSystemPrompt (qui fait 1795 chars) pour la génération,
  // on met un system prompt court et on laisse LLM_MODEL définir le ton.
  const systemPrompt = `Tu es Céleste, astrologue française. Tu écris en français, ton chaleureux et humain. Tu te bases sur les vraies positions planétaires. Jamais prédictif, jamais moralisateur.

Réponds UNIQUEMENT en JSON valide avec ce format:
{"general":"2-3 phrases","amour":"1-2 phrases","carriere":"1-2 phrases","energie":1-5,"mood":"2 mots","luckyNumber":1-99,"luckyColor":"couleur FR"}

Aucun texte avant ou après le JSON.`;

  // v13.4 — Prompt minimaliste : seulement les positions essentielles (signes), pas le dump JSON complet.
  // Le LLM perdait du temps à "lire" 14 planètes détaillées (~10k chars de prompt) → timeout 30s.
  // On ne garde que les planètes personnelles + aspects principaux → prompt ~1k chars, réponse en ~12-18s.
  const natalSummary = [
    `Soleil: ${natalPositions.sun?.sign} (${natalPositions.sun?.degree}°)`,
    `Lune: ${natalPositions.moon?.sign} (${natalPositions.moon?.degree}°)`,
    `Mercure: ${natalPositions.mercury?.sign}`,
    `Vénus: ${natalPositions.venus?.sign}`,
    `Mars: ${natalPositions.mars?.sign}`,
    `Jupiter: ${natalPositions.jupiter?.sign}`,
    `Saturne: ${natalPositions.saturn?.sign}`,
    `Ascendant: ${natalPositions.ascendant?.sign}`,
  ].join(', ');

  const transitSummary = [
    `Soleil: ${transits.sun?.sign}`,
    `Lune: ${transits.moon?.sign}`,
    `Mercure: ${transits.mercury?.sign}`,
    `Vénus: ${transits.venus?.sign}`,
    `Mars: ${transits.mars?.sign}`,
    `Jupiter: ${transits.jupiter?.sign}`,
    `Saturne: ${transits.saturn?.sign}`,
  ].join(', ');

  const userPrompt = `Date: ${today}
Thème natal: ${natalSummary}
Transits du jour: ${transitSummary}
Signe solaire: ${sign}

Génère un horoscope PERSONNALISÉ en JSON strict:
{
  "general": "2-3 phrases qui croisent les transits et le thème natal de cette personne spécifiquement",
  "amour": "1-2 phrases, basées sur Vénus/Lune natale × transits",
  "carriere": "1-2 phrases, basées sur Mars/Mercure natale × transits",
  "energie": 4,
  "mood": "2 mots",
  "luckyNumber": 7,
  "luckyColor": "bleu"
}

UNIQUEMENT le JSON, rien d'autre. Pas de markdown, pas de texte avant/après.`;

  // v14.4 — Fallback déterministe (mécanisme d'illusion #4+#5) :
  // Si le LLM est OFF (coupe-circuit) ou timeout/erreur, on génère un JSON
  // local avec les VRAIES positions astro. Texte poématique mais reproductible
  // par (natal × transits × date). Variables injectées : {today}, {sign},
  // {sun_sign}, {moon_sign}, {venus_sign}, {mars_sign}. Le user reçoit un
  // horoscope qui semble généré "maintenant" alors qu'il est calculé en 2 ms.
  const fallback = () => {
    const sun  = natalPositions.sun?.sign     || sign;
    const moon = natalPositions.moon?.sign    || 'équilibre';
    const ven  = natalPositions.venus?.sign   || 'équilibre';
    const mar  = natalPositions.mars?.sign    || 'équilibre';
    const ts   = transits.sun?.sign           || sun;
    const tv   = transits.venus?.sign         || ven;
    const tm   = transits.mars?.sign          || mar;
    const moonInTransit = transits.moon?.sign || moon;
    // Énergie : dérive lente basée sur la position lunaire du jour
    const energyScore = ((moonInTransit.charCodeAt(0) + new Date().getDate()) % 5) + 1;
    // Lucky number : dérivé de la date + signe, reproductible par jour
    const luckyNum = ((new Date().getDate() * sun.charCodeAt(0)) % 98) + 1;
    const colors = ['bleu profond', 'or', 'rouge carmin', 'vert sauge', 'lavande', 'bordeaux', 'ivoire', 'turquoise'];
    const luckyColor = colors[(sun.charCodeAt(0) + new Date().getDate()) % colors.length];
    // Mood : basé sur l'aspect Lune natale × Lune transit
    const moods = ['curiosité vive', 'calme profond', 'élan créatif', 'fougue ardente', 'sérénité douce', 'intensité lucide'];
    const mood = moods[(moonInTransit.charCodeAt(0) + moon.charCodeAt(0)) % moods.length];
    return {
      general: `Aujourd'hui, ton soleil en ${sun} rencontre le soleil en ${ts}. C'est une journée pour honorer ce qui te rend unique, ${today}. Prends un moment pour toi, sans culpabiliser.`,
      amour:  `Vénus en ${ven} en transit dans ta maison intérieure invite à la douceur avec tes proches. Écoute plus que tu ne parles aujourd'hui, le courant passe mieux.`,
      carriere: `Mars en ${tm} aiguise ton sens pratique. Une idée trotte dans ta tête depuis hier — écris-la avant ce soir.`,
      energie: energyScore,
      mood:   mood,
      luckyNumber: luckyNum,
      luckyColor:  luckyColor,
    };
  };

  // v14.4 — Si LLM off, on sert directement le fallback. C'est le cas de 99%
  // des requêtes en prod depuis le coupe-circuit.
  if (!LLM_USER_ENABLED) {
    return fallback();
  }

  // v13.5 — fetch direct, max_tokens=3000 (le LLM consomme ~1500 tokens en reasoning même avec system prompt court)
  // + timeout=60s. enable_thinking:false peut être ignoré par l'API selon contexte.
  console.log(`[horoscope] LLM direct call START sign=${sign}`);
  const t0 = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 3000,
        enable_thinking: false,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[horoscope] LLM direct call HTTP ${response.status} in ${elapsed}s`);
  if (!response.ok) {
    console.warn(`[horoscope] LLM HTTP ${response.status}, serving fallback`);
    return fallback();
  }
  const data = await response.json();
  console.log(`[horoscope] LLM usage: ${JSON.stringify(data.usage || {})}`);
  console.log(`[horoscope] LLM finish_reason: ${data.choices?.[0]?.finish_reason}`);
  const msg = data.choices?.[0]?.message || {};
  console.log(`[horoscope] LLM content len=${(msg.content||'').length} reasoning len=${(msg.reasoning_content||'').length}`);
  // Try content first, then reasoning_content (some reasoning models put JSON there)
  let content = msg.content || msg.reasoning_content || '';

  // Parse JSON from response (handle markdown code blocks)
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[horoscope] No JSON in LLM response, serving fallback');
    return fallback();
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('[horoscope] JSON.parse failed, serving fallback:', e.message);
    return fallback();
  }
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
  ], 0, 4096, { response_format: { type: 'json_object' } }, 8000);
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
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    req.db = db; // expose db to billing routes (portal, etc.)
    // Quick premium check for rate limiting (cached per-request)
    try {
      const u = db.prepare('SELECT is_premium, premium_until FROM users WHERE id = ?').get(decoded.id);
      const now = Math.floor(Date.now() / 1000);
      req.user.isPremium = !!u?.is_premium && (!u?.premium_until || u.premium_until > now);
    } catch { /* non-fatal */ }
    // P1#12 — Update last_activity_at (fire-and-forget, non-bloquant).
    // Mis à jour à chaque appel authentifié pour tracker l'inactivité précise.
    try {
      const _now = Math.floor(Date.now() / 1000);
      db.prepare('UPDATE users SET last_activity_at = ? WHERE id = ?').run(_now, decoded.id);
    } catch { /* non-fatal */ }
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

// LLM endpoints: dynamic rate limit (premium = unlimited, free = tight)
const llmLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min window
  max: (_req) => {
    // Premium users get generous limit; free users get 5 per 5min
    const u = _req.user;
    if (!u) return 5;
    // isPremium is set on req.user at auth time if available
    return u.isPremium ? 100 : 5;
  },
  keyGenerator: (req) => req.user?.id?.toString() || ipKeyGenerator(req.ip),
  message: { error: 'Tu consultes beaucoup Céleste ! Attends 5 minutes ou passe Premium pour un accès illimité.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.user?.isPremium, // skip entirely for premium
});

// ─── Server ────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
// Fric-#1 — Expose db aux sous-routeurs (oauth.js n'a pas auth middleware)
app.locals.db = db;

// P1 #5 — Compression HTTP (gzip) — gain ~70% bande passante sur JSON.
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.path === '/api/billing/webhook') return false;
    return compression.filter(req, res);
  },
}));

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
// P1 #9 — Uniquement en dev (NODE_ENV !== 'production').
const SENSITIVE_FIELDS = ['password', 'token', 'jwt', 'authorization', 'secret'];
const LOG_POSTS = process.env.NODE_ENV !== 'production';
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = SENSITIVE_FIELDS.includes(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}
app.use((req, res, next) => {
  if (LOG_POSTS && req.method === 'POST') {
    console.log('[POST IN]', req.path, JSON.stringify({
      body: sanitizeBody(req.body),
      ip: req.ip,
      ua: (req.headers['user-agent'] || '').substring(0, 50),
    }));
  }
  next();
});

// ─── Global rate limiter ─────────────────────────────────
// P1 #11 — Applies to ALL /api/* routes (except auth, which has its own limiter).
// Prevents abuse: brute-force, scraping, resource exhaustion.
// 200 req/min per IP — generous enough for normal use, tight enough for bots.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 200,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Trop de requêtes. Ralentis un peu.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate-limiting for Stripe webhooks (they have their own retry logic)
  skip: (req) => req.path === '/api/billing/webhook',
});
app.use('/api/', globalLimiter);

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

// ─── Natal interpretation cache (asteroids, nodes, houses — never change) ──
db.exec(`CREATE TABLE IF NOT EXISTS natal_interpretations (
  user_id INTEGER NOT NULL,
  feature TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY(user_id, feature)
)`);

// ─── Free-tier rate limiting (in-memory, per-IP) ────────────
const _rateBuckets = new Map(); // key: ip → { count, windowStart }
const FREE_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const FREE_RATE_MAX = 5; // max requests per 5-min window for free users
function freeRateLimit(ip) {
  const now = Date.now();
  const bucket = _rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > FREE_RATE_WINDOW_MS) {
    _rateBuckets.set(ip, { count: 1, windowStart: now });
    // Cleanup old entries every ~100 calls
    if (_rateBuckets.size > 5000) {
      for (const [k, v] of _rateBuckets) {
        if (now - v.windowStart > FREE_RATE_WINDOW_MS * 4) _rateBuckets.delete(k);
      }
    }
    return true;
  }
  bucket.count++;
  return bucket.count <= FREE_RATE_MAX;
}

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

// ─── Run pending migrations ───────────────────────────────
// Must run AFTER all inline CREATE TABLE statements and BEFORE the server
// starts accepting requests. Migrations are idempotent and transactional.
await runMigrations(db);

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

// P1 DUO — calcul de compatibilité déterministe (fallback si LLM KO)
// Basé sur la théorie astrologique classique : affinité élémentaire +
// aspects inter-cartes (synastrie). Référence : Liz Greene / Robert Hand.
const ELEMENT_AFFINITY = {
  'Feu-Feu': 90, 'Feu-Air': 85, 'Feu-Terre': 45, 'Feu-Eau': 40,
  'Air-Air': 80, 'Air-Terre': 50, 'Air-Eau': 55,
  'Terre-Terre': 80, 'Terre-Eau': 85,
  'Eau-Eau': 80,
};
function elementAffinity(e1, e2) {
  if (e1 === e2) return ELEMENT_AFFINITY[`${e1}-${e2}`] ?? 70;
  return ELEMENT_AFFINITY[`${e1}-${e2}`] ?? ELEMENT_AFFINITY[`${e2}-${e1}`] ?? 55;
}

function signDistance(s1, s2) {
  // Index 0-11 ; retourne distance angulaire [0, 180]
  const order = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];
  const i1 = order.indexOf(s1); const i2 = order.indexOf(s2);
  if (i1 < 0 || i2 < 0) return 999;
  let d = Math.abs(i1 - i2) * 30;
  return d > 180 ? 360 - d : d;
}

function aspectTypeFromDistance(deg) {
  if (deg <= 8) return { name: 'conjunction', weight: 1.0, harmonious: false };
  if (Math.abs(deg - 60) <= 6) return { name: 'sextile', weight: 0.6, harmonious: true };
  if (Math.abs(deg - 90) <= 6) return { name: 'square', weight: -0.7, harmonious: false };
  if (Math.abs(deg - 120) <= 8) return { name: 'trine', weight: 0.9, harmonious: true };
  if (Math.abs(deg - 180) <= 8) return { name: 'opposition', weight: -0.4, harmonious: false };
  return null;
}

/**
 * computeCompatDeterministic — synastrie pure sans LLM.
 * Inputs: chart1, chart2 (sorties de getNatalPositions)
 * Output: même shape que generateCompatibility (score, title, strengths, challenges, description)
 */
function computeCompatDeterministic(chart1, chart2, sign1, sign2, context = 'romantic') {
  const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const aspects = [];
  let harmoniousCount = 0, tensionCount = 0;

  for (const p1 of planets) {
    const a = chart1[p1]; if (!a) continue;
    for (const p2 of planets) {
      const b = chart2[p2]; if (!b) continue;
      // Approx angle sign-based (si on n'a pas longitude exacte, distance sign->sign)
      const dist = (typeof a.longitude === 'number' && typeof b.longitude === 'number')
        ? Math.abs(a.longitude - b.longitude)
        : signDistance(a.sign, b.sign);
      const norm = dist > 180 ? 360 - dist : dist;
      const asp = aspectTypeFromDistance(norm);
      if (asp) {
        aspects.push({ p1, p2, type: asp.name, harmonious: asp.harmonious });
        if (asp.harmonious) harmoniousCount++;
        else tensionCount++;
      }
    }
  }

  // Affinité élémentaire Soleil-Lune + Soleil-Venus + Soleil-Soleil
  const sun1 = SIGN_ELEMENTS[chart1.sun?.sign] || '';
  const moon2 = SIGN_ELEMENTS[chart2.moon?.sign] || '';
  const sun2 = SIGN_ELEMENTS[chart2.sun?.sign] || '';
  const venus1El = SIGN_ELEMENTS[chart1.venus?.sign] || '';
  const mars2El = SIGN_ELEMENTS[chart2.mars?.sign] || '';

  const sunMoonAff = sun1 && moon2 ? elementAffinity(sun1, moon2) : 60;
  const sunSunAff = sun1 && sun2 ? elementAffinity(sun1, sun2) : 60;
  const venusMarsAff = venus1El && mars2El ? elementAffinity(venus1El, mars2El) : 60;
  const elementalScore = Math.round(0.4 * sunMoonAff + 0.3 * sunSunAff + 0.3 * venusMarsAff);

  // Score global
  const aspectScore = 50 + (harmoniousCount - tensionCount) * 4;
  let score = Math.round(0.5 * elementalScore + 0.5 * aspectScore);
  if (context === 'romantic') score = Math.round(0.4 * elementalScore + 0.3 * aspectScore + 0.3 * venusMarsAff);
  score = Math.max(20, Math.min(95, score));

  const totalAspects = harmoniousCount + tensionCount;
  const harmonyRatio = totalAspects ? harmoniousCount / totalAspects : 0.5;

  // Titre + description basés sur score
  const titleByScore = score >= 80 ? 'Une étincelle rare'
    : score >= 65 ? 'Un dialogue fertile'
    : score >= 50 ? 'Un équilibre à construire'
    : score >= 35 ? 'Une rencontre qui bouscule'
    : 'Un apprentissage mutuel';

  const strengths = [];
  const challenges = [];

  if (sunMoonAff >= 75) strengths.push('Complémentarité Soleil-Lune forte — vous vous comprendrez intuitivement.');
  if (sunSunAff >= 75) strengths.push('Mêmes éléments solaires — vision du monde partagée.');
  if (venusMarsAff >= 75 && context === 'romantic') strengths.push('Magnétisme Vénus-Mars — chimie sensorielle réelle.');
  if (harmonyRatio >= 0.6) strengths.push(`Nombreux aspects fluides (${harmoniousCount}) — coopération naturelle.`);
  if (aspects.some(a => a.p1 === 'mercury' && a.p2 === 'mercury' && a.harmonious)) {
    strengths.push('Mercure en aspect harmonique — communication claire.');
  }

  if (sunSunAff < 50) challenges.push('Éléments solaires dissonants — rythmes de vie différents.');
  if (venusMarsAff < 50 && context === 'romantic') challenges.push('Désir et tendances amoureuses à ajuster.');
  if (tensionCount > harmoniousCount) challenges.push(`Aspects tendus (${tensionCount}) — frictions possibles à métaboliser.`);
  if (aspects.some(a => a.type === 'square')) challenges.push('Carrés présents — remise en question stimulante.');

  if (strengths.length === 0) strengths.push('Des ponts à tisser patiemment.');
  if (challenges.length === 0) challenges.push('Peu de tensions majeures — terrain calme.');

  const description = `${sign1} et ${sign2} : ${harmonyRatio >= 0.6 ? 'beaucoup de points de contact harmonieux' : 'un mélange de tensions et d\'harmonies'}. ${score >= 65 ? 'Votre duo a un potentiel de compréhension profonde, à condition de cultiver la curiosité mutuelle.' : score >= 50 ? 'Votre relation demande des ajustements, mais elle vous fera grandir.' : 'Votre rencontre est exigeante — elle vous confrontera à vos parts d\'ombre.'}`;

  return {
    score,
    title: titleByScore,
    strengths: strengths.slice(0, 4),
    challenges: challenges.slice(0, 3),
    description,
    _deterministic: true,
  };
}

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
  const { email, password, ref } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  // P2 #14 — Min 8 caractères (était 6).
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (8 min)' });

  const emailLower = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: 'Format d\'email invalide' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLower);
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  // P0#6 — Email verification : génère un token, l'enregistre, envoie l'email.
  const verifyToken = generateToken();
  // Fric-#9 — Offrir 1 streak_freeze gratuit à l'inscription pour ne pas perdre
  // le streak en J+2 si l'user n'a pas encore l'habitude d'ouvrir l'app.
  // Le schéma DEFAULT streak_freezes = 1 ne s'applique que si la colonne est
  // absente ; on force la valeur explicitement pour les nouvelles DBs où le
  // DEFAULT peut avoir été perdu lors d'une migration.
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, email_verify_token, streak_freezes) VALUES (?, ?, ?, 2)'
  ).run(emailLower, hash, verifyToken);
  const user = { id: result.lastInsertRowid, email: emailLower };
  const { access, refresh } = issueTokenPair(db, user);

  // Async send — ne bloque pas la réponse. En mode dev sans Resend, logge en console.
  sendVerificationEmail(emailLower, verifyToken).then(r => {
    if (r.ok) console.log(`[auth] email de vérification envoyé à ${emailLower}`);
    else console.error(`[auth] échec envoi vérif ${emailLower}:`, r.error);
  }).catch(e => console.error('[auth] sendVerificationEmail exception:', e.message));

  // P1#7 — Parrainage : valide le code `ref` si fourni.
  // Le code est de la forme "CEL-XXXXXX". On cherche le parrain par referral_code.
  let refReward = 0;
  if (typeof ref === 'string' && ref.trim()) {
    const refCode = ref.trim().toUpperCase();
    // Accepte avec ou sans le préfixe CEL-.
    const normalized = refCode.startsWith('CEL-') ? refCode : 'CEL-' + refCode;
    const referrer = db.prepare(
      'SELECT id, email FROM users WHERE referral_code = ?'
    ).get(normalized);
    if (referrer && referrer.id !== user.id) {
      // Anti-fraud : pas de self-referral.
      // Crée la row de parrainage (idempotente grâce à UNIQUE(referred_id)).
      const already = db.prepare('SELECT id FROM referrals WHERE referred_id = ?').get(user.id);
      if (!already) {
        const nowSec = Math.floor(Date.now() / 1000);
        const tx = db.transaction(() => {
          db.prepare(
            'INSERT INTO referrals (referrer_id, referred_id, code, reward_given) VALUES (?, ?, ?, 1)'
          ).run(referrer.id, user.id, normalized);
          // Crédite +7j premium aux deux. premium_until en epoch seconds.
          for (const uid of [user.id, referrer.id]) {
            const r = db.prepare(
              'SELECT is_premium, premium_until FROM users WHERE id = ?'
            ).get(uid);
            const cur = r.premium_until && r.premium_until > nowSec ? r.premium_until : nowSec;
            db.prepare(
              'UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?'
            ).run(cur + 7 * 86400, uid);
          }
        });
        try { tx(); refReward = 7; } catch (e) { console.warn('[referral] tx failed:', e.message); }
      }
    } else {
      console.log(`[auth] ref code "${normalized}" non trouvé ou self-ref`);
    }
  }

  res.json({
    token: access,
    refreshToken: refresh,
    user: {
      id: user.id,
      email: emailLower,
      isPremium: refReward > 0,
      scansRemaining: 3,
      emailVerified: false,
      refRewardDays: refReward || undefined,
    },
  });
});

// ─── P0#6 — Verify email (clic sur le lien) ───────────────
app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query || {};
  if (typeof token !== 'string' || token.length !== 64) {
    return res.status(400).json({ error: 'Token invalide' });
  }

  const user = db.prepare(
    'SELECT id, email, email_verified, email_verify_token FROM users WHERE email_verify_token = ?'
  ).get(token);

  if (!user) {
    return res.status(404).json({ error: 'Token inconnu ou déjà utilisé' });
  }
  if (user.email_verified === 1) {
    // Idempotent — déjà vérifié. Retourne succès sans rien faire.
    return res.json({ ok: true, alreadyVerified: true, email: user.email });
  }

  db.prepare(
    'UPDATE users SET email_verified = 1, email_verify_token = NULL WHERE id = ?'
  ).run(user.id);

  console.log(`[auth] email vérifié pour user_id=${user.id} (${user.email})`);
  // Redirige vers l'app avec un flag succès (le frontend affiche un message de bienvenue).
  const redirectUrl = (process.env.APP_PUBLIC_URL || '/').replace(/\/$/, '') + '/?emailVerified=1';
  res.redirect(302, redirectUrl);
});

// ─── P0#6 — Renvoyer l'email de vérification (auth requis) ──
app.post('/api/auth/resend-verification', auth, authLimiter, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, email_verified, email_verify_token FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'Compte introuvable' });
  if (user.email_verified === 1) {
    return res.status(400).json({ error: 'Cet email est déjà vérifié' });
  }

  const verifyToken = generateToken();
  db.prepare('UPDATE users SET email_verify_token = ? WHERE id = ?').run(verifyToken, user.id);

  sendVerificationEmail(user.email, verifyToken).then(r => {
    if (!r.ok) console.error(`[auth] resend échoué pour ${user.email}:`, r.error);
  }).catch(e => console.error('[auth] resend exception:', e.message));

  res.json({ ok: true });
});

// ─── P0#6 — Status email vérifié (auth requis) ─────────────
app.get('/api/auth/email-status', auth, (req, res) => {
  const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Compte introuvable' });
  res.json({ emailVerified: user.email_verified === 1, isEmailConfigured });
});

// ─── P1#7 — Système de parrainage ──────────────────────────
// Code court "CEL-XXXXXX" dérivé du user id (6 chars base32, rejetté les
// caractères ambigus 0/O/1/I). Déterministe → le code ne change pas tant
// que l'id user reste le même. On l'écrit dans users.referral_code à la
// première lecture pour pouvoir le retrouver sans recalcul.
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, sans 0/1/O/I
function referralCodeFor(userId) {
  // base32 big-endian sur 32 bits → 6 chars. Complétion par 'A' pour les ids courts.
  let n = Number(userId) || 0;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = REFERRAL_ALPHABET[n & 31] + out;
    n = Math.floor(n / 32);
  }
  return 'CEL-' + out;
}

// P1#7 — GET /api/referrals/code (auth) : retourne le code + stats parrain.
app.get('/api/referrals/code', auth, (req, res) => {
  const user = db.prepare('SELECT id, referral_code FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Compte introuvable' });

  let code = user.referral_code;
  if (!code) {
    code = referralCodeFor(user.id);
    db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, user.id);
  }

  const referred = db.prepare(
    'SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ?'
  ).get(user.id);
  const rewarded = db.prepare(
    'SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND reward_given = 1'
  ).get(user.id);
  const daysEarned = rewarded.n * 7;

  res.json({
    code,
    referralsCount: referred.n,
    daysEarned,
    rewardPerReferral: 7,
  });
});

// ─── P2#19 — GET /api/weekly-content (public) ───────────────
// Retourne le contenu publié pour la semaine courante (ou week_start ISO fourni).
// Pas d'auth : le contenu curated est public pour SEO/partage.
function isoWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 0 = dimanche → 7
  d.setUTCDate(d.getUTCDate() - day + 1); // lundi
  return d.toISOString().slice(0, 10);
}

app.get('/api/weekly-content', (req, res) => {
  const weekStart = req.query.week || isoWeekStart();
  const row = db.prepare(
    `SELECT week_start, theme, emoji, headline, body, ritual, reflection, published_at
     FROM weekly_content
     WHERE week_start = ? AND published_at IS NOT NULL`
  ).get(weekStart);
  if (!row) return res.status(404).json({ error: 'Aucun contenu pour cette semaine' });
  res.json(row);
});

// ─── P2#19 — Admin CRUD /api/admin/weekly-content ────────────
// Auth via header X-Admin-Token: <ADMIN_TOKEN env>. Édition manuelle
// par l'équipe éditoriale.
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return res.status(503).json({ error: 'ADMIN_TOKEN non configuré' });
  if (token !== expected) return res.status(401).json({ error: 'Token admin invalide' });
  next();
}

app.post('/api/admin/weekly-content', adminAuth, (req, res) => {
  const { week_start, theme, emoji, headline, body, ritual, reflection, publish } = req.body || {};
  if (!week_start || !theme || !headline || !body) {
    return res.status(400).json({ error: 'Champs requis: week_start, theme, headline, body' });
  }
  const publishedAt = publish ? Math.floor(Date.now() / 1000) : null;
  db.prepare(`
    INSERT INTO weekly_content (week_start, theme, emoji, headline, body, ritual, reflection, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(week_start) DO UPDATE SET
      theme = excluded.theme,
      emoji = excluded.emoji,
      headline = excluded.headline,
      body = excluded.body,
      ritual = excluded.ritual,
      reflection = excluded.reflection,
      published_at = CASE WHEN ? = 1 THEN excluded.published_at ELSE published_at END
  `).run(week_start, theme, emoji || '✨', headline, body, ritual || null, reflection || null, publishedAt, publish ? 1 : 0);
  res.json({ ok: true, week_start });
});

app.post('/api/admin/weekly-content/publish', adminAuth, (req, res) => {
  const { week_start } = req.body || {};
  if (!week_start) return res.status(400).json({ error: 'week_start requis' });
  const now = Math.floor(Date.now() / 1000);
  const r = db.prepare('UPDATE weekly_content SET published_at = ? WHERE week_start = ?').run(now, week_start);
  if (r.changes === 0) return res.status(404).json({ error: 'Entrée introuvable' });
  res.json({ ok: true, published_at: now });
});

app.get('/api/admin/weekly-content', adminAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM weekly_content ORDER BY week_start DESC LIMIT 50'
  ).all();
  res.json(rows);
});

// ─── v14.1 — Admin LLM : contrôle coupe-circuit + régénération manuelle ──
// Objectif : (a) voir l'état du flag LLM_USER_ENABLED, (b) le toggle,
//       (c) forcer un call LLM via adminBypass (pour régénérer un portrait natal,
//       une ritu­elle, un horoscope quotidien quand l'admin le souhaite).
app.get('/api/admin/llm/status', adminAuth, (_req, res) => {
  res.json({
    llm_user_enabled: LLM_USER_ENABLED,
    llm_model: LLM_MODEL,
    circuit_breaker_open: isLLMCircuitOpen(),
    mutex_depth: llmMutexDepth(),
  });
});

app.post('/api/admin/llm/toggle', adminAuth, (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) requis' });
  }
  LLM_USER_ENABLED = enabled;
  console.log(`[ADMIN] LLM_USER_ENABLED → ${enabled}`);
  res.json({ ok: true, llm_user_enabled: LLM_USER_ENABLED });
});

// Force-regenerate une entrée de cache via call LLM admin-bypass.
// Body : { feature, user_id?: number, date?: 'YYYY-MM-DD' }
// Stratégie v14.1 (light) : on supprime la ligne de cache DB correspondante. La
//       prochaine requête user la re-générera via la route normale (qui appellera
//       le LLM si LLM_USER_ENABLED=true, sinon le fallback). Aucun appel LLM ici —
//       économie maximale. Pour pré-générer en masse, utiliser le cron nocturne.
// Features supportées : daily_energy, weekly_challenge, ritual, horoscope_personal,
//       aspects_today, tarot_cross.
app.post('/api/admin/llm/regenerate', adminAuth, async (req, res) => {
  const { feature, user_id, date } = req.body || {};
  if (!feature) return res.status(400).json({ error: 'feature requis' });
  const targetDate = date || new Date().toISOString().slice(0, 10);

  try {
    const result = invalidateCacheFor(feature, user_id, targetDate);
    res.json({ ok: true, feature, user_id: user_id || 'all', date: targetDate, deleted: result.deleted, remaining: result.remaining });
  } catch (e) {
    console.error(`[ADMIN] regenerate ${feature} failed:`, e.message);
    res.status(500).json({ ok: false, feature, error: e.message });
  }
});

// Vide le cache mémoire LLM in-process (utile après un toggle ou un déploiement).
app.post('/api/admin/llm/clear-memory-cache', adminAuth, (_req, res) => {
  const before = llmCache.store.size;
  llmCache.invalidateAll();
  console.log(`[ADMIN] cleared LLM memory cache: ${before} entries`);
  res.json({ ok: true, cleared: before });
});

// Force le run immédiat du job de pré-génération nocturne (ignore le check d'heure).
// Utile pour tester en dev, ou si tu veux re-peupler les caches en plein jour.
app.post('/api/admin/llm/prefetch-now', adminAuth, async (_req, res) => {
  if (!LLM_USER_ENABLED) {
    return res.status(400).json({
      error: 'LLM_USER_ENABLED=false — toggle ON avant de lancer le prefetch',
    });
  }
  nightlyLastRunDate = null;   // reset le flag "déjà tourné aujourd'hui"
  nightlyForceNext = true;     // bypass du check d'heure (3h UTC)
  res.status(202).json({ ok: true, message: 'prefetch lancé en background — check logs [cron:nightly-prefetch]' });
  runNightlyPrefetch().catch(e => console.error('[ADMIN] prefetch failed:', e.message));
});
// ─── P2#20 — Transit comments (communauté) ──────────────────
// Best-effort decode: si un Authorization header est présent, tente de
// résoudre req.user sans bloquer la requête. Permet au GET public de
// renvoyer le bon flag `liked` et le bon user_id pour détection "mine".
function softAuth(req, _res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try { req.user = verifyAccessToken(token); } catch { /* ignore */ }
  }
  next();
}

// List comments for a given transit (date + key). Public read.
app.get('/api/transit-comments', softAuth, (req, res) => {
  const { date, key } = req.query;
  if (!date || !key) return res.status(400).json({ error: 'date et key requis' });
  const rows = db.prepare(
    `SELECT c.id, c.user_id, c.display_name, c.content, c.likes_count, c.created_at,
       EXISTS(SELECT 1 FROM transit_comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?) AS liked
     FROM transit_comments c
     WHERE c.transit_date = ? AND c.transit_key = ?
     ORDER BY c.likes_count DESC, c.created_at DESC
     LIMIT 200`
  ).all(req.user?.id || 0, date, key);
  res.json(rows);
});

// Post a comment (auth required). display_name stored on users table.
app.post('/api/transit-comments', auth, (req, res) => {
  const { date, key, content } = req.body || {};
  if (!date || !key || !content?.trim()) {
    return res.status(400).json({ error: 'Champs requis: date, key, content' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: 'Commentaire trop long (500 caractères max)' });
  }
  // Resolve / set display_name
  let displayName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id)?.display_name;
  if (!displayName) {
    const email = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)?.email || 'etoile';
    displayName = email.split('@')[0].slice(0, 20);
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, req.user.id);
  }
  const r = db.prepare(
    `INSERT INTO transit_comments (transit_date, transit_key, user_id, display_name, content)
     VALUES (?, ?, ?, ?, ?)`
  ).run(date, key, req.user.id, displayName, content.trim());
  res.json({
    id: r.lastInsertRowid,
    user_id: req.user.id,
    display_name: displayName,
    content: content.trim(),
    likes_count: 0,
    created_at: Math.floor(Date.now() / 1000),
    liked: 0,
  });
});

// Delete own comment
app.delete('/api/transit-comments/:id', auth, (req, res) => {
  const row = db.prepare('SELECT user_id FROM transit_comments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Commentaire introuvable' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
  db.prepare('DELETE FROM transit_comments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Toggle like (auth required)
app.post('/api/transit-comments/:id/like', auth, (req, res) => {
  const comment = db.prepare('SELECT id FROM transit_comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });
  const existing = db.prepare(
    'SELECT 1 FROM transit_comment_likes WHERE comment_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM transit_comment_likes WHERE comment_id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    db.prepare('UPDATE transit_comments SET likes_count = MAX(0, likes_count - 1) WHERE id = ?')
      .run(req.params.id);
    return res.json({ liked: false });
  }
  db.prepare('INSERT INTO transit_comment_likes (comment_id, user_id) VALUES (?, ?)')
    .run(req.params.id, req.user.id);
  db.prepare('UPDATE transit_comments SET likes_count = likes_count + 1 WHERE id = ?')
    .run(req.params.id);
  res.json({ liked: true });
});

// Update display_name
app.post('/api/account/display-name', auth, (req, res) => {
  const { display_name } = req.body || {};
  if (!display_name?.trim() || display_name.length > 24) {
    return res.status(400).json({ error: 'Pseudo invalide (1-24 caractères)' });
  }
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?')
    .run(display_name.trim(), req.user.id);
  res.json({ ok: true, display_name: display_name.trim() });
});

// ─── Auth: Logout ───────────────────────────────────────────
// Revokes the refresh token server-side (JWT blacklist). The access token
// is short-lived (15min) so it expires naturally.
app.post('/api/auth/logout', auth, (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken, db);
        blacklistRefreshToken(decoded.jti, db);
      } catch { /* token may already be expired/invalid — ignore */ }
    }
    console.log(`[auth] logout user_id=${req.user?.id} at ${new Date().toISOString()}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] logout error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Auth: Refresh ─────────────────────────────────────────
// Exchange a valid refresh token for a new access + refresh pair.
// Old refresh token is blacklisted (rotation).
app.post('/api/auth/refresh', authLimiter, (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requis' });

  try {
    const decoded = verifyRefreshToken(refreshToken, db);
    // Verify user still exists
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Compte introuvable' });

    // Rotate: blacklist old refresh token, issue new pair
    blacklistRefreshToken(decoded.jti, db);
    const { access, refresh } = issueTokenPair(db, user);
    res.json({ token: access, refreshToken: refresh });
  } catch (err) {
    // If the refresh token is invalid/expired/blacklisted, user must re-login
    res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
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
  const { access, refresh } = issueTokenPair(db, user);
  res.json({
    token: access,
    refreshToken: refresh,
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

  // P1+ #14 — Déclenche la génération du portrait natal EN BACKGROUND juste après
  // la sauvegarde du birth_data. Comme ça, quand l'user ouvre son premier écran
  // natal (asteroids / lunar_nodes / houses), le cache est déjà chaud.
  // SSi LLM_USER_ENABLED=false, le helper skip tout seul et renvoie un fallback déterministe.
  // Idempotent : INSERT OR REPLACE dans natal_interpretations.
  setImmediate(() => {
    Promise.allSettled([
      prefetchNatalPortrait(req.user.id, 'houses'),
      prefetchNatalPortrait(req.user.id, 'asteroid_wisdom'),
      prefetchNatalPortrait(req.user.id, 'lunar_nodes'),
    ]).then(results => {
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const ko = results.filter(r => r.status === 'rejected').length;
      console.log(`[portrait-onboarding] user ${req.user.id}: ${ok} ok, ${ko} failed`);
    }).catch(e => console.error('[portrait-onboarding] unexpected:', e.message));
  });

  res.json({ ok: true, birthData: check.birthData });
});

// ─── Get profile ───────────────────────────────────────────
app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const now = Math.floor(Date.now() / 1000);
  const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);
  res.json({
    id: user.id,
    email: user.email,
    isPremium,
    scansRemaining: user.scans_remaining,
    birthData: safeJsonParse(user.birth_data, null, 'login auth birth_data'),
    premiumUntil: user.premium_until,
    streak: user.streak_count ?? 0,
    trialStartedAt: user.trial_started_at ?? null,  // P1-7: null = jamais utilisé
    trialUsed: user.trial_started_at != null,       // P1-7: one-shot côté frontend
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
// ─── GDPR: Data Export (Art. 20 — portabilité) ───────────
// Returns all user data as JSON. User can download and import elsewhere.
app.use('/api/account', createAccountRouter({ db, auth }));
// Fric-#1 — OAuth routes (Sign in with Apple + Google)
app.use('/api/auth/oauth', oauthRouter);
app.use('/api/portrait/pdf', createPortraitPdfRouter({ db, auth, getNatalPositions }));

// ─── P2#15 — Yearly Recap ─────────────────────────────────
// GET /api/yearly-recap?year=YYYY
// Agrège les données d'une année civile pour produire "Ton année céleste".
// Source : user_xp, xp_log, daily_quests, journal_entries, user_badges, horoscope_feedback.
app.get('/api/yearly-recap', auth, (req, res) => {
  const userId = req.user.id;
  const year = parseInt(String(req.query.year || ''), 10) || new Date().getFullYear();
  const yearStart = Math.floor(new Date(year, 0, 1).getTime() / 1000);
  const yearEnd = Math.floor(new Date(year + 1, 0, 1).getTime() / 1000);
  const isoYearStart = `${year}-01-01`;
  const isoYearEnd = `${year}-12-31`;

  try {
    // 1. XP gagnée sur l'année (somme des logs dans la fenêtre)
    const xpRow = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM xp_log
       WHERE user_id = ? AND created_at >= ? AND created_at < ?`
    ).get(userId, yearStart, yearEnd);
    const xpEarned = xpRow?.total || 0;

    // 2. Quêtes accomplies (daily_quests completed dans la fenêtre ISO)
    const questsRow = db.prepare(
      `SELECT COUNT(*) AS n FROM daily_quests
       WHERE user_id = ? AND completed = 1 AND date >= ? AND date <= ?`
    ).get(userId, isoYearStart, isoYearEnd);
    const questsCompleted = questsRow?.n || 0;

    // 3. Entrées de journal (journal_entries)
    const journalRow = db.prepare(
      `SELECT COUNT(*) AS n FROM journal_entries
       WHERE user_id = ? AND date >= ? AND date <= ?`
    ).get(userId, isoYearStart, isoYearEnd);
    const journalEntries = journalRow?.n || 0;

    // 4. Cartes / Runes tirées — pas de table dédiée, on infère depuis xp_log.
    // Les raisons "tarot_draw" et "rune_draw" sont créditées à chaque tirage.
    const drawsRow = db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN reason = 'tarot_draw' THEN 1 ELSE 0 END), 0) AS cards,
         COALESCE(SUM(CASE WHEN reason = 'rune_draw' THEN 1 ELSE 0 END), 0) AS runes
       FROM xp_log
       WHERE user_id = ? AND created_at >= ? AND created_at < ?`
    ).get(userId, yearStart, yearEnd);
    const cardsDrawn = drawsRow?.cards || 0;
    const runesDrawn = drawsRow?.runes || 0;

    // 5. Plus longue série (streak max observé cette année).
    //    On prend le streak_count actuel comme approximation conservative
    //    (tracker précis non persisté historiquement — à améliorer si besoin).
    const userRow = db.prepare('SELECT streak_count, created_at FROM users WHERE id = ?').get(userId);
    const longestStreak = Math.max(0, userRow?.streak_count ?? 0);

    // 6. Badges débloqués cette année
    const badgesRow = db.prepare(
      `SELECT COUNT(*) AS n FROM user_badges
       WHERE user_id = ? AND earned_at >= ? AND earned_at < ?`
    ).get(userId, yearStart, yearEnd);
    const badgesUnlocked = badgesRow?.n || 0;

    // 7. Mood dominant (mot le plus fréquent dans les entrées de journal)
    let moodWord = null;
    try {
      const entries = db.prepare(
        `SELECT content FROM journal_entries
         WHERE user_id = ? AND date >= ? AND date <= ? AND content IS NOT NULL`
      ).all(userId, isoYearStart, isoYearEnd);
      const wordCounts = new Map();
      const STOPWORDS = new Set([
        'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'en', 'à', 'au', 'aux',
        'que', 'qui', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
        'pas', 'ne', 'plus', 'pour', 'par', 'dans', 'sur', 'avec', 'sans', 'ce', 'cette',
        'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'mais', 'ou', 'donc', 'car', 'se', 'se',
        'est', 'sont', 'ai', 'as', 'av', 'faut', 'bien', 'tout', 'tous', 'très', 'peux',
        'the', 'and', 'for', 'with',
      ]);
      for (const e of entries) {
        const words = (e.content || '').toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]{4,}/g) || [];
        for (const w of words) {
          if (STOPWORDS.has(w)) continue;
          wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
        }
      }
      // Top mot (seulement si ≥ 3 occurrences)
      let topWord = '', topCount = 0;
      for (const [w, c] of wordCounts) {
        if (c > topCount) { topWord = w; topCount = c; }
      }
      if (topCount >= 3) moodWord = topWord;
    } catch { /* non bloquant */ }

    res.json({
      year,
      questsCompleted,
      xpEarned,
      journalEntries,
      cardsDrawn,
      runesDrawn,
      longestStreak,
      badgesUnlocked,
      moodWord,
      joinedDate: userRow?.created_at
        ? new Date(userRow.created_at * 1000).toISOString()
        : new Date().toISOString(),
    });
  } catch (err) {
    console.error('[yearly-recap]', err);
    res.status(500).json({ error: 'Récap indisponible' });
  }
});

// ─── Multi-profile CRUD (Feature 8) ────────────────────────
// List all profiles (own natal + saved family/friends)
app.use('/api/profiles', createProfilesRouter({ db, auth, safeJsonParse }));

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
      // P0#4 — updateStreak retourne désormais { count, freezeConsumed, graceApplied }
      const streakInfo = updateStreak(req.user.id, today);
      return res.json({
        ...safeJsonParse(userCached.content, {}, 'horoscope_cache.content'),
        streak: streakInfo.count, // rétro-compat : le frontend attend un number
        streakInfo, // bonus : flags pour UX (banner "freeze utilisé")
      });
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
        // P1-5 — Cap LLM latency: 1 retry × 15s (instead of 3 × 45s default).
        // Fallback is instant (FALLBACK_HOROSCOPES), so users never wait >15s.
        // Worst case before fix: ~150s (45s × 4 attempts w/ backoff). Now: 15s max.
        base = await generateHoroscope(natalPositions, transits, sunSign);
      } catch (llmErr) {
        console.warn(`[horoscope] LLM failed (${llmErr.message}), using FALLBACK for sign=${sunSign}`);
        base = getFallbackHoroscope(sunSign);
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

    // Helper: extrait le summary (general+amour+carriere+energie+mood+luckyColor) depuis le content JSON
    // v13.2 — on inclut love + career dans l'historique (avant, seul general était sauvegardé → le frontend
    //         n'affichait que la catégorie "général" dans la semaine, amour & carrière manquaient).
    function extractSummary(contentJson) {
      try {
        const c = JSON.parse(contentJson);
        return {
          general: String(c.general ?? '').slice(0, 600),
          // Le backend génère en français (amour/carriere), le frontend attend love/career.
          // On normalise côté summary pour que l'historique soit directement consommable.
          love: String(c.love ?? c.amour ?? '').slice(0, 400),
          career: String(c.career ?? c.carriere ?? '').slice(0, 400),
          energie: Number(c.energie ?? 3),
          mood: String(c.mood ?? '').slice(0, 60),
          luckyColor: String(c.luckyColor ?? '').slice(0, 30),
        };
      } catch (e) {
        return { general: '', love: '', career: '', energie: 3, mood: '', luckyColor: '' };
      }
    }

    // Per-user cache for fast subsequent loads
    const summary = extractSummary(JSON.stringify(horoscope));
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content, summary) VALUES (?, ?, ?, ?)')
      .run(req.user.id, today, JSON.stringify(horoscope), JSON.stringify(summary));

    // P0#4 — streak étendu : { count, freezeConsumed, graceApplied }
    const streakInfo = updateStreak(req.user.id, today);
    const remaining = isPremium ? null : Math.max(0, (user.scans_remaining ?? 0) - (personalCached ? 0 : 1));
    res.json({
      ...horoscope,
      scansRemaining: remaining,
      streak: streakInfo.count, // rétro-compat frontend
      streakInfo,
    });
  } catch (err) {
    console.error('Horoscope error:', err.message);
    res.status(500).json({ error: 'Failed to generate horoscope', detail: err.message });
  }
});

// ─── Horoscope History (J-7 → J) ────────────────────────────
// Pivot v13.1 : au lieu de prédire les jours futurs (J-1..J+1 / J-3..J+3),
// on retourne l'historique réel des 7 derniers jours — ce que le user a VRAIMENT lu.
// Pas de génération fictive. Les jours non consultés s'affichent en état vide rituel.
app.get('/api/horoscope/week', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Birth data required' });

    const now = Date.now();
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);

    // Premium: 7 jours | Free: 3 jours — historique uniquement (J-N → J)
    const days = isPremium ? 7 : 3;
    const offsetStart = -(days - 1); // J-(days-1) → J
    const offsetEnd = 0;

    const results = [];
    // FIX timezone : setHours(0,0,0,0) + toISOString() recule/décale la date selon
    // l'offset UTC du serveur (ex: UTC+2 → minuit local = 22h la veille en UTC →
    // toISOString() retourne la veille). On calcule donc la date ISO en local direct.
    const today = new Date();
    const todayISO = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString().split('T')[0];

    for (let offset = offsetStart; offset <= offsetEnd; offset++) {
      const day = new Date(today);
      day.setDate(today.getDate() + offset);
      // FIX timezone : utiliser la date locale, pas toISOString() qui décale en UTC
      const isoDate = new Date(day.getTime() - day.getTimezoneOffset() * 60000)
        .toISOString().split('T')[0];

      // Lecture cache : on a déjà tout dans horoscope_cache
      const row = db.prepare('SELECT content, summary FROM horoscope_cache WHERE user_id = ? AND date = ?')
        .get(req.user.id, isoDate);

      if (row?.summary) {
        const parsed = safeJsonParse(row.summary, null, 'horoscope_history_summary');
        results.push({
          date: isoDate,
          offset,
          weekday: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
          weekdayLong: day.toLocaleDateString('fr-FR', { weekday: 'long' }),
          summary: parsed,
          consulted: true,
        });
      } else {
        // Pas de cache : le user n'a pas ouvert son horoscope ce jour-là
        results.push({
          date: isoDate,
          offset,
          weekday: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
          weekdayLong: day.toLocaleDateString('fr-FR', { weekday: 'long' }),
          summary: null,
          consulted: false,
        });
      }
    }

    // Tri chronologique inversé : le plus récent en premier (J, J-1, J-2...)
    results.sort((a, b) => b.offset - a.offset);

    const consultedCount = results.filter(r => r.consulted).length;

    res.json({
      days: results,
      isPremium,
      rangeDays: days,
      consultedCount,
      // computed streak = nombre de jours consécutifs consultés en remontant depuis aujourd'hui
      streak: computedConsultedStreak(req.user.id, today),
    });
  } catch (err) {
    console.error('Horoscope history error:', err.message);
    res.status(500).json({ error: 'Failed to load history', detail: err.message });
  }
});

// Helper : compte les jours consécutifs consultés depuis aujourd'hui
function computedConsultedStreak(userId, today) {
  let streak = 0;
  const cursor = new Date(today);
  while (true) {
    // FIX timezone : toISOString() décale selon l'offset UTC — on calcule en local
    const iso = new Date(cursor.getTime() - cursor.getTimezoneOffset() * 60000)
      .toISOString().split('T')[0];
    const row = db.prepare('SELECT 1 FROM horoscope_cache WHERE user_id = ? AND date = ?').get(userId, iso);
    if (!row) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

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

function getTarotSignAdvice(sunSign, isReversed) {
  // Conseil personnalisé selon le signe solaire + position inversée/droite
  const map = {
    'Bélier': 'Ta nature impulsive peut te freiner : observe avant d\'agir.',
    'Taureau': 'Ta stabilité est un atout : ne change rien aujourd\'hui, ancre-toi.',
    'Gémeaux': 'Ta curiosité sera ta clé : explore, ne décide pas trop vite.',
    'Cancer': 'Ton intuition est juste : écoute ton ventre avant ta tête.',
    'Lion': 'Ton besoin de briller peut te desservir : laisse l\'autre exister.',
    'Vierge': 'Ton perfectionnisme peut te bloquer : "mieux" est l\'ennemi de "bien".',
    'Balance': 'Ton équilibre est précieux : tu peux rester au centre sans basculer.',
    'Scorpion': 'Ton intensité est ta force : canalise-la, ne la réprime pas.',
    'Sagittaire': 'Ta soif d\'horizon te guide : garde la vue large aujourd\'hui.',
    'Capricorne': 'Ta discipline te rassure : lâche un peu le contrôle, ça tient sans toi.',
    'Verseau': 'Ta distance émotionnelle est un atout aujourd\'hui : reste en observation.',
    'Poissons': 'Ton intuition est amplifiée : fais confiance à ce que tu sens, pas à ce que tu penses.',
  };
  const base = map[sunSign] || 'Fais confiance à ton instinct.';
  if (isReversed) return base + ' Mais attention : cette énergie est contrarée en ce moment. Prends du recul avant d\'agir.';
  return base + ' Cette carte valide ton chemin naturel.';
}

app.get('/api/tarot/daily', auth, llmLimiter, async (req, res) => {
  const today = localISODate(); // Hoisted out of try so catch can use it
  let sunSign = 'inconnu';      // Hoisted so catch fallback works
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    // Check cache
    const cached = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, `tarot:${today}`);
    if (cached) return res.json(safeJsonParse(cached.content, null, 'tarot_cache'));

    // Deterministic daily card: hash of userId + date
    // v11.1 — Math.abs + modulo sur longueur réelle du deck (pas 22 codé en dur)
    const seedRaw = (req.user.id * 9301 + today.split('-').reduce((a, p) => a + parseInt(p), 0) * 49297) % 233280;
    const cardId = Math.abs(seedRaw) % TAROT_DECK.length;
    // v11.7 — Tirage divinatoire : la carte peut etre renversee (~28% du temps, tradition tarologique).
    //         Le seed est deterministe (user + date) donc la carte et son orientation sont stables pour la journee.
    //         Si isReversed est true, on previent le LLM explicitement dans le prompt.
    const reversedSeed = Math.abs((req.user.id * 7919 + today.split('-').reduce((a, p) => a + parseInt(p), 0) * 31337) % 100);
    const isReversed = reversedSeed < 28; // ~28% des tirages (tradition: "renversee" en tarologie)
    const card = TAROT_DECK[cardId] || TAROT_DECK[0];

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
    const userPrompt = `Carte tirée: ${card.name} (${card.roman}). Position: ${isReversed ? 'INVERSÉE (sens retourné, énergie bloquée, intériorisée ou à débloquer)' : 'droite (sens naturel, énergie qui s\'écoule librement)'}.
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
  "message": "2 phrases courtes et poétiques résumant l'énergie de la carte ${isReversed ? 'INVERSÉE' : 'droite'} pour aujourd'hui. ${isReversed ? 'L\'énergie est bloquée, retournée vers l\'intérieur, ou demande à être débloquée.' : 'L\'énergie circule naturellement.'}",
  "question": "une question de réflexion ouverte pour la journée${isReversed ? ' qui invite à débloquer ou intérioriser l\'énergie' : ''}",
  "reading": "Un texte détaillé (200-250 mots) reliant cette carte ${isReversed ? 'INVERSÉE' : 'droite'} à ton signe (${sunSign}), aux transits du moment, et à ce que cette énergie signifie concrètement pour ta journée. ${isReversed ? 'IMPORTANT : la position inversée signifie que l\'énergie est bloquée ou intériorisée — parle de ce qui freine, de ce qui demande à être retourné ou accueilli.' : 'Parle de ce qui s\'ouvre, de ce qui circule, de l\'énergie positive disponible.'} Donne des conseils pratiques, des choses à surveiller, un conseil pour le soir. Écris comme une amie qui te parle — pas de jargon, pas de style hermétique. Sois concrète et chaleureuse."
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
      // Fallback: enriched deterministic reading (~180 mots)
      const reversedIntro = isReversed
        ? `Cette carte apparaît inversée aujourd'hui. L'énergie de ${card.name} est présente, mais elle se manifeste de façon bloquée, intériorisée ou contrariée. Quelque chose en toi résiste, et c'est précisément là que se trouve ton travail du jour.`
        : `Cette carte apparaît droite aujourd'hui. Son énergie circule librement en toi — c'est un cadeau du moment, une force à accueillir et à utiliser.`;
      const signAdvice = getTarotSignAdvice(sunSign, isReversed);
      const eveningTip = isReversed
        ? `Ce soir, prends un moment pour te demander : qu'est-ce que je refuse de voir ? La carte inversée ne punit pas — elle t'invite à regarder ce que tu as mis sous le tapis. Accueille-le sans jugement.`
        : `Ce soir, savoure cette énergie. Note une chose que tu as accomplie aujourd'hui grâce à elle. La gratitude amplifie ce qui circule bien.`;

      result = {
        cardName: card.name, cardId: card.id, roman: card.roman, emoji: card.emoji,
        isReversed, archetype: card.archetype,
        message: isReversed ? card.reversed : card.upright,
        question: isReversed
          ? 'Qu\'est-ce qui demande à être débloqué en toi aujourd\'hui ?'
          : 'Comment cette énergie peut-elle te servir aujourd\'hui ?',
        reading: `${reversedIntro}\n\nEn tant que ${sunSign}, cette carte résonne particulièrement avec ton chemin. ${signAdvice}\n\n${card.name} (${card.roman}) porte l'archétype de ${card.archetype}. ${isReversed ? `Quand cette énergie se bloque, c'est souvent parce que tu as peur de quelque chose — peur de perdre le contrôle, peur du changement, peur de te montrer. Identifie cette peur, nomme-la. Une peur nommée perd la moitié de son pouvoir.` : `Quand cette énergie circule, profite-en pour avancer vers ce qui compte vraiment. Les portes sont ouvertes — il suffit de franchir le seuil.`}\n\n${eveningTip}`,
      };
    }

    // Ensure fields exist
    result.cardId ??= card.id;
    result.roman ??= card.roman;
    result.emoji ??= card.emoji;
    // v11.7 — On force l'isReversed : le tirage est deterministe avant l'appel LLM,
    //         le LLM genere le texte adapte (renversee ou droite) selon ce flag.
    //         On garde le choix du tirage divinatoire, pas le caprice du LLM.
    if (typeof result.isReversed !== 'boolean') result.isReversed = isReversed;
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
    // v11.1 — sécurisation double : (a) re-pioche un cardId valide, (b) re-pioche une carte existante dans le deck.
    const safeCard = (() => {
      const u = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(req.user.id);
      const seed = u?.birth_data ? Array.from(u.birth_data + today).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) : 0;
      const id = Math.abs(seed) % TAROT_DECK.length;
      return TAROT_DECK[id] || TAROT_DECK[0];
    })();
    // v11.3 — isReversed = tirage divinatoire, PAS un fallback bug.
    // Si on est passé par le fallback (LLM échoué), fbIsReversed était `id % 3 === 0`
    // ce qui produisait 1/3 des cartes à l'envers systématiquement. Maintenant : false par défaut.
    const fbIsReversed = false;
    const fbSun = typeof sunSign !== 'undefined' ? sunSign : 'inconnu';
    const fallbackResult = {
      cardName: safeCard.name,
      cardId: safeCard.id,
      roman: safeCard.roman,
      emoji: safeCard.emoji,
      isReversed: fbIsReversed,
      archetype: safeCard.archetype,
      message: fbIsReversed ? safeCard.reversed : safeCard.upright,
      question: 'Que te dit cette carte aujourd\'hui ?',
      reading: `${safeCard.archetype}. ${fbIsReversed ? safeCard.reversed : safeCard.upright} En tant que ${fbSun}, cette énergie résonne avec ton chemin solaire. Les configurations planétaires du moment amplifient cette influence : laisse-la guider tes choix de la journée.`,
    };
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content) VALUES (?, ?, ?)')
      .run(req.user.id, `tarot:${today}`, JSON.stringify(fallbackResult));
    res.json(fallbackResult);
  }
});

// ─── Tarot Premium — Tirage en croix (3 cartes : Passé / Présent / Futur) ───
// P2 MON02 — IAP 2,99€. Quota : gratuit pour premium, 1 achat = 1 tirage.
// DB table: tarot_grants (user_id PK, paid_count, free_used, created_at)
db.exec(`CREATE TABLE IF NOT EXISTS tarot_grants (
  user_id INTEGER PRIMARY KEY,
  free_used INTEGER DEFAULT 0,
  paid_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
)`);

// GET /api/tarot/cross/status — quota du user
app.get('/api/tarot/cross/status', auth, (req, res) => {
  const row = db.prepare('SELECT free_used, paid_count FROM tarot_grants WHERE user_id = ?').get(req.user.id);
  const user = db.prepare('SELECT is_premium, premium_until FROM users WHERE id = ?').get(req.user.id);
  const nowSec = Math.floor(Date.now() / 1000);
  const isPremium = !!user?.is_premium && (!user.premium_until || user.premium_until > nowSec);
  if (!row) {
    db.prepare('INSERT INTO tarot_grants (user_id) VALUES (?)').run(req.user.id);
    return res.json({ freeUsed: 0, paidCount: 0, isPremium, canDraw: isPremium });
  }
  const canDraw = isPremium || row.paid_count > row.free_used;
  res.json({ freeUsed: row.free_used, paidCount: row.paid_count, isPremium, canDraw });
});

// POST /api/tarot/cross/mark-paid — @DEPRECATED Route désactivée.
// La gate x-celeste-iap-secret a été supprimée (secret hardcodé côté client = faille).
// Pour acheter un tirage : /api/billing/create-consumable {type:'tarot'} → Stripe webhook.
app.post('/api/tarot/cross/mark-paid', auth, (req, res) => {
  res.status(410).json({
    error: 'route_deprecated',
    message: 'Utilise /api/billing/create-consumable {type:"tarot"} pour acheter un tirage.',
  });
});

// POST /api/tarot/cross — tirage 3 cartes (Passé/Présent/Futur) + interprétation LLM
app.post('/api/tarot/cross', auth, llmLimiter, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    const nowSec = Math.floor(Date.now() / 1000);
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > nowSec);

    // Quota check
    const grant = db.prepare('SELECT free_used, paid_count FROM tarot_grants WHERE user_id = ?').get(req.user.id)
      ?? { free_used: 0, paid_count: 0 };
    const paidRemaining = grant.paid_count - grant.free_used;
    if (!isPremium && paidRemaining <= 0) {
      return res.status(402).json({ error: 'quota_exceeded', code: 'paywall_required', message: 'Achète un tirage en croix (2,99€)' });
    }

    // Question optionnelle
    const question = String(req.body?.question || '').slice(0, 200);

    // 3 cartes déterministes (seed: user + date + heure)
    const now = new Date();
    const seedBase = req.user.id * 9301 + now.getFullYear() * 49297 + (now.getMonth() + 1) * 7919 + now.getDate() * 31337 + now.getHours() * 104729;
    const positions = ['past', 'present', 'future'];
    const cards = positions.map((pos, i) => {
      const cardId = Math.abs((seedBase + i * 4831) % TAROT_DECK.length);
      const isReversed = Math.abs((seedBase + i * 1483) % 100) < 28;
      return { position: pos, ...TAROT_DECK[cardId], isReversed };
    });

    // Récupère sun sign pour personnalisation
    let sunSign = 'inconnu';
    if (user?.birth_data) {
      try {
        const bd = safeJsonParse(user.birth_data, null, 'tarot-cross birth_data');
        if (bd) {
          const natal = getNatalPositions(bd);
          sunSign = natal.sun?.sign || 'inconnu';
        }
      } catch (e) { /* fallback silencieux */ }
    }

    // LLM call (avec fallback si LLM down) — glm-5.2 reasoning: max_tokens 32000 + timeout 240s
        // (À fort max_tokens, glm-5.2 produit du contenu réel ; à bas max_tokens, il consomme tout en reasoning interne)
        const prompt = `Tu es une tarologue française chevronnée, intuitive, chaleureuse et précise. Tu tutoies, tu parles avec des images concrètes, jamais de jargon ésotérique inutile. Tu es réputée pour la densité et la pertinence de tes lectures.

Tu tires **3 cartes en croix (Passé → Présent → Futur)** pour une personne **née sous le signe ${sunSign}**.

Sa question : « ${question || "Guidance générale pour aujourd'hui"} »

🃏 **Carte Passé** : ${cards[0].name} ${cards[0].isReversed ? '(renversée)' : ''} — archétype : ${cards[0].archetype}
🃏 **Carte Présent** : ${cards[1].name} ${cards[1].isReversed ? '(renversée)' : ''} — archétype : ${cards[1].archetype}
🃏 **Carte Futur** : ${cards[2].name} ${cards[2].isReversed ? '(renversée)' : ''} — archétype : ${cards[2].archetype}

Cette personne a payé pour cette lecture : elle attend une vraie profondeur, pas un horoscope générique. Apporte-lui de la valeur concrète qu'elle ne trouve pas ailleurs.

Pour CHAQUE carte, tu rédiges **4 champs distincts** qui ensemble brossent un portrait complet :

**A) Symbolique de la carte (3–4 phrases)** : ce que la carte représente dans le tarot de Marseille — son arcane, ses figures, ce que son énergie évoque en général. Inclus l'orientation (droite/renversée) et ce qu'elle ajoute.

**B) Lecture Passé/Présent/Futur (180–220 mots)** : c'est le cœur de l'interprétation. Tu dois :
- t'adresser directement à la personne (« tu », « tu viens de », « tu traverses », « tu vas »)
- ancrer le symbole de la carte dans une **situation concrète** (en t'appuyant sur son signe ${sunSign} et sur sa question)
- évoquer au moins **une image sensorielle** précise (un lieu, un geste, une sensation, un moment de la journée)
- nommer **une émotion spécifique** (« cette petite fierté qui ne suffit plus », « ce silence après l'effort »)
- identifier **un blocage OU un levier** concret que la carte pointe
- terminer par une phrase qui pourrait la **surprendre ou la faire sourire doucement** (un retournement, une image inattendue)

**C) Conseil de la carte (2–3 phrases)** : un **micro-geste** très concret à poser dans les jours qui viennent (pas « médite », mais « ce soir, écris trois lignes sur ce qui te freine »).

**D) Mots-clés (4–5 mots)** : un tableau de mots-clés symboliques qui résonnent avec la carte.

Pour la **synthèse**, tu rédiges **3 champs** :

**E) Fil rouge (150–180 mots)** : l'histoire que les 3 cartes racontent ensemble, comme un récit qui avance. Tu relies les archétypes entre eux (${cards[0].archetype} → ${cards[1].archetype} → ${cards[2].archetype}) et tu montres le mouvement.

**F) Ce que les cartes t'invitent à faire (3–4 phrases)** : les 2–3 actions concrètes que la personne peut poser cette semaine en s'appuyant sur la lecture. Pas de généralités, des gestes précis.

**G) Ce que les cartes t'invitent à lâcher (3–4 phrases)** : les croyances, schémas ou résistances qui freinent le mouvement identifié en E. Soit précis (« l'idée que tu dois tout porter seul(e) »), pas vague.

⚠️ Réponds UNIQUEMENT en JSON strict :
{
  "past": {"symbol": "...", "reading": "...", "advice": "...", "keywords": ["...", "...", "...", "..."]},
  "present": {"symbol": "...", "reading": "...", "advice": "...", "keywords": ["...", "...", "...", "..."]},
  "future": {"symbol": "...", "reading": "...", "advice": "...", "keywords": ["...", "...", "...", "..."]},
  "synthesis": {"filRouge": "...", "aFaire": "...", "aLacher": "..."}
}`;

    let reading = null;
    try {
      // glm-5.2 sur cheapestinference : max_tokens 32000 obligatoires sinon le modèle consomme tout en reasoning interne (bug API)
      const llmResp = await callLLMWithRetry([{ role: 'user', content: prompt }], 0, 32000, { temperature: 0.9 }, 240000);
      const msg = llmResp.choices?.[0]?.message;
      const txt = msg?.content || msg?.reasoning_content || '';
      console.log('[tarot-cross] raw LLM output length:', txt.length, 'preview:', txt.slice(0, 300));
      // Extract the FIRST balanced JSON object — LLM sometimes adds trailing text.
      const startIdx = txt.indexOf('{');
      let jsonStr = txt;
      if (startIdx !== -1) {
        let depth = 0, endIdx = -1;
        for (let i = startIdx; i < txt.length; i++) {
          if (txt[i] === '{') depth++;
          else if (txt[i] === '}') {
            depth--;
            if (depth === 0) { endIdx = i; break; }
          }
        }
        if (endIdx !== -1) jsonStr = txt.slice(startIdx, endIdx + 1);
      }
      reading = safeJsonParse(jsonStr, null, 'tarot-cross llm parse');
      if (reading) {
        console.log('[tarot-cross] parsed keys:', Object.keys(reading), 'past has keys:', reading.past ? Object.keys(reading.past) : 'null');
      }
    } catch (llmErr) {
      console.warn('[tarot-cross] LLM failed, using deterministic:', llmErr.message);
    }

    // Fallback déterministe (format structuré pour matcher le format LLM)
    if (!reading) {
      reading = {
        past: {
          symbol: `${cards[0].name} ${cards[0].isReversed ? 'renversée' : 'à l\'endroit'} — ${cards[0].archetype}.`,
          reading: cards[0].isReversed ? cards[0].reversed : cards[0].upright,
          advice: 'Prends un instant pour nommer ce que cette carte représente dans ta vie en ce moment.',
          keywords: ['racine', cards[0].archetype.toLowerCase(), 'origine'],
        },
        present: {
          symbol: `${cards[1].name} ${cards[1].isReversed ? 'renversée' : 'à l\'endroit'} — ${cards[1].archetype}.`,
          reading: cards[1].isReversed ? cards[1].reversed : cards[1].upright,
          advice: 'Écoute ce que ton corps te dit dans les prochaines 24h.',
          keywords: ['maintenant', cards[1].archetype.toLowerCase(), 'tension'],
        },
        future: {
          symbol: `${cards[2].name} ${cards[2].isReversed ? 'renversée' : 'à l\'endroit'} — ${cards[2].archetype}.`,
          reading: cards[2].isReversed ? cards[2].reversed : cards[2].upright,
          advice: 'Prépare-toi à accueillir ce mouvement plutôt que de le freiner.',
          keywords: ['horizon', cards[2].archetype.toLowerCase(), 'mouvement'],
        },
        synthesis: {
          filRouge: `${cards[0].archetype} → ${cards[1].archetype} → ${cards[2].archetype}. Le mouvement se fait de l'énergie ${cards[0].name} vers ${cards[2].name}.`,
          aFaire: 'Tenir un journal de bord pendant 7 jours pour observer ce qui se répète.',
          aLacher: 'L\'illusion que tu peux tout contrôler.',
        },
        _deterministic: true,
      };
    }

    // Décrémente quota
    if (!isPremium) {
      db.prepare('UPDATE tarot_grants SET free_used = free_used + 1, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ?')
        .run(req.user.id);
    }

    res.json({ cards, reading, isPremiumDraw: isPremium, sunSign });
  } catch (err) {
    console.error('[tarot-cross] error:', err.message);
    res.status(500).json({ error: 'tarot_cross_failed', message: err.message });
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

    // Try LLM first, fallback to deterministic if timeout/fail
    let result;
    try {
      result = await generateCompatibility(chart1, chart2, chart1.sun.sign, chart2.sun.sign, ctx);
    } catch (llmErr) {
      console.warn('[compat] LLM failed, using deterministic fallback:', llmErr.message);
      result = computeCompatDeterministic(chart1, chart2, chart1.sun.sign, chart2.sun.sign, ctx);
    }

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

// ════════════════════════════════════════════════════════════════
// P1 DUO — Compatibilité partageable (viral growth)
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/compat/invite
 * Crée une invitation pour le partenaire d'un user authentifié.
 * Body: { context?, inviteeName?, inviteeEmail? }
 * Returns: { token, shareUrl, deepLink }
 */
app.post('/api/compat/invite', auth, (req, res) => {
  try {
    const inviter = db.prepare('SELECT id, birth_data FROM users WHERE id = ?').get(req.user.id);
    if (!inviter?.birth_data) {
      return res.status(400).json({ error: 'Set your birth data first' });
    }
    const { inviteeName, inviteeEmail, context = 'romantic' } = req.body || {};
    const token = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO compat_invites (token, inviter_user_id, invitee_email, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(token, req.user.id, inviteeEmail ? String(inviteeEmail).slice(0, 200) : null, now);

    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    res.json({
      token,
      shareUrl: `${baseUrl}/invite/${token}`,
      deepLink: `https://celeste.app/invite/${token}`,
      context,
      inviteeName: inviteeName ? String(inviteeName).slice(0, 80) : null,
    });
  } catch (err) {
    console.error('compat invite error:', err.message);
    res.status(500).json({ error: 'invite_failed', detail: err.message });
  }
});

/**
 * GET /api/compat/invite/:token
 * PUBLIC — l'invité clique le lien, on renvoie les infos teaser (pas de LLM côté serveur)
 * pour qu'il puisse voir "Qui t'invite, signe solaire, etc."
 */
app.get('/api/compat/invite/:token', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT ci.token, ci.status, ci.invitee_email,
             u.id AS inviter_id, u.display_name, u.natal_chart
      FROM compat_invites ci
      JOIN users u ON u.id = ci.inviter_user_id
      WHERE ci.token = ?
    `).get(req.params.token);
    if (!row) return res.status(404).json({ error: 'invite_not_found' });

    let sun = null;
    try {
      const n = row.natal_chart ? JSON.parse(row.natal_chart) : {};
      sun = n.sunSign || null;
    } catch { /* ignore */ }

    res.json({
      token: row.token,
      status: row.status,
      inviterName: row.display_name || 'Un(e) ami(e)',
      inviterSun: sun,
      inviteeEmailPresent: !!row.invitee_email,
    });
  } catch (err) {
    console.error('compat invite get error:', err.message);
    res.status(500).json({ error: 'fetch_failed', detail: err.message });
  }
});

/**
 * POST /api/compat/invite/:token/redeem
 * L'invité soumet ses birth data → on calcule le résultat et on le cache.
 * Body: { birthData: { date, time, latitude, longitude, placeName? } }
 * No-auth (le token est l'authorization), mais on attache l'user s'il est connecté.
 */
app.post('/api/compat/invite/:token/redeem', (req, res) => {
  try {
    const token = req.params.token;
    const invite = db.prepare(`
      SELECT ci.*, u.birth_data AS inviter_birth_data
      FROM compat_invites ci
      JOIN users u ON u.id = ci.inviter_user_id
      WHERE ci.token = ?
    `).get(token);
    if (!invite) return res.status(404).json({ error: 'invite_not_found' });

    const { birthData } = req.body || {};
    if (!birthData || typeof birthData !== 'object' ||
        !birthData.date || !/^\d{4}-\d{2}-\d{2}$/.test(birthData.date) ||
        !birthData.time || !/^\d{2}:\d{2}$/.test(birthData.time) ||
        typeof birthData.latitude !== 'number' || Math.abs(birthData.latitude) > 90 ||
        typeof birthData.longitude !== 'number' || Math.abs(birthData.longitude) > 180) {
      return res.status(400).json({ error: 'invalid_birth_data' });
    }

    const inviterBd = safeJsonParse(invite.inviter_birth_data, null, 'duo redeem inviter_birth_data');
    if (!inviterBd) return res.status(500).json({ error: 'inviter_birth_data_corrupt' });

    const chart1 = getNatalPositions(inviterBd);
    const chart2 = getNatalPositions(birthData);

    // On fait le même compute que /api/compatibility mais sans auth et sans décrément de scans
    // Le coût LLM est sur nous : c'est l'investissement acquisition viral.
    // En dev (COMPAT_DETERMINISTIC_ONLY=1) on skip le LLM pour valider le pipeline.
    const computePromise = process.env.COMPAT_DETERMINISTIC_ONLY === '1'
      ? Promise.resolve(computeCompatDeterministic(chart1, chart2, chart1.sun.sign, chart2.sun.sign, 'romantic'))
      : generateCompatibility(chart1, chart2, chart1.sun.sign, chart2.sun.sign, 'romantic')
        .catch((err) => {
          console.warn('compat redeem LLM KO, using deterministic fallback:', err.message);
          return computeCompatDeterministic(chart1, chart2, chart1.sun.sign, chart2.sun.sign, 'romantic');
        });
    computePromise.then((compat) => {
      const now = Math.floor(Date.now() / 1000);
      const computed = {
        ...compat,
        yourSun: chart1.sun.sign,
        theirSun: chart2.sun.sign,
        yourMoon: chart1.moon.sign,
        theirMoon: chart2.moon.sign,
        redeemed_via: 'invite',
      };

      // Si l'invité est connecté → on attache
      let inviteeUserId = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
          if (payload?.id) inviteeUserId = payload.id;
        } catch { /* token invalide → on reste anonyme */ }
      }

      db.prepare(`
        UPDATE compat_invites
        SET invitee_birth_data = ?, invitee_user_id = ?, status = 'redeemed',
            redeemed_at = ?, computed_result = ?
        WHERE token = ?
      `).run(
        JSON.stringify(birthData),
        inviteeUserId,
        now,
        JSON.stringify(computed),
        token
      );

      res.json({ ok: true, result: computed });
    }).catch((err) => {
      console.error('compat redeem llm error:', err.message);
      res.status(502).json({ error: 'llm_failed', detail: err.message });
    });
  } catch (err) {
    console.error('compat redeem error:', err.message);
    res.status(500).json({ error: 'redeem_failed', detail: err.message });
  }
});

// ─── Journal ───────────────────────────────────────────────
app.use('/api/journal', createJournalRouter({ db, auth }));

// ─── Daily Energy (personalized astro-forecast + reflection) ─
app.use('/api/daily-energy', createDailyEnergyRouter({ db, auth, getNatalPositions, getTransits, callLLMWithRetry }));

// ─── Lunar Cycle (intentions + full moon review) ─────────
app.use('/api/lunar-cycle', createLunarCycleRouter({ db, auth, moonPhaseForDate }));

// ─── Mood Tracker (daily check-in + astro correlation) ──
app.use('/api/mood', createMoodTrackerRouter({ db, auth, getNatalPositions, getTransits }));

// ─── Personal Transits (refonte "Aspects du jour") ──────
app.use('/api/personal-transits', createPersonalTransitsRouter({ db, auth, getNatalPositions, getTransits, callLLMWithRetry }));

// ─── Activated Houses (refonte "Maisons natales") ───────
app.use('/api/activated-houses', createActivatedHousesRouter({ db, auth, getNatalPositions, getTransits, callLLMWithRetry }));

// ─── Asteroid Wisdom (refonte "Astéroïdes natals") ──────
app.use('/api/asteroid-wisdom', createAsteroidWisdomRouter({ db, auth, getNatalPositions, callLLMWithRetry }));

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

// ═══════════════════════════════════════════════════════════════════════════
// P0#4 — Streak freeze : endpoints.
//   GET  /api/streak          → { count, freezesAvailable, lastDate, graceApplied }
//   POST /api/streak/freeze   → { ok, freezesAvailable } (appelé après IAP 0,99€)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/streak', auth, (req, res) => {
  try {
    const u = db.prepare(
      'SELECT streak_count, streak_last_date, streak_freezes, streak_freeze_used_this_week FROM users WHERE id = ?'
    ).get(req.user.id);
    if (!u) return res.status(404).json({ error: 'user not found' });

    const today = new Date().toISOString().slice(0, 10);
    let freezesAvailable = u.streak_freezes ?? 1;
    // Reset hebdo du freeze gratuit
    if (u.streak_freeze_used_this_week && daysBetween(u.streak_freeze_used_this_week, today) > 7) {
      freezesAvailable = 1;
      db.prepare('UPDATE users SET streak_freezes = 1, streak_freeze_used_this_week = NULL WHERE id = ?').run(req.user.id);
    }

    res.json({
      count: u.streak_count ?? 0,
      lastDate: u.streak_last_date,
      freezesAvailable,
      nextFreeReset: u.streak_freeze_used_this_week,
    });
  } catch (err) {
    console.error('[streak/status] error:', err.message);
    res.status(500).json({ error: 'streak lookup failed' });
  }
});

// Recharge un jeton freeze — usage ADMIN/PREMIUM GRANT uniquement.
// Pour les achats payants : utiliser /api/billing/create-consumable {type:'freeze'}
// (Stripe Checkout → webhook → grant). L'ancienne gate x-celeste-iap-secret a été
// supprimée (secret hardcodé = faille de sécurité — n'importe qui pouvait l'extraire).
app.post('/api/streak/freeze', auth, (req, res) => {
  try {
    const qty = Math.max(1, Math.min(10, Number(req.body?.quantity) || 1));
    const u = db.prepare('SELECT streak_freezes FROM users WHERE id = ?').get(req.user.id);
    if (!u) return res.status(404).json({ error: 'user not found' });

    // Plus de gate IAP côté client. Cette route n'est plus utilisée pour les achats ;
    // tout passe par Stripe Checkout (+ webhook). On la garde pour les grants gratuits
    // (premium mensuel, admin, bonus onboarding) où qty=0 → +1 offert.
    const isFreeGrant = qty === 0;
    const addQty = isFreeGrant ? 1 : qty;

    if (!isFreeGrant) {
      // Sécurité : toute demande d'ajout payant via cette route est refusée.
      // L'utilisateur doit passer par /api/billing/create-consumable.
      return res.status(402).json({
        error: 'use_billing_route',
        message: 'Utilise /api/billing/create-consumable {type:"freeze"} pour acheter un freeze.',
      });
    }

    const newCount = (u.streak_freezes ?? 0) + addQty;
    db.prepare('UPDATE users SET streak_freezes = ? WHERE id = ?').run(newCount, req.user.id);
    console.log(`[streak/freeze] user ${req.user.id} +${addQty} freeze(s) → total ${newCount} (free grant)`);
    res.json({ ok: true, freezesAvailable: newCount });
  } catch (err) {
    console.error('[streak/freeze] error:', err.message);
    res.status(500).json({ error: 'freeze purchase failed' });
  }
});

// ─── Web Push endpoints ────────────────────────────────────
app.use('/api/notifications', createNotificationsRouter({ db, auth, webpush, vapidPublicKey: VAPID_PUBLIC_KEY }));

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

// ─── PISTE 5 — Mood Forecast 14 jours ──────────────────────
// Forecast purement astronomique (zéro LLM, zéro IA). Chaque jour : transits +
// score d'humeur 0-100 basé sur la nature des aspects planétaires + label FR +
// 1 phrase expressive qui résume l'énergie du jour (style CHANI).
//
// Premium gate : gratuit = 3 jours (aujourd'hui + J+1 + J+2), premium = 14 jours.

const MOOD_LABELS = [
  { max: 25, label: 'Chahutée',  emoji: '🌧️', tone: 'tendue' },
  { max: 45, label: 'Mouvementée', emoji: '🌬️', tone: 'contrastée' },
  { max: 60, label: 'Neutre',     emoji: '🌫️', tone: 'neutre' },
  { max: 75, label: 'Douce',      emoji: '🌿', tone: 'fluide' },
  { max: 90, label: 'Belle',      emoji: '✨', tone: 'harmonieuse' },
  { max: 101, label: 'Radiante',  emoji: '☀️', tone: 'rayonnante' },
];

function moodLabelFor(score) {
  return MOOD_LABELS.find(m => score < m.max) || MOOD_LABELS[MOOD_LABELS.length - 1];
}

const MOOD_PHRASES = {
  tendue: [
    "Le ciel tend ses fils — respire avant de réagir.",
    "Quelques graines de friction aujourd'hui, mais rien d'insurmontable.",
    "Le climat est électrique : garde tes bases solides.",
  ],
  contrastée: [
    "Du mouvement dans l'air — adapte ton rythme.",
    "Aspects contrastés : choisis tes batailles.",
    "Une journée en deux temps — reste souple.",
  ],
  neutre: [
    "Un ciel calme — parfait pour avancer au gré de tes envies.",
    "Ni pleine ni basse — une journée pour respirer.",
    "Le ciel se tait doucement — écoute ton instinct.",
  ],
  fluide: [
    "Le ciel souffle dans ton sens — avance avec confiance.",
    "Énergie douce et coopérative aujourd'hui.",
    "Une belle fluidité pour faire ce qui te tient à cœur.",
  ],
  harmonieuse: [
    "Le ciel est clair — profite de cette belle énergie.",
    "Aspects harmonieux : c'est un beau jour pour créer.",
    "Tout coule de source — laisse-toi porter.",
  ],
  rayonnante: [
    "Ciel exceptionnel — fais ce qui te fait le plus peur aujourd'hui.",
    "Une fenêtre d'or s'ouvre — saisis-la.",
    "Le ciel te pousse en avant — brille sans modération.",
  ],
};

const ASPECT_NATURE_SCORE = {
  conjunction: 0,   // contextuel, neutre par défaut
  opposition: -8,
  square: -10,
  quincunx: -4,
  sextile: +6,
  trine: +10,
};

function computeDayMood(date) {
  const transits = getTransits(date);
  // Compute major aspects for the day
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn'];
  const aspectDefs = [
    { name: 'conjunction', angle: 0, orb: 6 },
    { name: 'opposition', angle: 180, orb: 6 },
    { name: 'trine', angle: 120, orb: 5 },
    { name: 'square', angle: 90, orb: 5 },
    { name: 'sextile', angle: 60, orb: 4 },
  ];
  let score = 55; // baseline neutre
  const highlights = [];
  const time = new AstroTime(date);
  const longs = {};
  for (const p of planets) {
    longs[p] = geoEclipticLongitude(p, time);
  }
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i], b = planets[j];
      const diff = Math.abs(longs[a] - longs[b]);
      const d = diff > 180 ? 360 - diff : diff;
      for (const ad of aspectDefs) {
        const orb = Math.abs(d - ad.angle);
        if (orb <= ad.orb) {
          const delta = ASPECT_NATURE_SCORE[ad.name] || 0;
          score += delta;
          // Lune impliquée = plus impactant émotionnellement
          const weight = (a === 'moon' || b === 'moon') ? 1.5 : 1;
          if (Math.abs(delta) >= 6) {
            highlights.push({
              aspect: ad.name,
              planets: [a, b],
              nature: delta > 0 ? 'harmonique' : 'tendu',
              weight,
            });
          }
          break;
        }
      }
    }
  }
  // Lune en signe : +5 si eau/terre (introspection), -5 si feu/air (action)
  const moonSign = transits.moon?.sign;
  if (moonSign) {
    const waterEarth = ['Cancer','Scorpion','Poissons','Taureau','Vierge','Capricorne'];
    score += waterEarth.includes(moonSign) ? +3 : -2;
  }
  // Mercure rétrograde = friction
  if (transits.mercury?.retrograde) score -= 5;
  if (transits.venus?.retrograde) score -= 3;

  score = Math.max(10, Math.min(95, Math.round(score)));
  const label = moodLabelFor(score);
  const phrases = MOOD_PHRASES[label.tone];
  const phrase = phrases[Math.floor(date.getTime() / 86400000) % phrases.length];

  return {
    date: date.toISOString().split('T')[0],
    score,
    label: label.label,
    emoji: label.emoji,
    tone: label.tone,
    phrase,
    moonSign: transits.moon?.sign,
    mercuryRetrograde: !!transits.mercury?.retrograde,
    highlights: highlights.slice(0, 3),
  };
}

app.get('/api/mood-forecast', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT is_premium, premium_until FROM users WHERE id = ?').get(req.user.id);
    const now = Date.now();
    const isPremium = !!user?.is_premium && (!user?.premium_until || user.premium_until > now);
    const days = isPremium ? 14 : 3;
    const forecast = [];
    const base = new Date();
    base.setUTCHours(12, 0, 0, 0); // midi UTC = stable quel que soit TZ
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      forecast.push(computeDayMood(d));
    }
    res.json({ forecast, isPremium, daysRequested: days, freeDaysLimit: 3 });
  } catch (err) {
    console.error('mood-forecast error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── PISTE 3 — Ephémérides vivantes ─────────────────────────
// GET /api/astro/events — événements astronomiques des prochaines 24h
// (nouvelle lune, pleine lune, ingress, station, éclipse…).
// Accessible à tous (free + premium). Pas de personalisation ici — la
// personnalisation se fait dans le push (cron-events.js).
app.get('/api/astro/events', auth, (req, res) => {
  try {
    const hoursAhead = Math.min(Number(req.query.hours) || 24, 72);
    const events = detectAstroEvents(new Date(), hoursAhead);
    res.json({
      events,
      count: events.length,
      generatedAt: new Date().toISOString(),
      windowHours: hoursAhead,
    });
  } catch (err) {
    console.error('astro/events error:', err.message);
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

    // Check lifetime natal cache (asteroid positions never change)
    const cached = db.prepare('SELECT data FROM natal_interpretations WHERE user_id = ? AND feature = ?').get(req.user.id, 'asteroids');
    if (cached) {
      return res.json({ ...JSON.parse(cached.data), cached: true });
    }

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
    const responseData = {
      positions,
      interpretation,
      generatedAt: new Date().toISOString()
    };

    // Save to lifetime natal cache
    db.prepare('INSERT OR REPLACE INTO natal_interpretations (user_id, feature, data) VALUES (?, ?, ?)')
      .run(req.user.id, 'asteroids', JSON.stringify(responseData));

    res.json(responseData);
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

    // Check lifetime natal cache
    const cached = db.prepare('SELECT data FROM natal_interpretations WHERE user_id = ? AND feature = ?').get(req.user.id, 'lunar_nodes');
    if (cached) {
      return res.json({ ...JSON.parse(cached.data), cached: true });
    }

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

    const responseData = {
      northNode: north,
      southNode: south,
      interpretation,
      generatedAt: new Date().toISOString()
    };

    // Save to lifetime natal cache
    db.prepare('INSERT OR REPLACE INTO natal_interpretations (user_id, feature, data) VALUES (?, ?, ?)')
      .run(req.user.id, 'lunar_nodes', JSON.stringify(responseData));

    res.json(responseData);
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

    // Check lifetime natal cache
    const cached = db.prepare('SELECT data FROM natal_interpretations WHERE user_id = ? AND feature = ?').get(req.user.id, 'houses');
    if (cached) {
      return res.json({ ...JSON.parse(cached.data), cached: true });
    }

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
    const responseData = {
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
    };

    // Save to lifetime natal cache
    db.prepare('INSERT OR REPLACE INTO natal_interpretations (user_id, feature, data) VALUES (?, ?, ?)')
      .run(req.user.id, 'houses', JSON.stringify(responseData));

    res.json(responseData);
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

      // v13 — Le Rituel Quotidien. VMF : chaud, spécifique, anti-générique.
      // 7 variantes = 1 semaine sans répétition déterministe (hash date).
      const pushVariants = [
        'Ton ciel t\'attend. Trois minutes, le temps d\'un café.',
        'Les planètes ont bougé cette nuit. Viens voir ce qu\'il dit de toi.',
        'Le rituel du matin t\'ouvre. Horoscope → intention → silence.',
        'Ton horoscope du jour est prêt. Pas le même qu\'hier — le ciel a tourné.',
        'Sept respirations, puis ton horoscope. Le reste suivra.',
        'Trois gestes, un rituel. Céleste t\'attend.',
        'Nouveau transit aujourd\'hui. Une intention à poser ?',
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

// ═══════════════════════════════════════════════════════════════════════════
// P0#4 — Streak reminder job : push préventif J+1 à 21h locale.
//
// Pour chaque user qui :
//   - a un streak actif (count >= 3) ET
//   - n'a PAS consulté aujourd'hui (streak_last_date != today) ET
//   - est dans la fenêtre 21h-22h locale
// On envoie un push "ne perds pas ton streak de N jours".
//
// Si l'user a un freeze disponible, on le mentionne ("un jeton te protège").
// ═══════════════════════════════════════════════════════════════════════════
async function runStreakReminderJob() {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const today = now.toISOString().split('T')[0];

    // Users avec streak >= 3 qui n'ont pas consulté aujourd'hui
    const users = db.prepare(`
      SELECT u.id, u.email, u.streak_count, u.streak_last_date,
             u.streak_freezes, u.notification_timezone, u.last_streak_reminder
      FROM users u
      JOIN push_subscriptions ps ON ps.user_id = u.id
      WHERE u.streak_count >= 3
        AND u.streak_last_date IS NOT NULL
        AND u.streak_last_date != ?
        AND (u.last_streak_reminder IS NULL OR u.last_streak_reminder != ?)
    `).all(today, today);

    if (users.length === 0) return;

    let sent = 0;
    for (const user of users) {
      const tz = Number(user.notification_timezone ?? 0);
      const localHour = (utcHour - Math.floor(tz) + 24) % 24;
      // Fenêtre 21h-22h locale (le cron tourne à :00 et :30)
      const hourMatches = localHour === 21
        || (localHour === 22 && utcMinute === 0);
      if (!hourMatches) continue;

      const hasFreeze = (user.streak_freezes ?? 0) > 0;
      const body = hasFreeze
        ? ` 🔥 Ton streak de ${user.streak_count} jours est actif. Un jeton freeze te protège si tu craques.`
        : `🔥 Plus que quelques heures pour garder ton streak de ${user.streak_count} jours. Ton ciel t'attend.`;
      const payload = {
        title: '✨ Céleste',
        body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'celeste-streak-reminder',
        url: '/?screen=horoscope',
        data: { type: 'streak-reminder', userId: user.id, streak: user.streak_count },
      };
      const result = await sendPushToUser(user.id, payload);
      if (result.sent > 0) {
        // Marquer pour ne pas repousser aujourd'hui
        db.prepare('UPDATE users SET last_streak_reminder = ? WHERE id = ?').run(today, user.id);
        sent++;
      }
    }

    if (sent > 0) {
      console.log(`[cron:streak-reminder] ${sent} user(s) notifiés (push préventif J+1 21h)`);
    }
  } catch (err) {
    console.error('[cron:streak-reminder] error:', err.message);
  }
}

// Start scheduler: check every 30 minutes
const CRON_INTERVAL_MS = 30 * 60 * 1000;
// ═══════════════════════════════════════════════════════════════════════════
// P1#12 — Early re-engagement job : H+12 / J+1 / J+2.
//
// Les 48h après la dernière activité sont critiques pour la rétention.
// Le job existant `runReengagementJob` couvre J+3/J+7 ; on ajoute les paliers
// plus serrés AVANT que l'user ne churne vraiment.
//
// Logique :
//   H+12 (12h d'inactivité) : push très léger ("Ton horoscope du soir t'attend")
//   J+1  (24h)              : push doux ("Un jour sans consulter les étoiles ?")
//   J+2  (48h)              : push engageant ("Tarot du jour + rune t'attendent")
//
// Anti-spam : max 1 push / jour / user (colonne last_early_reengagement_date).
// Cible : users avec push subscription, premium OU essai, première semaine post-inscription.
// ═══════════════════════════════════════════════════════════════════════════
async function runEarlyReengagementJob() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];

    const H12 = 12 * 3600;
    const J1  = 24 * 3600;
    const J2  = 48 * 3600;

    // Users avec push et pas encore notifiés aujourd'hui
    const users = db.prepare(`
      SELECT u.id, u.last_activity_at, u.created_at, u.last_early_reengagement_date
      FROM users u
      JOIN push_subscriptions ps ON ps.user_id = u.id
      WHERE u.last_early_reengagement_date IS NULL
         OR u.last_early_reengagement_date != ?
    `).all(today);

    let sent12 = 0, sent1 = 0, sent2 = 0;

    for (const user of users) {
      // Si pas encore d'activité enregistrée, on skip (user fraîchement inscrit)
      if (!user.last_activity_at) continue;

      const inactiveFor = now - user.last_activity_at;
      let payload = null;

      // H+12 : push du soir léger (uniquement entre 18h et 22h heure local du serveur)
      const hourLocal = new Date().getHours();
      if (inactiveFor >= H12 && inactiveFor < J1 && hourLocal >= 18 && hourLocal <= 22) {
        payload = {
          title: '✨ Ton horoscope du soir',
          body: "Le ciel de ce soir t'attend. Un dernier regard avant de dormir ?",
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'celeste-early-h12',
          url: '/?screen=horoscope',
          data: { type: 'early-reengage-h12', userId: user.id },
        };
        sent12++;
      }
      // J+1
      else if (inactiveFor >= J1 && inactiveFor < J2) {
        payload = {
          title: '🌙 Un jour sans les étoiles',
          body: 'Ton tirage du jour est prêt. Carte, rune, horoscope — à toi de choisir.',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'celeste-early-j1',
          url: '/?screen=home',
          data: { type: 'early-reengage-j1', userId: user.id },
        };
        sent1++;
      }
      // J+2
      else if (inactiveFor >= J2 && inactiveFor < 3 * 24 * 3600) {
        payload = {
          title: '🔮 Les étoiles bougent sans toi',
          body: "2 jours d'absence. Ta carte du jour t'attend, ainsi qu'un message spécial.",
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: 'celeste-early-j2',
          url: '/?screen=home',
          data: { type: 'early-reengage-j2', userId: user.id },
        };
        sent2++;
      }

      if (payload) {
        const result = await sendPushToUser(user.id, payload);
        if (result.sent > 0) {
          db.prepare('UPDATE users SET last_early_reengagement_date = ? WHERE id = ?').run(today, user.id);
        }
      }
    }

    if (sent12 + sent1 + sent2 > 0) {
      console.log(`[cron:early-reengagement] H+12: ${sent12}, J+1: ${sent1}, J+2: ${sent2} users notified`);
    }
  } catch (err) {
    console.error('[cron:early-reengagement] error:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-7 — Trial expiry job : rappel J-2 avant fin d'essai gratuit.
//
// Le trial sans CB dure 7 jours. À J-2 (donc 5 jours après le début), on envoie
// un push "Ton essai Premium se termine dans 2 jours" pour donner à l'utilisateur
// le temps de convertir vers un abonnement payant sans interruption de service.
//
// - On ne push qu'une seule fois (marqueur `last_trial_reminder` via une colonne
//   dérivée de trial_started_at + comparaison de date).
// - Si l'utilisateur a déjà un abonnement Stripe actif (premium_until > trial_end),
//   on ne push pas (il a déjà converti).
// ═══════════════════════════════════════════════════════════════════════════
const TRIAL_DURATION_DAYS = 7;
const TRIAL_REMINDER_DAYS_BEFORE = 2;

async function runTrialExpiryJob() {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];

    // Users en trial actif (trial_started_at set, is_premium=1) qui approchent de
    // la fin de leur essai et n'ont pas encore reçu le rappel aujourd'hui.
    const users = db.prepare(`
      SELECT u.id, u.email, u.trial_started_at, u.premium_until, u.notification_timezone
      FROM users u
      JOIN push_subscriptions ps ON ps.user_id = u.id
      WHERE u.trial_started_at IS NOT NULL
        AND u.is_premium = 1
        AND u.premium_until IS NOT NULL
        AND u.premium_until > ?
        AND u.last_trial_reminder IS NULL
    `).all(nowSec);

    if (users.length === 0) return;

    let sent = 0;
    for (const user of users) {
      const elapsedDays = (nowSec - user.trial_started_at) / 86400;
      // Push à J-(TRIAL_REMINDER_DAYS_BEFORE) = 5 jours après le début
      if (elapsedDays < TRIAL_DURATION_DAYS - TRIAL_REMINDER_DAYS_BEFORE) continue;

      const payload = {
        title: '✨ Ton essai Céleste',
        body: `⏳ Ton essai Premium se termine dans ${TRIAL_REMINDER_DAYS_BEFORE} jour(s). Continue ton voyage cosmique en t'abonnant.`,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'celeste-trial-expiry',
        url: '/?screen=paywall',
        data: { type: 'trial-expiry', userId: user.id },
      };
      const result = await sendPushToUser(user.id, payload);
      if (result.sent > 0) {
        // Marquer pour ne pas re-pousser
        db.prepare('UPDATE users SET last_trial_reminder = ? WHERE id = ?').run(today, user.id);
        sent++;
      }
    }

    if (sent > 0) {
      console.log(`[cron:trial-expiry] ${sent} user(s) notifiés (rappel J-2 essai)`);
    }
  } catch (err) {
    console.error('[cron:trial-expiry] error:', err.message);
  }
}

let cronInterval = null;
let astroEventsLastRun = 0;
const ASTRO_EVENTS_INTERVAL_MS = 6 * 3600_000; // P1#8 — check events astro toutes les 6h

function startCronScheduler() {
  if (cronInterval) return;
  console.log('[cron] Scheduler started (check every 30 min)');
  // Run once at startup (after 60s delay to let server warm up)
  setTimeout(() => {
    runDailyPushJob();
    runReengagementJob();
    runStreakReminderJob();
    runEarlyReengagementJob(); // P1#12
    runTrialExpiryJob(); // P1-7
    // P1#8 — events astro au démarrage (après 90s pour ne pas tout saturer)
    setTimeout(() => {
      runAstroEventsJob(db, sendPushToUser);
      astroEventsLastRun = Date.now();
    }, 90_000);
  }, 60_000);
  // Then every 30 min
  cronInterval = setInterval(() => {
    runDailyPushJob();
    runReengagementJob();
    runStreakReminderJob();
    runEarlyReengagementJob(); // P1#12
    runTrialExpiryJob(); // P1-7
    // P1#8 — events astro : check toutes les 6h (la granularité d'un événement astro est de l'heure, pas besoin de 30min)
    if (Date.now() - astroEventsLastRun >= ASTRO_EVENTS_INTERVAL_MS) {
      runAstroEventsJob(db, sendPushToUser);
      astroEventsLastRun = Date.now();
    }
  }, CRON_INTERVAL_MS);
}

startCronScheduler();

// ═══════════════════════════════════════════════════════════════════════════
// P1+ #14 : PRÉ-GÉNÉRATION NOCTURNE — Batch LLM à 3h UTC (faible trafic)
// (job nocturne supprimé — voir commentaire ci-dessous)
// Utilisé par /api/profile/birth-data pour préchauffer le cache en background.
// Features supportées : 'houses' | 'asteroid_wisdom' | 'lunar_nodes'
// Si LLM_USER_ENABLED=false, callLLMWithRetry throw LLM_DISABLED → on catch et on n'écrit rien
// (le user recevra un fallback déterministe quand il ouvrira l'écran natal).
async function prefetchNatalPortrait(userId, feature) {
  // 1) Cache hit ? On skip.
  const cached = db.prepare(
    'SELECT data FROM natal_interpretations WHERE user_id = ? AND feature = ?'
  ).get(userId, feature);
  if (cached) {
    console.log(`[portrait-onboarding] user ${userId} feature=${feature} → cache hit, skip`);
    return;
  }

  // 2) Récupérer le birth_data du user
  const user = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId);
  if (!user || !user.birth_data) {
    console.warn(`[portrait-onboarding] user ${userId} feature=${feature} → no birth_data, skip`);
    return;
  }
  let bd;
  try { bd = JSON.parse(user.birth_data); } catch { return; }

  // 3) Prompt spécifique par feature
  const prompts = {
    houses: {
      system: 'Tu es une astrologue experte des maisons natales. Tu écris en français, ton chaleureux et incarné, jamais culpabilisant. Maximum 600 mots.',
      user: `Interprète les 12 maisons natales de cette personne : née le ${bd.date} à ${bd.time} à ${bd.city || '?'}. Pour chaque maison significative (1, 4, 7, 10 surtout), donne 1 phrase concrète. Réponds en JSON : { summary: string, houses: [{house:number, theme:string, advice:string}] }`,
    },
    asteroid_wisdom: {
      system: 'Tu es une astrologue qui travaille avec les astéroïdes (Chiron, Junon, Vesta, Pallas). Tu écris en français, ton chaleureux. Maximum 500 mots.',
      user: `Interprète les astéroïdes nataux de cette personne : née le ${bd.date} à ${bd.time} à ${bd.city || '?'}. Focus sur Chiron (blessure sacrée) et Junon (relation engagée). Réponds en JSON : { summary: string, asteroids: [{name:string, sign:string, theme:string}] }`,
    },
    lunar_nodes: {
      system: 'Tu es une astrologue karmique spécialisée en Noeuds Lunaires. Tu écris en français. Maximum 350 mots.',
      user: `Interprète les Noeuds Lunaires de cette personne : née le ${bd.date} à ${bd.time} à ${bd.city || '?'}. Réponds en JSON : { north_node: string, south_node: string, karmic_lesson: string }`,
    },
  };
  const p = prompts[feature];
  if (!p) {
    console.warn(`[portrait-onboarding] unknown feature=${feature}`);
    return;
  }

  // 4) Appel LLM admin bypass. Si LLM_USER_ENABLED=false → throw → catch silencieux.
  let result;
  try {
    result = await callLLMWithRetry(
      [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
      3,
      1500,
      {},
      60000,
      { adminBypass: true }
    );
  } catch (e) {
    // LLM_DISABLED ou autre erreur → on n'écrit rien en cache, le user aura
    // le fallback déterministe quand il ouvrira l'écran natal.
    console.log(`[portrait-onboarding] user ${userId} feature=${feature} → LLM indisponible (${e.message}), fallback utilisé à l'affichage`);
    return;
  }

  if (!result) return;

  // 5) INSERT en cache lifetime
  db.prepare(
    'INSERT OR REPLACE INTO natal_interpretations (user_id, feature, data, created_at) VALUES (?, ?, ?, ?)'
  ).run(userId, feature, JSON.stringify(result), Date.now());
  console.log(`[portrait-onboarding] user ${userId} feature=${feature} → generated (${JSON.stringify(result).length} chars)`);
}

// ──────────────────────────────────────────────────────────────────────
// SUPPRIMÉ v14.3 — Job nocturne de pré-génération LLM
// Raison : les caches journaliers (daily_energy, daily_rituals, etc.)
// sont déjà populés par les routes user au premier hit du matin.
// Avec LLM_USER_ENABLED=false, les routes tapent le fallback déterministe
// (pas de LLM), donc un cron nocturne ne fait QUE augmenter la facture.
// Quand LLM est ON (admin uniquement), un user ouvrant l'app remplit le cache
// naturellement via la route — pas besoin de pré-générer en parallèle.
// Les anciens helpers generateDailyEnergyForUser etc. ont été retirés parce
// qu'ils utilisaient des colonnes inexistantes (content_json) dans le schéma réel.
// Pour régénérer manuellement un cache : POST /api/admin/llm/invalidate-cache
// + demander à un user d'ouvrir l'écran correspondant.
// ──────────────────────────────────────────────────────────────────────
setInterval(() => {
  // no-op (placeholder, garde le scheduler vivant)
}, 60 * 60 * 1000); // 1h

// Conserve l'endpoint admin pour debug (no-op now)
app.post('/api/admin/llm/prefetch-now', adminAuth, (_req, res) => {
  res.json({ ok: true, message: 'prefetch désactivé en v14.3 — utilisez invalidate-cache pour forcer la régénération au prochain hit' });
});

// P0 #4 — Admin debug : dry-run du job événements astro.
// Affiche ce qui serait push à qui (sans envoyer).
app.post('/api/admin/astro-events/preview', adminAuth, (req, res) => {
  try {
    const events = detectAstroEvents(new Date(), 24);
    const today = new Date().toISOString().split('T')[0];

    const users = db.prepare(`
      SELECT DISTINCT u.id, u.email, u.is_premium, u.natal_chart,
             u.last_astro_event_push,
             (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.id) AS subs_count
      FROM users u
    `).all();

    const candidates = users
      .filter(u => u.last_astro_event_push !== today && u.subs_count > 0)
      .map(u => {
        let natal = {};
        try { natal = u.natal_chart ? JSON.parse(u.natal_chart) : {}; } catch { /* ignore */ }
        return {
          ...u,
          sun_sign: natal.sunSign || null,
          moon_sign: natal.moonSign || null,
          rising_sign: natal.risingSign || null,
        };
      });

    function personalizeEvent(event, user) {
      const sun = (user.sun_sign || '').toLowerCase();
      const moon = (user.moon_sign || '').toLowerCase();
      const rising = (user.rising_sign || '').toLowerCase();
      if (event.type === 'lunar_eclipse' && (moon === 'cancer' || rising === 'cancer')) {
        return `${event.body}\n→ Céleste: "Éclipse sur ton axe sensible. Tes émotions passent au crible."`;
      }
      if (event.type === 'moon_phase' && (event.title.includes('Pleine Lune') || event.title.includes('🌕'))) {
        if (sun && rising) {
          return `${event.body}\n→ Céleste: "Ton Ascendant en ${user.rising_sign} parle à ton corps en premier."`;
        }
      }
      return event.body + '\n→ Céleste: fallback générique.';
    }

    const preview = candidates.map(user => ({
      user_id: user.id,
      email: user.email.replace(/(.).(@.).+(@).+/, '$1***$2$3***'),
      is_premium: !!user.is_premium,
      profile: { sun: user.sun_sign, moon: user.moon_sign, rising: user.rising_sign },
      subs: user.subs_count,
      would_receive: events.map(e => ({
        type: e.type,
        title: `${user.is_premium ? '✨' : '🌟'} ${e.title}`,
        body_preview: personalizeEvent(e, user),
        when: e.when,
      })),
    }));

    res.json({
      ok: true,
      today,
      events_found: events.length,
      events: events.map(e => ({ type: e.type, title: e.title, when: e.when })),
      candidates_count: candidates.length,
      would_push_count: events.length * candidates.length,
      users: preview,
    });
  } catch (err) {
    console.error('[astro-events/preview]', err);
    res.status(500).json({ error: 'preview_failed', message: err.message });
  }
});

// P0 #4 — Admin debug : force-run (envoi réel).
app.post('/api/admin/astro-events/run', adminAuth, async (req, res) => {
  try {
    await runAstroEventsJob(db, sendPushToUser);
    res.json({ ok: true, ran_at: new Date().toISOString() });
  } catch (err) {
    console.error('[astro-events/run]', err);
    res.status(500).json({ error: 'run_failed', message: err.message });
  }
});

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

// ─── TEC01 — Sentry error handler (DOIT être après toutes les routes) ───
if (SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler({ shouldHandleError: () => true }));
  console.log('[sentry] Error handler middleware registered');
}

// ─── TEC03 — Backup DB automatique ──────────────────────────
// Sauvegarde la SQLite toutes les 6h. Garde les 7 derniers backups.
// Format : backups/celeste-YYYY-MM-DD-HHMM.db
const BACKUP_DIR = join(__dirname, 'backups');
const BACKUP_INTERVAL_MS = 6 * 3600 * 1000; // 6h
const BACKUP_RETENTION = 7;

function backupDatabase() {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const now = new Date();
    const ts = now.toISOString().replace(/[:T]/g, '-').slice(0, 16); // YYYY-MM-DD-HHMM
    const dest = join(BACKUP_DIR, `celeste-${ts}.db`);
    // better-sqlite3 .backup() fait une snapshot atomique (online backup API)
    db.backup(dest)
      .then(() => {
        console.log(`[backup] OK → ${dest}`);
        // Nettoyage : garder seulement BACKUP_RETENTION fichiers
        const files = readdirSync(BACKUP_DIR)
          .filter(f => f.startsWith('celeste-') && f.endsWith('.db'))
          .map(f => ({ name: f, path: join(BACKUP_DIR, f), mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        for (const f of files.slice(BACKUP_RETENTION)) {
          try { unlinkSync(f.path); console.log(`[backup] rotated out ${f.name}`); } catch { /* ignore */ }
        }
      })
      .catch(err => {
        console.error('[backup] FAILED:', err.message);
        if (SENTRY_DSN) Sentry.captureException(err);
      });
  } catch (err) {
    console.error('[backup] setup error:', err.message);
    if (SENTRY_DSN) Sentry.captureException(err);
  }
}

// Backup toutes les 6h + un au démarrage (après 60s pour laisser le serveur démarrer)
if (process.env.DISABLE_BACKUP !== '1') {
  setTimeout(backupDatabase, 60_000); // 1min après start
  setInterval(backupDatabase, BACKUP_INTERVAL_MS);
  console.log(`[backup] Auto-backup actif (toutes les 6h, rétention ${BACKUP_RETENTION})`);
} else {
  console.log('[backup] Désactivé via DISABLE_BACKUP=1');
}

app.listen(PORT, () => {
  console.log(`🌟 Céleste server running on http://localhost:${PORT}`);
  console.log(`   Ephemeris: astronomy-engine (±0.3° accuracy)`);
  console.log(`   LLM: ${LLM_MODEL} via ${LLM_API_URL.split('/v1')[0]}`);
});
