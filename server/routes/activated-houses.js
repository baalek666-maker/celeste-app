/**
 * server/routes/activated-houses.js — "Maisons Activées"
 *
 * The old houses endpoint showed 12 static houses with signs — pure data.
 * This new version finds which houses are ACTIVATED today:
 *   - Which natal houses contain the user's natal planets?
 *   - Which houses do today's transiting planets pass through?
 *   - Which house = the area of life being lit up RIGHT NOW?
 *
 * Result: "Saturne transite ta Maison 7 — le ciel te demande de regarder
 * tes partenariats." Instead of "Maison 7 = Balance, 15.3°".
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

const HOUSE_THEMES = {
  1:  { theme: 'identité et corps',          icon: '🪞', short: 'Toi' },
  2:  { theme: 'ressources et valeurs',      icon: '💎', short: 'Valeurs' },
  3:  { theme: 'communication et entourage', icon: '💬', short: 'Entourage' },
  4:  { theme: 'foyer et racines',           icon: '🏠', short: 'Foyer' },
  5:  { theme: 'créativité et plaisir',      icon: '🎨', short: 'Création' },
  6:  { theme: 'travail et santé',           icon: '🌿', short: 'Quotidien' },
  7:  { theme: 'partenariats et amour',      icon: '🤝', short: 'Autrui' },
  8:  { theme: 'transformation et intime',   icon: '🌑', short: 'Profondeur' },
  9:  { theme: 'horizons et sens',           icon: '🏔️', short: 'Sens' },
  10: { theme: 'vocation et carrière',       icon: '👑', short: 'Vocation' },
  11: { theme: 'communauté et rêves',        icon: '🌟', short: 'Tribu' },
  12: { theme: 'retraite et âme',            icon: '🔮', short: 'Intériorité' },
};

// ─── Find which house a longitude falls into ────────────────

function findHouseForLongitude(longitude, houses) {
  for (let i = 0; i < 12; i++) {
    const cusp1 = houses[i].cusp;
    const cusp2 = houses[(i + 1) % 12].cusp;
    if (cusp2 > cusp1) {
      if (longitude >= cusp1 && longitude < cusp2) return i + 1;
    } else {
      // Wraps around 0°
      if (longitude >= cusp1 || longitude < cusp2) return i + 1;
    }
  }
  return 1;
}

// ─── Main router factory ─────────────────────────────────────

export function createActivatedHousesRouter({ db, auth, getNatalPositions, getTransits, callLLMWithRetry }) {
  const router = Router();

  db.exec(`
    CREATE TABLE IF NOT EXISTS activated_houses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      headline TEXT,
      houses_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    )
  `);

  // ─── GET /api/activated-houses ─────────────────────────
  router.get('/', auth, async (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    // Check cache
    const cached = db.prepare('SELECT * FROM activated_houses WHERE user_id = ? AND date = ?').get(userId, today);
    if (cached && cached.headline) {
      const houses = cached.houses_json ? JSON.parse(cached.houses_json) : [];
      return res.json({
        date: cached.date,
        headline: cached.headline,
        houses,
      });
    }

    // Get birth data
    let row = null;
    try { row = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(userId); } catch {}
    if (!row || !row.birth_data) {
      try { row = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId); } catch {}
    }
    if (!row || !row.birth_data) {
      return res.status(400).json({ error: 'Configure tes données de naissance pour voir tes maisons activées.' });
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
      const houses = natal.houses || [];

      if (!houses.length) {
        return res.status(400).json({ error: 'Données de maisons indisponibles.' });
      }

      // For each house, find natal planets in it and transiting planets passing through
      const houseData = {};
      for (let i = 1; i <= 12; i++) {
        houseData[i] = {
          num: i,
          ...HOUSE_THEMES[i],
          sign: houses[i - 1]?.sign || '',
          cusp: houses[i - 1]?.cusp || 0,
          natalPlanets: [],
          transitPlanets: [],
          activated: false,
        };
      }

      // Place natal planets in houses
      for (const p of PLANETS) {
        const lon = natal[p]?.longitude;
        if (lon == null) continue;
        const h = findHouseForLongitude(lon, houses);
        houseData[h].natalPlanets.push({
          key: p,
          name: PLANET_FR[p] || p,
          glyph: PLANET_GLYPHS[p] || '',
          sign: natal[p].sign,
          degree: natal[p].degree,
        });
      }

      // Place transiting planets in houses
      for (const p of PLANETS) {
        const lon = transits[p]?.longitude;
        if (lon == null) continue;
        const h = findHouseForLongitude(lon, houses);
        houseData[h].transitPlanets.push({
          key: p,
          name: PLANET_FR[p] || p,
          glyph: PLANET_GLYPHS[p] || '',
          sign: transits[p].sign,
          degree: transits[p].degree,
          retrograde: transits[p].retrograde || false,
        });
      }

      // Mark activated houses (houses with transit planets)
      const activatedHouses = [];
      for (let i = 1; i <= 12; i++) {
        const hd = houseData[i];
        hd.activated = hd.transitPlanets.length > 0;
        if (hd.activated) {
          activatedHouses.push(hd);
        }
      }

      // Sort by activation intensity (number of transit planets)
      activatedHouses.sort((a, b) => b.transitPlanets.length - a.transitPlanets.length);

      // Take top 3-4 most activated
      const topHouses = activatedHouses.slice(0, 4);

      // Build LLM prompt
      const housesSummary = topHouses.map(h => {
        const transits = h.transitPlanets.map(tp => `${tp.name} en ${tp.sign}${tp.retrograde ? ' (R)' : ''}`).join(', ');
        const natal = h.natalPlanets.length > 0
          ? h.natalPlanets.map(np => `${np.name} en ${np.sign}`).join(', ')
          : 'aucune planète natale';
        return `Maison ${h.num} (${h.theme}): Transits aujourd'hui = ${transits}. Planètes natales = ${natal}`;
      }).join('\n');

      const llmResponse = await callLLMWithRetry([
        {
          role: 'system',
          content: `Tu es Céleste, astrologue bienveillante. Tu parles en français, tutoyant, intime, sans jargon. Tu rends l'astrologie concrète et utile au quotidien.`
        },
        {
          role: 'user',
          content: `Voici les maisons activées aujourd'hui pour cette personne:

${housesSummary}

Génère un JSON:
{
  "headline": "Une phrase qui résume quel domaine de vie est mis en lumière aujourd'hui. Max 120 caractères. Personnel.",
  "houses": [
    Pour CHAQUE maison listée ci-dessus:
    {
      "insight": "Ce que l'activation de cette maison signifie concrètement aujourd'hui. 2 phrases. Relie les planètes en transit au thème de la maison. Style: 'Saturne traverse ta Maison 7 — c'est le moment de...'",
      "action": "Une action concrète à faire aujourd'hui dans ce domaine. 1 phrase qui commence par un verbe."
    }
  ]
}

Règles:
- Pas de jargon astrologique dans insights
- Sois pratique: "range ton bureau", "appelle ta sœur", "pose une limite"
- Réponds UNIQUEMENT avec le JSON`
        }
      ], 3, 1000, { temperature: 0.85 }, 30000);

      const llmText = llmResponse.choices?.[0]?.message?.content || '';
      let parsed;
      try {
        const jsonMatch = llmText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : llmText);
      } catch {
        parsed = {
          headline: 'Certaines zones de ta vie sont mises en lumière aujourd\'hui.',
          houses: topHouses.map(() => ({
            insight: 'Cette zone de vie est activée aujourd\'hui.',
            action: 'Prête attention à ce qui se présente dans ce domaine.',
          })),
        };
      }

      // Merge LLM with computed data
      const llmHouses = Array.isArray(parsed.houses) ? parsed.houses : [];
      const finalHouses = topHouses.map((h, i) => ({
        ...h,
        insight: llmHouses[i]?.insight || `La Maison ${h.num} (${h.theme}) est activée aujourd'hui.`,
        action: llmHouses[i]?.action || 'Reste attentif aux opportunités dans ce domaine.',
      }));

      const result = {
        date: today,
        headline: parsed.headline || 'Le ciel illumine certaines zones de ta vie aujourd\'hui.',
        houses: finalHouses,
      };

      // Save
      const id = `${userId}-${today}`;
      db.prepare(`
        INSERT OR REPLACE INTO activated_houses (id, user_id, date, headline, houses_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, userId, today, result.headline, JSON.stringify(finalHouses));

      return res.json(result);
    } catch (err) {
      console.error('[activated-houses] error:', err.message);
      const result = {
        date: today,
        headline: 'Le ciel a ses propres rythmes. Écoute ce qui émerge.',
        houses: [],
      };
      try {
        const id = `${userId}-${today}`;
        db.prepare(`INSERT OR REPLACE INTO activated_houses (id, user_id, date, headline, houses_json) VALUES (?, ?, ?, ?, ?)`)
          .run(id, userId, today, result.headline, '[]');
      } catch {}
      return res.json(result);
    }
  });

  return router;
}
