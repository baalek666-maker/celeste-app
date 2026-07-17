/**
 * CÉLESTE — Gamification Routes
 * XP, Levels, Daily Quests, Badges, Cosmic Events, Portrait, Horoscope Feedback
 */

import * as Astronomy from 'astronomy-engine';
import { CELESTE_VOICE, celesteSystemPrompt } from './celest-voice.js';

// ─── Constants ──────────────────────────────────────────────────

// v13 — Le Rituel Quotidien : 4 quêtes = 1 rituel matinal VMF-aligned.
// Chaque quête = un geste du rituel (pas une "tâche" gamifiée isolée).
// Cumul XP si toutes complétées = 65 XP. Streak dans DB déjà suivi côté server.js.
const QUEST_DEFS = [
  { key: 'horoscope', label: 'Lis ton horoscope du matin',          xp: 15 },
  { key: 'tarot',     label: 'Tire ta carte du jour',               xp: 15 },
  { key: 'journal',   label: 'Note ton ressenti dans le journal',   xp: 20 },
  { key: 'intention', label: 'Pose ton intention du jour',          xp: 15 },
];

const BADGE_DEFS = [
  { id: 'first_steps',     emoji: '🌟', title: 'Premiers pas',     desc: 'Créer ton compte céleste' },
  { id: 'first_horoscope', emoji: '🔮', title: 'Première lecture', desc: 'Consulter ton premier horoscope' },
  { id: 'first_tarot',     emoji: '🃏', title: 'Le Tirage',        desc: 'Tirer ta première carte' },
  { id: 'streak_7',        emoji: '🔥', title: 'Une semaine',      desc: '7 jours de suite' },
  { id: 'streak_30',       emoji: '🌙', title: 'Cycle lunaire',    desc: '30 jours de suite' },
  { id: 'explorer',        emoji: '◈',  title: 'Explorateur',      desc: 'Découvrir toutes les sections' },
  { id: 'journalist',      emoji: '✍️', title: 'Chroniqueur',      desc: '5 entrées de journal' },
  { id: 'compatibility',   emoji: '💗', title: 'Âmes liées',       desc: 'Première analyse de compatibilité' },
  { id: 'astrologer',      emoji: '✦',  title: 'Astrologue',       desc: 'Atteindre le niveau 5' },
  { id: 'master',          emoji: '👑', title: 'Maître céleste',   desc: 'Atteindre le niveau 10' },
  { id: 'cosmic_soul',     emoji: '💫', title: 'Âme cosmique',     desc: '100 jours de suite' },
];

const LEVEL_TITLES = [
  'Chercheur',      'Apprenti',     'Initié',       'Voyageur',
  'Astrologue',     'Mentor',       'Sage',         'Oracle',
  'Druide',         'Maître céleste',
];

// ─── XP / Level Math ────────────────────────────────────────────

function xpForLevel(level) {
  return 50 * level * (level - 1);
}

function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

// ─── Helpers ────────────────────────────────────────────────────

/** Local date as YYYY-MM-DD — matches server.js localISODate() to avoid UTC streak/quest mismatch. */
function localISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ensureDailyQuests(db, userId) {
  const today = localISODate();
  const existing = db.prepare('SELECT quest_key FROM daily_quests WHERE user_id = ? AND date = ?').all(userId, today);
  if (existing.length > 0) return;
  for (const q of QUEST_DEFS) {
    db.prepare('INSERT OR IGNORE INTO daily_quests (user_id, date, quest_key, quest_label, xp_reward) VALUES (?, ?, ?, ?, ?)')
      .run(userId, today, q.key, q.label, q.xp);
  }
}

function addXP(db, userId, amount, reason) {
  db.prepare('INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, amount, reason);
  const row = db.prepare('SELECT xp_total, level FROM user_xp WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO user_xp (user_id, xp_total, level) VALUES (?, ?, 1)').run(userId, amount);
    return { newLevel: 1, leveledUp: false };
  }
  const newXp = row.xp_total + amount;
  const newLevel = levelFromXp(newXp);
  const leveledUp = newLevel > row.level;
  db.prepare('UPDATE user_xp SET xp_total = ?, level = ?, updated_at = ? WHERE user_id = ?')
    .run(newXp, newLevel, Math.floor(Date.now() / 1000), userId);
  if (newLevel >= 5)  grantBadge(db, userId, 'astrologer');
  if (newLevel >= 10) grantBadge(db, userId, 'master');
  return { newLevel, leveledUp };
}

function grantBadge(db, userId, badgeId) {
  try {
    const result = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, badgeId);
    return result.changes > 0;
  } catch { return false; }
}

// ─── Route Registration ─────────────────────────────────────────

