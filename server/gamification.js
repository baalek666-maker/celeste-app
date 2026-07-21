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
//
// P1#10 — Quête 'intention' remplacée par 'rune'. L'intention était en overlap
// conceptuel avec le LunarCycle (intentions lunaires). Les runes (RuneOracle)
// sont un tirage distinct du tarot, donc la quête a sa propre identité.
const QUEST_DEFS = [
  { key: 'horoscope', label: 'Lis ton horoscope du matin',          xp: 15 },
  { key: 'tarot',     label: 'Tire ta carte du jour',               xp: 15 },
  { key: 'journal',   label: 'Note ton ressenti dans le journal',   xp: 20 },
  { key: 'rune',      label: 'Consulte ta rune du jour',            xp: 15 },
];

const BADGE_DEFS = [
  { id: 'first_steps',     emoji: '🌟', title: 'Premiers pas',     desc: 'Créer ton compte céleste', reward: 'Bienvenue sur Céleste', action: 'Tu viens de le débloquer' },
  { id: 'first_horoscope', emoji: '🔮', title: 'Première lecture', desc: 'Consulter ton premier horoscope', reward: '15 XP', action: 'Lis ton horoscope du jour' },
  { id: 'first_tarot',     emoji: '🃏', title: 'Le Tirage',        desc: 'Tirer ta première carte', reward: '15 XP', action: ' Tire ta carte du jour' },
  { id: 'streak_7',        emoji: '🔥', title: 'Une semaine',      desc: '7 jours de suite', reward: '1 streak freeze offert', action: 'Ouvre Céleste 7 jours de suite' },
  { id: 'streak_30',       emoji: '🌙', title: 'Cycle lunaire',    desc: '30 jours de suite', reward: '3 streak freezes offerts', action: 'Continue à ouvrir Céleste chaque jour' },
  { id: 'explorer',        emoji: '◈',  title: 'Explorateur',      desc: 'Découvrir toutes les sections', reward: '100 XP bonus', action: 'Explore les 3 piliers de la section Explorer' },
  { id: 'journalist',      emoji: '✍️', title: 'Chroniqueur',      desc: '5 entrées de journal', reward: '50 XP bonus', action: 'Écris 5 fois dans ton journal' },
  { id: 'compatibility',   emoji: '💗', title: 'Âmes liées',       desc: 'Première compatibilité', reward: '1 scan gratuit', action: 'Analyse ta compatibilité avec quelqu un' },
  { id: 'astrologer',      emoji: '✦',  title: 'Astrologue',       desc: 'Atteindre le niveau 5', reward: 'Titre "Astrologue"', action: 'Accumule de l XP via tes rituels quotidiens' },
  { id: 'master',          emoji: '👑', title: 'Maître céleste',   desc: 'Atteindre le niveau 10', reward: 'Titre "Maître céleste" + PDF offert', action: 'Atteins le niveau 10 en accumulant de l XP' },
  { id: 'cosmic_soul',     emoji: '💫', title: 'Âme cosmique',     desc: '100 jours de suite', reward: 'Statut légende + 5 freezes', action: '100 jours de présence' },
];

const LEVEL_TITLES = [
  'Chercheur',      'Apprenti',     'Initié',       'Voyageur',
  'Astrologue',     'Mentor',       'Sage',         'Oracle',
  'Druide',         'Maître céleste',
];

