/**
 * server/routes/personal-transits.js — "Transits du Jour"
 *
 * Instead of listing ALL planetary aspects of the day generically,
 * this computes which transiting planets TODAY are making exact aspects
 * to the user's NATAL planets. This is deeply personal — it's about
 * how today's sky touches YOUR chart specifically.
 *
 * For each activated natal planet:
 *   "Saturne carré ton Soleil" → interpretation + conseil
 *
 * Energy scoring: flow (trine/sextile) vs challenge (square/opposition)
 * Headline: "Aujourd'hui, le ciel te demande X et te soutient sur Y"
 *
 * Cached per user per day.
 *
 * Factory: receives shared deps, returns an Express router.
 */
import { Router } from 'express';

// ─── Constants ───────────────────────────────────────────────

const PLANETS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];

const PLANET_FR = {
  sun: 'Soleil', moon: 'Lune', mercury: 'Mercure', venus: 'Vénus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne',
  uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluton',
};

const PLANET_GLYPHS = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
};

const ASPECTS = [
  { name: 'conjunction', angle: 0,   orb: 8, nature: 'neutre',    glyph: '☌', fr: 'conjonte' },
  { name: 'opposition',  angle: 180, orb: 8, nature: 'tension',   glyph: '☍', fr: 'opposition' },
  { name: 'trine',       angle: 120, orb: 8, nature: 'harmonique',glyph: '△', fr: 'trigone' },
  { name: 'square',      angle: 90,  orb: 8, nature: 'tension',   glyph: '□', fr: 'carré' },
  { name: 'sextile',     angle: 60,  orb: 6, nature: 'harmonique',glyph: '⚹', fr: 'sextile' },
];

// ─── Compute transit→natal aspects ───────────────────────────

function angularDistance(lon1, lon2) {
  let d = Math.abs(lon1 - lon2);
  if (d > 180) d = 360 - d;
  return d;
}

function findTransitNatalAspects(natal, transits) {
  const aspects = [];

  for (const np of PLANETS) {
    const natalLon = natal[np]?.longitude;
    if (natalLon == null) continue;

    for (const tp of PLANETS) {
      const transitLon = transits[tp]?.longitude;
      if (transitLon == null) continue;

      // Skip same-planet self-aspect (e.g. transit Sun conjunct natal Sun = solar return, handle differently)
      const d = angularDistance(natalLon, transitLon);

      for (const aspect of ASPECTS) {
        const orbVal = Math.abs(d - aspect.angle);
        if (orbVal <= aspect.orb) {
          aspects.push({
            transitPlanet: tp,
            natalPlanet: np,
            transitPlanetFr: PLANET_FR[tp] || tp,
            natalPlanetFr: PLANET_FR[np] || np,
            transitGlyph: PLANET_GLYPHS[tp] || '',
            natalGlyph: PLANET_GLYPHS[np] || '',
            aspect: aspect.name,
            aspectFr: aspect.fr,
            aspectGlyph: aspect.glyph,
            nature: aspect.nature,
            orb: Math.round(orbVal * 10) / 10,
            exact: orbVal <= 1.5,
            // Weight: conjunction & opposition strongest, then square, then trine, then sextile
            weight: aspect.nature === 'tension' ? 3 - Math.min(2, orbVal / 2)
                  : aspect.nature === 'harmonique' ? 2 - Math.min(1, orbVal / 4)
                  : 2.5 - Math.min(1.5, orbVal / 3),
            transitRetrograde: transits[tp]?.retrograde || false,
          });
          break; // only one aspect type per pair
        }
      }
    }
  }

  // Sort by weight (strongest first)
  aspects.sort((a, b) => b.weight - a.weight);

  // Return top 5 most impactful
  return aspects.slice(0, 5);
}

// ─── Main router factory ─────────────────────────────────────

