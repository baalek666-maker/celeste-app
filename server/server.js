import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AstroTime, Body, GeoVector, SiderealTime, EclipticGeoMoon, Rotation_EQJ_ECL, RotateVector } from 'astronomy-engine';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import billingRouter, { stripeWebhookHandler, isStripeConfigured } from './billing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET is missing or too short (>= 32 chars required). Refusing to boot.');
}
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.cheapestinference.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const PORT = process.env.PORT || 3001;

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
    scans_remaining INTEGER DEFAULT 3,
    trial_started_at INTEGER,
    premium_until INTEGER,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
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

function getNatalPositions(birthData) {
  const local = new Date(`${birthData.date}T${birthData.time}:00`);
  const utc = new Date(local.getTime() - birthData.timezone * 3600000);
  const time = new AstroTime(utc);
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  const result = {};
  for (const p of planets) {
    const lon = geoEclipticLongitude(p, time);
    result[p] = {
      sign: SIGNS[Math.floor(lon/30)],
      degree: Math.round(lon % 30 * 10) / 10,
      retrograde: isRetrograde(p, time),
    };
  }
  // Ascendant
  const gst = SiderealTime(time); // returns hours (0-24), NOT degrees
  const gstDeg = gst * 15; // convert hours → degrees (1h = 15°)
  const lst = ((gstDeg + birthData.longitude) % 360 + 360) % 360;
  const eps = 23.4393 * Math.PI / 180;
  const latR = birthData.latitude * Math.PI / 180;
  const lstR = lst * Math.PI / 180;
  let asc = Math.atan2(-Math.cos(lstR), Math.sin(lstR)*Math.cos(eps)+Math.tan(latR)*Math.sin(eps)) * 180/Math.PI;
  asc = ((asc + 180) % 360 + 360) % 360; // +180°: formula gives descendant, flip to ascendant
  result.ascendant = { sign: SIGNS[Math.floor(asc/30)], degree: Math.round(asc%30 * 10) / 10 };
  return result;
}

// ─── LLM Horoscope Generation ──────────────────────────────
async function generateHoroscope(natalPositions, transits, sign) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const systemPrompt = `Tu es Céleste, un astrologue français bienveillant et perspicace. Tu écris des horoscopes personnalisés basés sur les vraies positions planétaires. Ton ton est psychologique, introspectif et moderne — jamais预言式 ou moralisateur. Tu écris en français.`;

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

  const response = await fetch(LLM_API_URL, {
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
      temperature: 0.8,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('LLM API error:', response.status, errText);
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  const msg = data.choices?.[0]?.message || {};
  const content = msg.content || msg.reasoning_content || '';

  // Parse JSON from response (handle markdown code blocks)
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in LLM response');
  }
  return JSON.parse(jsonMatch[0]);
}

// ─── LLM Compatibility Generation ──────────────────────────
async function generateCompatibility(chart1, chart2, sign1, sign2) {
  const systemPrompt = `Tu es Céleste, un astrologue français. Tu analyses la compatibilité entre deux thèmes nataux. Ton analyse est nuancée — tu soulignes les forces ET les défis. Tu écris en français.`;

  const userPrompt = `Personne 1 (signe solaire ${sign1}):
${Object.entries(chart1).map(([k,v]) => `${k}: ${v.sign} ${v.degree}°`).join('\n')}

Personne 2 (signe solaire ${sign2}):
${Object.entries(chart2).map(([k,v]) => `${k}: ${v.sign} ${v.degree}°`).join('\n')}

Analyse leur compatibilité amoureuse. Réponds en JSON:
{
  "score": un nombre 0-100 basé sur l'harmonie des aspects,
  "title": "un titre court et évocateur (ex: L'étincelle et la profondeur)",
  "strengths": ["force 1", "force 2", "force 3"],
  "challenges": ["défi 1", "défi 2"],
  "description": "2-3 phrases d'analyse globale nuancée"
}
Réponds UNIQUEMENT avec le JSON.`;

  const response = await fetch(LLM_API_URL, {
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
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
  const data = await response.json();
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
app.use(cors({ origin: true, credentials: true }));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ephemeris: 'astronomy-engine v2' });
});

// ─── Auth: Register ────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 min)' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase(), hash);
  const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: result.lastInsertRowid, email, isPremium: false, scansRemaining: 3 } });
});

// ─── Auth: Login ───────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
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
      birthData: user.birth_data ? JSON.parse(user.birth_data) : null,
    },
  });
});