// ─── XP / Level Math ────────────────────────────────────────────
//
// P1#9 — Front-loading : courbe adoucie aux bas niveaux pour réduire le drop-off
// post-onboarding. Ancienne formule : 50 * level * (level - 1) → lvl 2=100, lvl 3=300.
// Nouvelle formule progressive :
//   - Niveaux 1-5  : +40 XP par niveau (early wins rapides, "aha moment")
//   - Niveaux 6-10 : +70 XP par niveau (mid-game engagement)
//   - Niveaux 11+  : +120 XP par niveau (long-term chase pour badge "Maître céleste")
//
// Détail cumulatif (seuil d'XP total pour atteindre le niveau) :
//   L2: 40   L3: 80   L4: 120  L5: 160   (early)
//   L6: 230  L7: 300  L8: 370  L9: 440  L10: 510  (mid)
//   L11: 630 L12: 750 L13: 870 ...               (late)
//
// Avant : L5 nécessitait 1000 XP. Maintenant : 160 XP. Le joueur sent son agent de rétention s'activer dès le J+1.
function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 5) return (level - 1) * 40;
  if (level <= 10) return 160 + (level - 5) * 70;
  return 510 + (level - 10) * 120;
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
    // Fric-portrait — userId déclaré en scope parent du try pour être
    // accessible dans le catch fallback.
    const userId = req.user.id;
    try {
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
      // safeJsonParse inline — non-accessible depuis server.js (non-exporté)
      let birthData = null;
      try { birthData = JSON.parse(userRow.birth_data); } catch { /* corrupted */ }
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
        0,    // maxRetries=0 — pas de retry (sinon circuit breaker + 6min bloqué)
        4096, // maxTokens réduit (glm-5.2 reasoning est lent, 8192 = timeout garanti)
        { response_format: { type: 'json_object' } },
        30000 // 30s — portrait est long à générer, fallback après
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
      // Fric-portrait — Fallback riche : génère un portrait de 1000+ mots
      // basé sur le natal chart réel, sans dépendre du LLM.
      try {
        const userRow2 = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId);
        let bd2 = null;
        try { bd2 = JSON.parse(userRow2?.birth_data || '{}'); } catch {}
        const natal2 = typeof getNatalPositions === 'function' && bd2?.date ? getNatalPositions(bd2, true) : null;

        const fallbackPortrait = generateRichPortrait(natal2, bd2);
        const wordCount2 = fallbackPortrait.split(/\s+/).length;
        db.prepare('INSERT OR REPLACE INTO astro_portraits (user_id, portrait, word_count, generated_at) VALUES (?, ?, ?, ?)')
          .run(userId, fallbackPortrait, wordCount2, Math.floor(Date.now() / 1000));
        return res.json({
          portrait: fallbackPortrait,
          wordCount: wordCount2,
          cached: false,
          fallback: true,
          generatedAt: Math.floor(Date.now() / 1000),
        });
      } catch (e2) {
        console.error('[portrait fallback] FAILED:', e2.message);
        res.status(500).json({ error: 'Portrait generation failed. Réessayez plus tard.' });
      }
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

// ─── Rich Portrait Generator (fallback sans LLM) ──────────────────
// Génère un portrait de 1000-1500 mots basé sur les positions planétaires
// réelles. Chaque planète a une interprétation détaillée par signe.

