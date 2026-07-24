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

// v14.7.7 — Thèmes des planètes natales (ce qu'elles représentent dans le thème).
// Utilisé pour générer des interprétations fallback uniques par aspect transit→natal.
const NATAL_THEMES = {
  sun:     'ton identité profonde et ta volonté',
  moon:    'ton monde émotionnel et tes besoins intimes',
  mercury: 'ta manière de penser et de communiquer',
  venus:   'ton rapport à l\'amour, au plaisir et aux valeurs',
  mars:    'ton énergie d\'action et ta combativité',
  jupiter: 'ta capacité d\'expansion et ta vision du monde',
  saturn:  'ta structure, tes responsabilités et ta maturité',
  uranus:  'ta soif de liberté et d\'innovation',
  neptune: 'ta sensibilité, ton intuition et ta spiritualité',
  pluto:   'ta capacité de transformation et de régénération',
};

// v14.7.7 — Qualités des planètes en transit (ce qu'elles activent).
const TRANSIT_QUALITIES = {
  sun:     'rayonnement et affirmation',
  moon:    'émotions et intuition',
  mercury: 'pensée et communication',
  venus:   'amour et douceur',
  mars:    'action et courage',
  jupiter: 'expansion et optimisme',
  saturn:  'structure et exigence',
  uranus:  'rupture et innovation',
  neptune: 'rêverie et dissolution',
  pluto:   'transformation et intensité',
};

// v14.7.7 — Conseils uniques par (nature × aspect). Avant : 3 conseils fixes pour 3 natures
// → si 5 aspects sont tous "tension", le user lisait 5 fois le même conseil.
const PERSONAL_COUNSEL = {
  harmonious: {
    conjunction: 'Accueille ce qui arrive et laisse-le te traverser.',
    opposition:   'Dialogue avec cette énergie nouvelle au lieu de résister.',
    trine:        'Profite de cette fluidité — agis maintenant.',
    square:       'Canalise cette énergie nouvelle dans un projet.',
    sextile:      'Saisis cette opportunité douce, même par un petit pas.',
  },
  tension: {
    conjunction: 'Canalise cette intensité dans un projet concret, pas dans l\'attente.',
    opposition:   'Prends du recul avant de répondre — la friction te dit quelque chose.',
    trine:        'L\'élan est là mais demande ton engagement.',
    square:       'Transforme la friction en action — sport, écriture, mouvement.',
    sextile:      'Engage-toi activement, l\'opportunité ne restera pas.',
  },
  neutre: {
    conjunction: 'Observe ce que cette rencontre active en toi.',
    opposition:   'Tu peux vouloir deux directions opposées, c\'est ok.',
    trine:        'Laisse couler, sans forcer.',
    square:       'Accepte l\'inconfort, il porte un message.',
    sextile:      'Sois attentif aux petits signes aujourd\'hui.',
  },
};

// v14.7.7 — Helper : génère interprétation + conseil uniques par aspect transit→natal.
function personalFallback(a) {
  const tName = a.transitPlanet || 'sun';
  const nName = a.natalPlanet || 'sun';
  const nature = a.nature || 'neutre';
  const aspect = a.aspect || 'conjunction';
  const tFr = a.transitPlanetFr || PLANET_FR[tName] || tName;
  const nFr = a.natalPlanetFr || PLANET_FR[nName] || nName;
  const tQ = TRANSIT_QUALITIES[tName] || TRANSIT_QUALITIES.sun;
  const nT = NATAL_THEMES[nName] || NATAL_THEMES.sun;

  // Interprétation : varie selon transit × natale × nature (3 dimensions = 30+ combinaisons)
  let interpretation;
  if (nature === 'harmonique') {
    interpretation = `${tFr} en transit active doucement ${nT}. C'est une journée pour laisser cette qualité (${tQ}) soutenir ce que tu incarnes déjà (${nT}).`;
  } else if (nature === 'tension') {
    // v14.7.7.1 — accord pluriel : on remplace le verbe à la 3e personne par "peuvent"
    // pour gérer les thèmes au pluriel ("tes besoins intimes", "ta structure, tes responsabilités", etc.).
    interpretation = `${tFr} en transit vient challenger ${nT}. Cette friction peut sembler inconfortable, mais elle t'invite à grandir — accepte que ${nT} peuvent se transformer sous la pression de ${tQ}.`;
  } else {
    interpretation = `${tFr} en transit rencontre ${nT}. C'est une rencontre qui met en lumière ce que tu portes en toi (${nT}) sous un jour nouveau — observe sans forcer.`;
  }

  // Conseil : 15 variations (3 natures × 5 aspects)
  const counselTable = PERSONAL_COUNSEL[nature] || PERSONAL_COUNSEL.neutre;
  const conseil = counselTable[aspect] || counselTable.conjunction;

  return { interpretation, conseil };
}

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
        // v14.7.7 — Fallback unique par aspect. Avant : interprétation/conseil identiques
        // pour TOUS les aspects du jour (même copier-coller 5x). Maintenant : variation
        // selon (transit_planète × natale_planète × nature × aspect) — chaque ligne est unique.
        parsed = {
          headline: 'Le ciel bouge pour toi aujourd\'hui. Écoute ce qui se présente.',
          aspects: aspects.map(a => personalFallback(a)),
        };
      }

      // Merge LLM interpretations with computed aspect data — fallback riche si LLM KO
      const llmAspects = Array.isArray(parsed.aspects) ? parsed.aspects : [];
      const finalAspects = aspects.map((a, i) => ({
        ...a,
        interpretation: llmAspects[i]?.interpretation || personalFallback(a).interpretation,
        conseil: llmAspects[i]?.conseil || personalFallback(a).conseil,
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