// ─── Save birth data ───────────────────────────────────────
app.post('/api/profile/birth-data', auth, (req, res) => {
  const { birthData } = req.body;
  db.prepare('UPDATE users SET birth_data = ? WHERE id = ?').run(JSON.stringify(birthData), req.user.id);
  res.json({ ok: true });
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
    birthData: user.birth_data ? JSON.parse(user.birth_data) : null,
    premiumUntil: user.premium_until,
  });
});

// ─── Horoscope (LLM-powered) ───────────────────────────────
app.post('/api/horoscope', auth, llmLimiter, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Birth data required' });

    // Premium expiry check (defence-in-depth on top of Stripe webhook)
    const now = Math.floor(Date.now() / 1000);
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);

    const today = new Date().toISOString().split('T')[0];

    // Check cache first (cached responses bypass the free-tier gate)
    const cached = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, today);
    if (cached) return res.json(JSON.parse(cached.content));

    // Free-tier gate (server-side, authoritative)
    if (!isPremium) {
      if ((user.scans_remaining ?? 0) <= 0) {
        return res.status(402).json({ error: 'Free scans exhausted', code: 'paywall_required', scansRemaining: 0 });
      }
      db.prepare('UPDATE users SET scans_remaining = scans_remaining - 1 WHERE id = ?').run(req.user.id);
    }

    const birthData = JSON.parse(user.birth_data);
    const natalPositions = getNatalPositions(birthData);
    const transits = getTransits(new Date());
    const sunSign = natalPositions.sun.sign;

    const horoscope = await generateHoroscope(natalPositions, transits, sunSign);

    // Cache for the day
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content) VALUES (?, ?, ?)')
      .run(req.user.id, today, JSON.stringify(horoscope));

    // Return current scans_remaining so the frontend can show it
    const remaining = isPremium ? null : (user.scans_remaining - 1);
    res.json({ ...horoscope, scansRemaining: remaining });
  } catch (err) {
    console.error('Horoscope error:', err.message);
    res.status(500).json({ error: 'Failed to generate horoscope', detail: err.message });
  }
});

// ─── Compatibility (LLM-powered) ───────────────────────────
app.post('/api/compatibility', auth, llmLimiter, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Your birth data required' });

    // Premium expiry check
    const now = Math.floor(Date.now() / 1000);
    const isPremium = !!user.is_premium && (!user.premium_until || user.premium_until > now);

    // Free-tier gate (compatibility = 1 free analysis)
    if (!isPremium) {
      if ((user.scans_remaining ?? 0) <= 0) {
        return res.status(402).json({ error: 'Free scans exhausted', code: 'paywall_required', scansRemaining: 0 });
      }
      db.prepare('UPDATE users SET scans_remaining = scans_remaining - 1 WHERE id = ?').run(req.user.id);
    }

    const { partnerBirthData } = req.body;
    if (!partnerBirthData) return res.status(400).json({ error: 'Partner birth data required' });

    // Lightweight validation of partner birth data
    if (typeof partnerBirthData !== 'object' ||
        !partnerBirthData.date || !/^\d{4}-\d{2}-\d{2}$/.test(partnerBirthData.date) ||
        !partnerBirthData.time || !/^\d{2}:\d{2}$/.test(partnerBirthData.time) ||
        typeof partnerBirthData.latitude !== 'number' || Math.abs(partnerBirthData.latitude) > 90 ||
        typeof partnerBirthData.longitude !== 'number' || Math.abs(partnerBirthData.longitude) > 180) {
      return res.status(400).json({ error: 'Invalid partner birth data format' });
    }

    const chart1 = getNatalPositions(JSON.parse(user.birth_data));
    const chart2 = getNatalPositions(partnerBirthData);

    const result = await generateCompatibility(chart1, chart2, chart1.sun.sign, chart2.sun.sign);
    res.json({
      ...result,
      yourSun: chart1.sun.sign,
      theirSun: chart2.sun.sign,
      yourMoon: chart1.moon.sign,
      theirMoon: chart2.moon.sign,
      scansRemaining: isPremium ? null : (user.scans_remaining - 1),
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

// ─── Serve static frontend in production ───────────────────
app.use(express.static(join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return;
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌟 Céleste server running on http://localhost:${PORT}`);
  console.log(`   Ephemeris: astronomy-engine (±0.3° accuracy)`);
  console.log(`   LLM: ${LLM_MODEL} via ${LLM_API_URL.split('/v1')[0]}`);
});