const PLANET_INTERPRETATIONS = {
  sun: {
    title: 'Ton essence',
    intro: (s) => `Ton Soleil en ${s} est le cœur de ton identité, le noyau de ta conscience. Il représente ce que tu cherches à exprimer dans le monde, ta vitalité fondamentale, la flamme qui t'anime.`,
    signs: {
      'Bélier': `Tu es un·e pionnier·e. Ton énergie est instinctive, directe, parfois impulsive. Tu as besoin d'action et de défis pour te sentir vivant·e. Ta force : le courage d'entreprendre. Ton défi : canaliser ton feu sans te brûler. Tu apprends la patience en comprenant que la vraie force n'est pas dans la précipitation mais dans la persévérance.`,
      'Taureau': `Tu cherches la stabilité, la sécurité, le confort des sens. Tu es ancré·e, patient·e, fidèle. Tu as besoin de beauté et de plaisir dans ton quotidien. Ta force : la constance. Ton défi : accepter le changement. Tu apprends que la vraie sécurité ne vient pas de ce qu'on accumule mais de la confiance en soi.`,
      'Gémeaux': `Tu es un·e éternel·le curieux·se. Ton esprit va vite, tu explores, tu communiques. Tu as besoin de variété et d'échanges. Ta force : l'adaptabilité. Ton défi : la dispersion. Tu apprends à aller au bout d'une idée plutôt que de survoler tout.`,
      'Cancer': `Tu es profondément sensible et protecteur·rice. Ton monde intérieur est riche, tu ressens tout. Tu as besoin de sécurité émotionnelle et d'un foyer qui te ressemble. Ta force : l'empathie. Ton défi : ne pas te refermer. Tu apprends à accueillir tes émotions sans te laisser submerger.`,
      'Lion': `Tu rayonnes naturellement. Tu as besoin d'être vu·e, reconnu·e, de créer. Ta vitalité est contagieuse, tu inspires les autres par ta simple présence. Ta force : la générosité du cœur. Ton défi : l'ego. Tu apprends que le vrai rayonnement vient de l'intérieur, pas de l'approbation extérieure.`,
      'Vierge': `Tu cherches l'amélioration, la précision, l'utile. Tu analyses, tu organises, tu sers. Tu as besoin de sentir que tu contribues. Ta force : le discernement. Ton défi : le perfectionnisme. Tu apprends que la valeur n'est pas dans la perfection mais dans l'authenticité.`,
      'Balance': `Tu cherches l'harmonie, la beauté, la justice. Tu es un·e diplomate né·e, tu vois les deux côtés. Tu as besoin de relations équilibrées. Ta force : la médiation. Ton défi : l'indécision. Tu apprends à choisir ton camp sans culpabiliser.`,
      'Scorpion': `Tu vas en profondeur. Rien de superficiel ne t'intéresse. Tu transformes, tu régénères, tu guéris. Tu as besoin d'intensité et de vérité. Ta force : la résilience. Ton défi : le contrôle. Tu apprends à lâcher prise et à faire confiance.`,
      'Sagittaire': `Tu cherches le sens, l'aventure, la vérité. Tu es un·e explorateur·rice de la vie et des idées. Tu as besoin de liberté et d'horizons. Ta force : l'optimisme. Ton défi : l'excès. Tu apprends que la vraie liberté inclut la responsabilité.`,
      'Capricorne': `Tu bâtis pour le long terme. Ambitieux·se, discipliné·e, patient·e. Tu as besoin de structure et de réalisations tangibles. Ta force : la persévérance. Ton défi : la rigidité. Tu apprends que le succès sans joie n'est pas un succès.`,
      'Verseau': `Tu es un·e visionnaire. Tu penses autrement, tu innoves, tu questionnes. Tu as besoin de liberté et d'authenticité. Ta force : l'originalité. Ton défi : la distance émotionnelle. Tu apprends que l'indépendance n'exclut pas l'intimité.`,
      'Poissons': `Tu es un·e rêveur·se, intuitif·ve, profondément empathique. Tu ressens ce que les autres ne voient pas. Tu as besoin de créativité et de transcendance. Ta force : la compassion. Ton défi : les frontières. Tu apprends à te protéger sans te fermer.`,
    },
  },
  moon: {
    title: 'Ton monde intérieur',
    intro: (s) => `Ta Lune en ${s} révèle ton paysage émotionnel — comment tu ressens, comment tu te sécurises, de quoi tu as besoin pour te sentir en sécurité. C'est la part de toi que peu de gens voient.`,
    signs: {
      'Bélier': `Tes émotions sont vives et spontanées. Tu ressens fort, tu réagis vite. Ta sécurité vient de l'action. Quand tu te sens coincé·e, tu as besoin de bouger, de faire quelque chose. Apprends à rester avec tes émotions sans immédiatement vouloir les résoudre.`,
      'Taureau': `Tes émotions sont stables et profondes. Tu as besoin de confort matériel et sensoriel. La nature, la musique, la bonne nourriture te réparent. Ta sécurité vient de la simplicité. Apprends à accueillir le changement sans craindre de tout perdre.`,
      'Gémeaux': `Tes émotions passent par le mental. Tu verbalises ce que tu ressens. Ta sécurité vient de la communication et de la variété. Apprends à ressentir sans nécessairement comprendre.`,
      'Cancer': `Tes émotions sont vastes comme l'océan. Tu ressens tout, intuitivement. Ta sécurité vient du foyer, de la famille, des racines. Tu prends soin des autres naturellement. Apprends à te protéger sans te replier.`,
      'Lion': `Tes émotions sont généreuses et théâtrales. Tu as besoin d'être apprécié·e pour te sentir en sécurité. Ta chaleur émotionnelle est un cadeau. Apprends à te valider de l'intérieur.`,
      'Vierge': `Tes émotions passent par l'analyse. Tu as besoin d'ordre et d'utile. Tu montres ton amour en aidant. Apprends à accueillir le chaos émotionnel sans vouloir le réparer.`,
      'Balance': `Tes émotions sont liées aux autres. Tu as besoin d'harmonie relationnelle. Apprends à ressentir tes émotions même quand elles dérangent l'équilibre.`,
      'Scorpion': `Tes émotions sont intenses et secrètes. Tu ressens tout en profondeur. Ta sécurité vient de la vérité et de l'intimité totale. Apprends à partager tes vulnérabilités.`,
      'Sagittaire': `Tes émotions cherchent l'horizon. Tu as besoin de liberté émotionnelle et d'aventure. Apprends à rester avec la tristesse sans vouloir fuir.`,
      'Capricorne': `Tes émotions sont contenues et sérieuses. Tu gères seul·e. Ta sécurité vient de la compétence et de la structure. Apprends à demander de l'aide.`,
      'Verseau': `Tes émotions sont detachees et originales. Tu as besoin d'espace et d'amis. Apprends à laisser l'intimité émotionnelle entrer.`,
      'Poissons': `Tes émotions sont fluides, sans frontières. Tu absorbes l'atmosphère. Ta sécurité vient de la créativité et du silence. Apprends à mettre des limites.`,
    },
  },
  rising: {
    title: 'Ton masque',
    intro: (s) => `Ton Ascendant ${s} est la première impression que tu donnes. C'est ton masque social, ta façon spontanée d'aborder le monde. Les gens voient ton Ascendant avant de découvrir ton Soleil.`,
    signs: {
      'Bélier': `Tu apparaîs direct·e, énergique, franc·e. On te perçoit comme quelqu'un qui agit. Ta présence donne une impression de mouvement.`,
      'Taureau': `Tu apparaîs calme, posé·e, rassurant·e. On te perçoit comme quelqu'un de stable. Ta présence donne une impression de tranquillité.`,
      'Gémeaux': `Tu apparaîs vif·ve, curieux·se, bavard·e. On te perçoit comme quelqu'un d'intéressant. Ta présence donne une impression d'animation.`,
      'Cancer': `Tu apparaîs doux·ce, sensible, accueillant·e. On te perçoit comme quelqu'un de bienveillant. Ta présence donne une impression de chaleur.`,
      'Lion': `Tu apparaîs confiant·e, chaleureux·se, rayonnant·e. On te perçoit comme quelqu'un qui a de la présence. Ta présence donne une impression de lumière.`,
      'Vierge': `Tu apparaîs soigné·e, précis·e, serviable. On te perçoit comme quelqu'un de fiable. Ta présence donne une impression d'ordre.`,
      'Balance': `Tu apparaîs élégant·e, diplomate, aimable. On te perçoit comme quelqu'un d'agréable. Ta présence donne une impression d'harmonie.`,
      'Scorpion': `Tu apparaîs intense, mystérieux·se, magnétique. On te perçoit comme quelqu'un de profond. Ta présence donne une impression de puissance.`,
      'Sagittaire': `Tu apparaîs enthousiaste, ouvert·e, libre. On te perçoit comme quelqu'un d'aventureux. Ta présence donne une impression d'horizon.`,
      'Capricorne': `Tu apparaîs sérieux·se, ambitieux·se, mature. On te perçoit comme quelqu'un de responsable. Ta présence donne une impression de solidité.`,
      'Verseau': `Tu apparaîs original·e, indépendant·e, visionnaire. On te perçoit comme quelqu'un d'unique. Ta présence donne une impression de liberté.`,
      'Poissons': `Tu apparaîs doux·ce, rêveur·se, mystérieux·se. On te perçoit comme quelqu'un de sensible. Ta présence donne une impression de profondeur.`,
    },
  },
};