function registerGamificationRoutes(app, db, auth, callLLMWithRetry, getNatalPositions) {

  // ── GET /api/gamification/status ──
  app.get('/api/gamification/status', auth, (req, res) => {
    try {
      const userId = req.user.id;
      ensureDailyQuests(db, userId);

      const xpRow = db.prepare('SELECT * FROM user_xp WHERE user_id = ?').get(userId)
        || { xp_total: 0, level: 1 };
      const today = localISODate();
      const quests = db.prepare(
        'SELECT quest_key, quest_label, xp_reward, completed FROM daily_quests WHERE user_id = ? AND date = ?'
      ).all(userId, today);
      const earnedBadges = db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?')
        .all(userId).map(r => r.badge_id);

      const level = xpRow.level || 1;
      const xpTotal = xpRow.xp_total || 0;
      const currentLevelXp = xpForLevel(level);
      const nextLevelXp = xpForLevel(level + 1);
      const xpIntoLevel = xpTotal - currentLevelXp;
      const xpForNext = nextLevelXp - currentLevelXp;

      res.json({
        xp: xpTotal,
        level,
        levelTitle: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
        xpIntoLevel,
        xpForNext,
        progressPct: Math.round((xpIntoLevel / xpForNext) * 100),
        quests: quests.map(q => ({ ...q, completed: !!q.completed })),
        badges: BADGE_DEFS.map(b => ({ ...b, earned: earnedBadges.includes(b.id) })),
        badgesEarned: earnedBadges.length,
        badgesTotal: BADGE_DEFS.length,
        questsCompleted: quests.filter(q => q.completed).length,
        questsTotal: quests.length,
      });
    } catch (err) {
      console.error('gamification status error:', err.message);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // ── POST /api/gamification/quest/:questKey/complete ──
  app.post('/api/gamification/quest/:questKey/complete', auth, (req, res) => {
    try {
      const userId = req.user.id;
      const { questKey } = req.params;
      const questDef = QUEST_DEFS.find(q => q.key === questKey);
      if (!questDef) return res.status(400).json({ error: 'Unknown quest' });

      const today = localISODate();
      const quest = db.prepare(
        'SELECT * FROM daily_quests WHERE user_id = ? AND date = ? AND quest_key = ?'
      ).get(userId, today, questKey);
      if (!quest) return res.status(404).json({ error: 'Quest not found' });
      if (quest.completed) return res.json({ alreadyCompleted: true, xpAwarded: 0 });

      db.prepare('UPDATE daily_quests SET completed = 1, completed_at = ? WHERE id = ?')
        .run(Math.floor(Date.now() / 1000), quest.id);
      const { newLevel, leveledUp } = addXP(db, userId, quest.xp_reward, `Quest: ${questKey}`);

      if (questKey === 'horoscope') grantBadge(db, userId, 'first_horoscope');
      if (questKey === 'tarot')     grantBadge(db, userId, 'first_tarot');

      res.json({
        ok: true,
        xpAwarded: quest.xp_reward,
        newLevel,
        leveledUp,
        questKey,
      });
    } catch (err) {
      console.error('quest complete error:', err.message);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // ── GET /api/gamification/badges ──
  app.get('/api/gamification/badges', auth, (req, res) => {
    const userId = req.user.id;
    const earned = db.prepare('SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?').all(userId);
    const earnedMap = new Map(earned.map(b => [b.badge_id, b.earned_at]));
    res.json({
      badges: BADGE_DEFS.map(b => ({
        ...b,
        earned: earnedMap.has(b.id),
        earnedAt: earnedMap.get(b.id) || null,
      })),
      earnedCount: earned.length,
      totalCount: BADGE_DEFS.length,
    });
  });

  // ── POST /api/gamification/badge/:badgeId/grant (internal/manual) ──
  app.post('/api/gamification/badge/:badgeId/grant', auth, (req, res) => {
    const userId = req.user.id;
    const { badgeId } = req.params;
    const isNew = grantBadge(db, userId, badgeId);
    res.json({ ok: true, isNew, badgeId });
  });

  // ── GET /api/astro/events (Cosmic Calendar) ──
  // Returns upcoming celestial events for next 30 days
  app.get('/api/astro/events', auth, async (req, res) => {
    try {
      const ZODIAC_FR = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];
      const today = new Date();
      const events = [];

      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);

        // Moon phase calculation
        const astroTime = new Astronomy.AstroTime(date);
        const moonPhase = Astronomy.MoonPhase(astroTime);
        const moonAge = (moonPhase / 360) * 29.53;

        // Phase events
        if (Math.abs(moonAge - 0) < 0.75 || Math.abs(moonAge - 29.53) < 0.75) {
          events.push({ date: dateStr, type: 'new_moon', title: 'Nouvelle Lune', emoji: '🌑', description: 'Temps des nouveaux départs et intentions. Un moment privilégié pour fixer tes voeux.' });
        } else if (Math.abs(moonAge - 14.76) < 0.75) {
          events.push({ date: dateStr, type: 'full_moon', title: 'Pleine Lune', emoji: '🌕', description: 'Illumination et révélation. Ce qui était caché se révèle. Moment de plénitude.' });
        } else if (Math.abs(moonAge - 7.38) < 0.5) {
          events.push({ date: dateStr, type: 'first_quarter', title: 'Premier Quartier', emoji: '🌓', description: 'Action et décision. Les obstacles se précisent, à toi de les surmonter.' });
        } else if (Math.abs(moonAge - 22.15) < 0.5) {
          events.push({ date: dateStr, type: 'last_quarter', title: 'Dernier Quartier', emoji: '🌗', description: 'Lâcher prise et réflexion. Libère ce qui ne sert plus.' });
        }

        // Planet sign changes (Venus)
        if (i > 0) {
          try {
            const prevTime = new Astronomy.AstroTime(new Date(date.getTime() - 86400000));
            const prevVenus = Astronomy.GeoVector(Astronomy.Body.Venus, prevTime, false);
            const prevVenusLon = Math.atan2(prevVenus.y, prevVenus.x) * 180 / Math.PI;
            const prevVenusSign = Math.floor(((prevVenusLon % 360 + 360) % 360) / 30);

            const currVenus = Astronomy.GeoVector(Astronomy.Body.Venus, astroTime, false);
            const currVenusLon = Math.atan2(currVenus.y, currVenus.x) * 180 / Math.PI;
            const currVenusSign = Math.floor(((currVenusLon % 360 + 360) % 360) / 30);

            if (currVenusSign !== prevVenusSign) {
              events.push({ date: dateStr, type: 'venus_ingress', title: `Vénus en ${ZODIAC_FR[currVenusSign]}`, emoji: '♀', description: `Vénus entre en ${ZODIAC_FR[currVenusSign]}. L'amour et les valeurs prennent une nouvelle coloration.` });
            }
          } catch { /* ignore astronomy errors */ }
        }
      }

      // Deduplicate + sort
      const seen = new Set();
      const unique = events.filter(e => {
        const key = `${e.date}-${e.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => a.date.localeCompare(b.date));

      res.json({ events: unique, generated: Date.now() });
    } catch (err) {
      console.error('cosmic events error:', err.message);
      res.json({ events: [], error: err.message });
    }
  });

  // ── GET /api/natal-chart/portrait (Premium — 1500 word astrological portrait) ──
  app.get('/api/natal-chart/portrait', auth, async (req, res) => {
    try {
      const userId = req.user.id;

      // Premium-only: AstroPortrait is the most LLM-expensive feature (8192 tokens)
      const premCheck = db.prepare('SELECT is_premium, premium_until FROM users WHERE id = ?').get(userId);
      const now = Math.floor(Date.now() / 1000);
      const isPremium = !!premCheck?.is_premium && (!premCheck?.premium_until || premCheck.premium_until > now);
      if (!isPremium) {
        return res.status(403).json({ error: 'premium_required', message: 'Le Portrait Astral est réservé aux membres Premium.' });
      }

      // Check cache first
      const cached = db.prepare('SELECT * FROM astro_portraits WHERE user_id = ?').get(userId);
      if (cached) {
        return res.json({
          portrait: cached.portrait,
          wordCount: cached.word_count,
          cached: true,
          generatedAt: cached.generated_at,
        });
      }

      // Get user's birth data and compute natal chart on the fly
      const userRow = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId);
      if (!userRow || !userRow.birth_data) {
        return res.status(400).json({ error: 'Birth data required' });
      }
      const birthData = safeJsonParse(userRow.birth_data, null, 'users.birth_data');
      if (!birthData) {
        return res.status(400).json({ error: 'Birth data corrupted' });
      }
      // Compute natal chart from birth data (was reading users.natal_chart which is always NULL)
      const natalChart = typeof getNatalPositions === 'function'
        ? getNatalPositions(birthData, true)
        : null;

      // Build prompt
      const sunSign = natalChart?.sun?.sign || 'Verseau';
      const moonSign = natalChart?.moon?.sign || 'unknown';
      const risingSign = natalChart?.ascendant?.sign || 'unknown';
      const bd = birthData;

      // Use FR zodiac names directly from natal chart (already computed in French)
      const planetsArr = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
      const positionsStr = planetsArr
        .map(p => natalChart?.[p] ? `${p} en ${natalChart[p].sign} (${natalChart[p].degree?.toFixed(1)}°)${natalChart[p].retrograde ? ' R' : ''}` : null)
        .filter(Boolean)
        .join(', ');

      const prompt = `${celesteSystemPrompt('Tu rédiges un portrait astral complet (1200-1500 mots) pour une personne qui veut se comprendre.')}

DONNÉES NATALES:
- Soleil: ${sunSign}
- Lune: ${moonSign}
- Ascendant: ${risingSign}
- Naissance: ${bd.date} à ${bd.time} à ${bd.city}
- Positions: ${positionsStr}

STRUCTURE (utilise des titres avec ##):
## Ton essence: Soleil en ${sunSign}
Qui tu es au fond de toi — tes motivations, ton élan vital, ce qui te fait vibrer.

## Ton monde intérieur: Lune en ${moonSign}
Tes émotions, tes besoins, ce qui te sécurise, ce qui te fait du bien.

## Ton masque: Ascendant ${risingSign}
L'impression que tu donnes au premier abord, comment les autres te perçoivent.

## Ton chemin de vie
Comment ces trois forces dialoguent en toi et créent ta dynamique unique.

## Tes forces
3-4 atouts majeurs, avec des exemples concrets de ta vie quotidienne.

## Tes défis à apprivoiser
2-3 tensions qui te suivent, et comment les vivre plutôt que les subir.

## Ton cœur en amour
Comment tu aimes, ce que tu cherches chez l'autre, tes affinités.

Sois précise et spécifique aux signes de cette personne. Pas de listes à puces, fais des paragraphes.

Réponse au format JSON: {"portrait": "le texte complet avec les ##"}`;

      const result = await callLLMWithRetry(
        [{ role: 'user', content: prompt }],
        2,    // maxRetries
        8192, // maxTokens (glm-5.2 reasoning model needs more tokens)
        { response_format: { type: 'json_object' } },
        120000 // 120s timeout (portrait generation is long)
      );

      let portraitText = '';
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        // glm-5.2: content may be empty, check reasoning_content fallback
        let rawContent = parsed.choices?.[0]?.message?.content
          || parsed.choices?.[0]?.message?.reasoning_content
          || '';
        // Strip markdown code fences (glm-5.2 wraps JSON in ```json...```)
        rawContent = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
        portraitText = rawContent ? (JSON.parse(rawContent).portrait || rawContent) : (parsed.portrait || '');
      } catch {
        let rawFallback = result?.choices?.[0]?.message?.content
          || result?.choices?.[0]?.message?.reasoning_content
          || (typeof result === 'string' ? result : '');
        rawFallback = rawFallback.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
        // Try to extract .portrait from JSON
        try {
          const m = JSON.parse(rawFallback);
          portraitText = m.portrait || rawFallback;
        } catch {
          portraitText = rawFallback;
        }
      }

      if (!portraitText || portraitText.length < 200) {
        portraitText = `## Ton essence: Soleil en ${sunSign}\n\nTon Soleil en ${sunSign} illumine ton chemin. Cette position fondamentale définit qui tu es au plus profond de ton être.\n\n## Ton monde intérieur: Lune en ${moonSign}\n\nTa Lune en ${moonSign} gouverne ton paysage émotionnel et tes besoins les plus intimes.\n\n## Ton masque: Ascendant ${risingSign}\n\nTon Ascendant ${risingSign} est la première impression que tu donnes au monde.`;
      }

      const wordCount = portraitText.split(/\s+/).length;

      db.prepare('INSERT OR REPLACE INTO astro_portraits (user_id, portrait, word_count, generated_at) VALUES (?, ?, ?, ?)')
        .run(userId, portraitText, wordCount, Math.floor(Date.now() / 1000));

      res.json({
        portrait: portraitText,
        wordCount,
        cached: false,
        generatedAt: Math.floor(Date.now() / 1000),
      });
    } catch (err) {
      console.error('portrait error:', err.message);
      res.status(500).json({ error: 'Portrait generation failed. Réessayez plus tard.' });
    }
  });

  // ── POST /api/horoscope/feedback ──
  app.post('/api/horoscope/feedback', auth, (req, res) => {
    try {
      const userId = req.user.id;
      const { rating, note } = req.body;
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be 1-5' });
      }
      const today = localISODate();
      db.prepare(`INSERT OR REPLACE INTO horoscope_feedback (user_id, date, rating, note) VALUES (?, ?, ?, ?)`)
        .run(userId, today, rating, note || null);
      res.json({ ok: true });
    } catch (err) {
      console.error('horoscope feedback error:', err.message);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // ── GET /api/horoscope/feedback ──
  app.get('/api/horoscope/feedback', auth, (req, res) => {
    const userId = req.user.id;
    const rows = db.prepare('SELECT date, rating, note FROM horoscope_feedback WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(userId);
    res.json({ feedback: rows });
  });
}

export {
  registerGamificationRoutes,
  addXP,
  grantBadge,
  ensureDailyQuests,
  QUEST_DEFS,
  BADGE_DEFS,
  LEVEL_TITLES,
  xpForLevel,
  levelFromXp,
};