export function createPersonalTransitsRouter({ db, auth, getNatalPositions, getTransits, callLLMWithRetry }) {
  const router = Router();

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS personal_transits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      headline TEXT,
      flow_score INTEGER DEFAULT 0,
      challenge_score INTEGER DEFAULT 0,
      aspects_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    )
  `);

  // ─── GET /api/personal-transits ─────────────────────────
  router.get('/', auth, async (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    // Check cache
    const cached = db.prepare('SELECT * FROM personal_transits WHERE user_id = ? AND date = ?').get(userId, today);
    if (cached && cached.headline) {
      const aspects = cached.aspects_json ? JSON.parse(cached.aspects_json) : [];
      return res.json({
        date: cached.date,
        headline: cached.headline,
        flowScore: cached.flow_score,
        challengeScore: cached.challenge_score,
        aspects,
      });
    }

    // Get birth data
    let row = null;
    try { row = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(userId); } catch {}
    if (!row || !row.birth_data) {
      try { row = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId); } catch {}
    }
    if (!row || !row.birth_data) {
      return res.status(400).json({ error: 'Configure tes données de naissance pour voir tes transits personnels.' });
    }

    let birthData;
    try {
      birthData = typeof row.birth_data === 'string' ? JSON.parse(row.birth_data) : row.birth_data;
    } catch {
      return res.status(400).json({ error: 'Données de naissance invalides.' });
    }

    try {
      const natal = getNatalPositions(birthData, true);
      const transits = getTransits(new Date());
      const aspects = findTransitNatalAspects(natal, transits);

      // Compute energy scores
      let flowScore = 0, challengeScore = 0;
      for (const a of aspects) {
        if (a.nature === 'harmonique') flowScore += a.weight;
        else if (a.nature === 'tension') challengeScore += a.weight;
      }

      // Build LLM prompt for headline
      const sunSign = natal.sun?.sign || 'inconnu';
      const moonSign = natal.moon?.sign || 'inconnu';
      const aspectsSummary = aspects.length > 0
        ? aspects.map(a => `${a.transitPlanetFr} ${a.aspectFr} ton ${a.natalPlanetFr} (orb ${a.orb}°${a.transitRetrograde ? ', rétrograde' : ''})`).join('; ')
        : 'Aucun aspect majeur aujourd\'hui';

      const llmResponse = await callLLMWithRetry([
        {
          role: 'system',
          content: `Tu es Céleste, une astrologue intime et directe. Tu parles en français, à la deuxième personne (tu), avec chaleur et zéro jargon. Tu rends l'astrologie concrète et émotionnellement vraie.`
        },
        {
          role: 'user',
          content: `Profil: Soleil ${sunSign}, Lune ${moonSign}.

Transits d'aujourd'hui sur le thème natal:
${aspectsSummary}

Énergie: ${flowScore.toFixed(1)} en flow (harmonie), ${challengeScore.toFixed(1)} en défi (tension).

Génère un JSON avec ce format exact:
{
  "headline": "Une phrase qui résume la journée de CETTE personne. Format: 'Aujourd'hui le ciel te demande [X] et te soutient sur [Y]'. Max 140 caractères. Personnel, pas générique.",
  "aspects": [
    Pour CHAQUE aspect de la liste ci-dessus, génère:
    {
      "interpretation": "Ce que cet aspect signifie concrètement aujourd'hui pour cette personne. 2-3 phrases. Intime, pas scolaire. Pas de jargon astrologique.",
      "conseil": "Un conseil pratique et actionnable lié à cet aspect. 1 phrase. Commence par un verbe."
    }
  ]
}

Règles:
- headline DOIT utiliser le format "le ciel te demande X et te soutient sur Y"
- Si pas de défi: "le ciel est doux avec toi aujourd'hui, profite de [Y]"
- Si pas de flow: "le ciel te demande [X], mais ça sert ton évolution"
- interpretations: parle comme à une amie, pas comme un manuel d'astrologie
- Réponds UNIQUEMENT avec le JSON`
        }
      ], 3, 4000, { temperature: 0.85, reasoning_effort: 'low' }, 90000);

      const llmText = llmResponse.choices?.[0]?.message?.content || '';
      let parsed;
      try {
        // Extract the FIRST balanced JSON object — LLM sometimes adds trailing text.
        const startIdx = llmText.indexOf('{');
        if (startIdx === -1) throw new Error('no { in LLM response');
        let depth = 0;
        let endIdx = -1;
        for (let i = startIdx; i < llmText.length; i++) {
          if (llmText[i] === '{') depth++;
          else if (llmText[i] === '}') {
            depth--;
            if (depth === 0) { endIdx = i; break; }
          }
        }
        if (endIdx === -1) throw new Error('no balanced JSON in LLM response');
        parsed = JSON.parse(llmText.slice(startIdx, endIdx + 1));
      } catch {
        parsed = {
          headline: 'Le ciel bouge pour toi aujourd\'hui. Écoute ce qui se présente.',
          aspects: aspects.map(() => ({
            interpretation: 'Un aspect actif aujourd\'hui — reste attentif aux signes.',
            conseil: 'Respire avant de réagir.',
          })),
        };
      }

      // Merge LLM interpretations with computed aspect data
      const llmAspects = Array.isArray(parsed.aspects) ? parsed.aspects : [];
      const finalAspects = aspects.map((a, i) => ({
        ...a,
        interpretation: llmAspects[i]?.interpretation || 'Cet aspect active une partie de ton thème aujourd\'hui.',
        conseil: llmAspects[i]?.conseil || 'Reste à l\'écoute de ce qui se présente.',
      }));

      const result = {
        date: today,
        headline: parsed.headline || 'Le ciel t\'accompagne aujourd\'hui.',
        flowScore: Math.round(flowScore * 10) / 10,
        challengeScore: Math.round(challengeScore * 10) / 10,
        aspects: finalAspects,
      };

      // Save to DB
      const id = `${userId}-${today}`;
      db.prepare(`
        INSERT OR REPLACE INTO personal_transits
          (id, user_id, date, headline, flow_score, challenge_score, aspects_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, today, result.headline, result.flowScore, result.challengeScore, JSON.stringify(finalAspects));

      return res.json(result);
    } catch (err) {
      console.error('[personal-transits] error:', err.message);
      // Fallback
      const result = {
        date: today,
        headline: 'Le ciel a son propre rythme aujourd\'hui. Reste à l\'écoute.',
        flowScore: 0,
        challengeScore: 0,
        aspects: [],
      };
      try {
        const id = `${userId}-${today}`;
        db.prepare(`INSERT OR REPLACE INTO personal_transits (id, user_id, date, headline, flow_score, challenge_score, aspects_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(id, userId, today, result.headline, 0, 0, '[]');
      } catch {}
      return res.json(result);
    }
  });

  return router;
}