const PLANET_EXTRA = {
  mercury: { name: 'Mercure', title: 'Ta façon de penser',
    intro: (s) => `Mercure en ${s} décrit comment tu communiques, comment tu penses, comment tu apprends. C'est ton mental, ta voix intérieure, la façon dont tu traites l'information.`,
    body: {
      'Feu': `Ta pensée est rapide, intuitive, directe. Tu vas à l'essentiel sans détour. Quand quelque chose t'intéresse, tu t'enflammes et tu veux tout savoir immédiatement. Ta communication est franche, parfois tranchante. Tu apprends par l'action et l'expérience, pas par la théorie. Les autres apprécient ta clarté mais peuvent parfois te trouver un peu abrupt·e. Apprends à laisser aux autres le temps de te suivre.`,
      'Terre': `Ta pensée est pratique, méthodique, concrète. Tu structures tes idées, tu les testes dans le réel. Tu ne parles pas pour rien dire — quand tu prends la parole, c'est pesé et utile. Tu apprends par la répétition et l'application. Les autres te font confiance pour ta rigueur. Apprends à laisser place à l'intuition, pas seulement à la logique.`,
      'Air': `Ta pensée est analytique, conceptuelle, connectée. Tu vois les liens que les autres ne voient pas. Tu adores débattre, échanger, explorer des idées. Tu apprends par la lecture et la conversation. Les autres viennent te voir pour tes perspectives. Apprends à transformer tes idées en actions concrètes.`,
      'Eau': `Ta pensée est intuitive, émotionnelle, imaginative. Tu ressens avant de comprendre. Ta communication est nuancée, poétique, parfois indirecte. Tu apprends par l'impression et le ressenti. Les autres te trouvent profond·e et inspirant·e. Apprends à structurer tes intuitions pour les partager.`,
    },
  },
  venus: { name: 'Vénus', title: 'Ta façon d\'aimer',
    intro: (s) => `Vénus en ${s} décrit comment tu aimes, ce que tu valorises, ce qui te donne du plaisir. C'est ta façon de te connecter aux autres, ton sens de la beauté, ta capacité à recevoir.`,
    body: {
      'Feu': `Tu aimes avec passion et générosité. Tu offres tout, tu te donnes entièrement. Ton amour est un feu qui réchauffe. Tu as besoin d'admiration et de jeu dans tes relations. Tu te sens aimé·e quand on te montre qu'on te désire. Apprends à recevoir autant que tu donnes.`,
      'Terre': `Tu aimes avec constance et sensualité. Tu montres ton amour par des actes concrets — un repas préparé, une présence stable, un cadeau réfléchi. Tu as besoin de sécurité et de confort partagé. Tu te sens aimé·e quand on prend soin de toi au quotidien. Apprends à exprimer tes émotions avec des mots, pas seulement des gestes.`,
      'Air': `Tu aimes par la communication et le partage d'idées. Pour toi, l'amour est d'abord une rencontre mentale. Tu as besoin de complicité intellectuelle et de liberté. Tu te sens aimé·e quand on t'écoute vraiment. Apprends à laisser place au silence et à la tendresse non-verbale.`,
      'Eau': `Tu aimes en profondeur, avec dévotion et tendresse. Ton amour est total, presque fusionnel. Tu as besoin de connexion émotionnelle et d'intimité. Tu te sens aimé·e quand on te comprend sans mots. Apprends à mettre des limites pour ne pas te perdre dans l'autre.`,
    },
  },
  mars: { name: 'Mars', title: 'Ta façon d\'agir',
    intro: (s) => `Mars en ${s} décrit ton énergie, ta volonté, comment tu poursuis tes désirs. C'est ce qui te met en mouvement, ta force motrice, ta façon de combattre.`,
    body: {
      'Feu': `Tu agis avec impulsion et courage. Tu fonces, tu oses, tu prends des risques. Ton énergie est contagieuse. Quand tu veux quelque chose, rien ne t'arrête. Ta colère est vive mais courte. Apprends à canaliser ton feu pour qu'il serve tes objectifs à long terme, pas seulement l'instant.`,
      'Terre': `Tu agis avec patience et détermination. Tu persévères, tu ne lâches pas. Ton énergie est constante, comme une rivière qui creuse la pierre. Tu atteins tes objectifs par la régularité. Apprends à accélérer quand l'opportunité se présente, sans toujours attendre le moment parfait.`,
      'Air': `Tu agis par la communication et le réseau. Tu mobilises les autres, tu crées des alliances. Ton énergie vient des idées et des échanges. Tu combats par la persuasion. Apprends à passer de la parole à l'action.`,
      'Eau': `Tu agis par intuition et émotion. Tu protèges ce qui compte pour toi avec une force surprenante. Ton énergie vient du cœur. Tu combats pour les gens que tu aimes. Apprends à utiliser ton intuition pour anticiper, pas seulement pour réagir.`,
    },
  },
  jupiter: { name: 'Jupiter', title: 'Ta façon de grandir',
    intro: (s) => `Jupiter en ${s} décrit où tu trouves ton expansion, ta chance, ta sagesse. C'est ton domaine de croissance, ce qui t'ouvre au monde.`,
    body: {
      'Feu': `Tu grandis par l'aventure, l'enthousiasme, la confiance en la vie. Ta chance vient de ton optimisme et de ta capacité à oser. Tu apprends en voyageant, en explorant, en te lançant. Ta sagesse vient de l'expérience directe. Apprends à ne pas confondre confiance et imprudence.`,
      'Terre': `Tu grandis par le travail, la discipline, la réussite tangible. Ta chance vient de ta persévérance et de ta compétence. Tu apprends en bâtissant, en accumulant, en maîtrisant. Ta sagesse est concrète et applicable. Apprends à célébrer tes réussites, pas seulement à viser la suivante.`,
      'Air': `Tu grandis par l'apprentissage, les échanges, les idées. Ta chance vient de ton réseau et de ta curiosité. Tu apprends en discutant, en lisant, en enseignant. Ta sagesse est conceptuelle et partagée. Apprends à aller au-delà de la théorie.`,
      'Eau': `Tu grandis par l'introspection, la compassion, la guérison. Ta chance vient de ton intuition et de ta sensibilité. Tu apprends en ressentant, en méditant, en aidant. Ta sagesse est profonde et spirituelle. Apprends à partager ta sagesse avec le monde.`,
    },
  },
  saturn: { name: 'Saturne', title: 'Ta structure',
    intro: (s) => `Saturne en ${s} décrit tes défis, ta discipline, ce qui te demande de l'effort mais te rend solide. C'est ton épreuve, ton maître, ce qui te structure en profondeur.`,
    body: {
      'Feu': `Ton défi : canaliser ton feu sans t'épuiser. Saturne te demande de transformer ton impulsivité en maîtrise. Ta structure vient de la passion canalisée. Le travail qui te rend solide : t'engager sur la durée, pas seulement sur le moment.`,
      'Terre': `Ton défi : ne pas te figer dans la routine. Saturne te demande de rester souple tout en bâtissant. Ta structure vient de la patience et de la méthode. Le travail qui te rend solide : accepter que tout ne peut pas être contrôlé.`,
      'Air': `Ton défi : concrétiser tes idées. Saturne te demande de passer du concept à la réalité. Ta structure vient de l'engagement et de la responsabilité. Le travail qui te rend solide : finir ce que tu commences.`,
      'Eau': `Ton défi : gérer tes émotions sans te laisser submerger. Saturne te demande de structurer ta sensibilité. Ta structure vient de l'introspection disciplinée. Le travail qui te rend solide : poser des limites émotionnelles claires.`,
    },
  },
};

