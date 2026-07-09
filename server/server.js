import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { AstroTime, Body, GeoVector, SiderealTime, EclipticGeoMoon, Rotation_EQJ_ECL, RotateVector } from 'astronomy-engine';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'celeste-secret-change-in-prod';
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
`);

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
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Server ────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ephemeris: 'astronomy-engine v2' });
});

// ─── Auth: Register ────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
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
app.post('/api/auth/login', async (req, res) => {
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
app.post('/api/horoscope', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Birth data required' });

    const today = new Date().toISOString().split('T')[0];

    // Check cache first
    const cached = db.prepare('SELECT content FROM horoscope_cache WHERE user_id = ? AND date = ?').get(req.user.id, today);
    if (cached) return res.json(JSON.parse(cached.content));

    const birthData = JSON.parse(user.birth_data);
    const natalPositions = getNatalPositions(birthData);
    const transits = getTransits(new Date());
    const sunSign = natalPositions.sun.sign;

    const horoscope = await generateHoroscope(natalPositions, transits, sunSign);

    // Cache for the day
    db.prepare('INSERT OR REPLACE INTO horoscope_cache (user_id, date, content) VALUES (?, ?, ?)')
      .run(req.user.id, today, JSON.stringify(horoscope));

    res.json(horoscope);
  } catch (err) {
    console.error('Horoscope error:', err.message);
    res.status(500).json({ error: 'Failed to generate horoscope', detail: err.message });
  }
});

// ─── Compatibility (LLM-powered) ───────────────────────────
app.post('/api/compatibility', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user?.birth_data) return res.status(400).json({ error: 'Your birth data required' });

    const { partnerBirthData } = req.body;
    if (!partnerBirthData) return res.status(400).json({ error: 'Partner birth data required' });

    const chart1 = getNatalPositions(JSON.parse(user.birth_data));
    const chart2 = getNatalPositions(partnerBirthData);

    const result = await generateCompatibility(chart1, chart2, chart1.sun.sign, chart2.sun.sign);
    res.json(result);
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
app.post('/api/premium/activate', auth, (req, res) => {
  const { plan } = req.body; // 'weekly' or 'annual'
  const now = Date.now();
  const duration = plan === 'annual' ? 365 * 86400000 : 7 * 86400000;
  const until = now + duration;
  db.prepare('UPDATE users SET is_premium = 1, premium_until = ?, scans_remaining = 999999 WHERE id = ?')
    .run(until, req.user.id);
  res.json({ isPremium: true, premiumUntil: until });
});

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