const SIGN_TO_ELEMENT = {
  'Bélier': 'Feu', 'Lion': 'Feu', 'Sagittaire': 'Feu',
  'Taureau': 'Terre', 'Vierge': 'Terre', 'Capricorne': 'Terre',
  'Gémeaux': 'Air', 'Balance': 'Air', 'Verseau': 'Air',
  'Cancer': 'Eau', 'Scorpion': 'Eau', 'Poissons': 'Eau',
};

function generateRichPortrait(natal, bd) {
  if (!natal?.sun?.sign) {
    return '## Portrait en préparation\n\nTon thème natal est en cours de calcul. Reviens dans quelques instants pour découvrir ton portrait complet.';
  }

  const sunSign = natal.sun?.sign || 'Verseau';
  const moonSign = natal.moon?.sign || 'Cancer';
  const risingSign = natal.ascendant?.sign || 'Balance';
  const birthInfo = bd?.date
    ? `Tu es né·e le ${bd.date}${bd.time ? ' à ' + bd.time : ''}${bd.city ? ' à ' + bd.city : ''}.`
    : '';

  let portrait = '';

  // Intro
  portrait += `## Ton ciel unique\n\n${birthInfo} Ce portrait est le reflet de ton ciel à l'instant de ta naissance — un instant unique, irréversible, qui contient en germe tout ton potentiel. Tes planètes dessinent une carte, pas un destin. Ce que tu en fais t'appartient.\n\n`;

  // Soleil
  const sunInterp = PLANET_INTERPRETATIONS.sun;
  portrait += `## ${sunInterp.title} : Soleil en ${sunSign}\n\n`;
  portrait += sunInterp.intro(sunSign) + '\n\n';
  portrait += (sunInterp.signs[sunSign] || sunInterp.signs['Verseau']) + '\n\n';

  // Lune
  const moonInterp = PLANET_INTERPRETATIONS.moon;
  portrait += `## ${moonInterp.title} : Lune en ${moonSign}\n\n`;
  portrait += moonInterp.intro(moonSign) + '\n\n';
  portrait += (moonInterp.signs[moonSign] || moonInterp.signs['Cancer']) + '\n\n';

  // Ascendant
  const risingInterp = PLANET_INTERPRETATIONS.rising;
  portrait += `## ${risingInterp.title} : Ascendant ${risingSign}\n\n`;
  portrait += risingInterp.intro(risingSign) + '\n\n';
  portrait += (risingInterp.signs[risingSign] || risingInterp.signs['Balance']) + '\n\n';

  // Mercure, Vénus, Mars, Jupiter, Saturne
  for (const [key, meta] of Object.entries(PLANET_EXTRA)) {
    const p = natal[key];
    if (!p?.sign) continue;
    const element = SIGN_TO_ELEMENT[p.sign] || 'Feu';
    portrait += `## ${meta.title} : ${meta.name} en ${p.sign}\n\n`;
    portrait += meta.intro(p.sign) + '\n\n';
    portrait += (meta.body[element] || meta.body['Feu']) + '\n\n';
  }

  // Synthèse éléments
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn'];
  const counts = { Feu: 0, Terre: 0, Air: 0, Eau: 0 };
  for (const k of planets) {
    const s = natal[k]?.sign;
    if (s && SIGN_TO_ELEMENT[s]) counts[SIGN_TO_ELEMENT[s]]++;
  }
  const dominantElement = Object.entries(counts).sort((a,b) => b[1] - a[1])[0][0];
  const elementTexts = {
    Feu: `Ton ciel est dominé par le Feu. Tu es quelqu'un de passionné, d'enthousiaste, qui a besoin d'action. Ta créativité est ton plus grand atout. Le risque : t'épuiser à tout vouloir faire en même temps. Apprends à canaliser ton feu.`,
    Terre: `Ton ciel est dominé par la Terre. Tu es quelqu'un de pragmatique, de stable, qui construit pour durer. Ta fiabilité est ton plus grand atout. Le défi : ne pas devenir rigide. Apprends à accueillir l'imprévu.`,
    Air: `Ton ciel est dominé par l'Air. Tu es quelqu'un de mental, de social, qui connecte les idées et les gens. Ton ouverture est ton plus grand atout. Le défi : ne pas te disperser. Apprends à ancrer tes idées dans l'action.`,
    Eau: `Ton ciel est dominé par l'Eau. Tu es quelqu'un de profondément sensible, d'intuitif, qui ressent ce que les autres ne voient pas. Ton empathie est ton plus grand atout. Le défi : ne pas te noyer. Apprends à te protéger sans te fermer.`,
  };
  portrait += `## Ta dominante\n\n${elementTexts[dominantElement] || elementTexts.Feu}\n\n`;
  portrait += `Répartition de tes planètes : Feu ${counts.Feu} · Terre ${counts.Terre} · Air ${counts.Air} · Eau ${counts.Eau}.\n\n`;

  // Conclusion
  portrait += `## Ton chemin\n\nCe portrait n'est pas une boîte mais une boussole. Tes planètes indiquent des tendances, des énergies, des potentiels — jamais des certitudes. Tu es libre de ce que tu fais de ce ciel. L'astrologie ne prédit pas l'avenir : elle t'aide à te comprendre pour mieux choisir.\n\nReviens consulter ce portrait quand tu te sens perdu·e. Il est là pour te rappeler qui tu es, dans les moments où tu l'oublies.`;

  return portrait;
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
