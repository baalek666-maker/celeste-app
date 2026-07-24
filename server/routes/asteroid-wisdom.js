/**
 * server/routes/asteroid-wisdom.js — "Tes Blessures & Pouvoirs"
 *
 * Instead of showing 5 asteroid positions as raw data (cold, niche),
 * this reframes them as personal archetypes:
 *
 *   Chiron  → "Ta blessure guérisseuse" — where you're wounded AND where you heal others
 *   Lilith  → "Ton pouvoir refoulé" — raw feminine power, what society told you to hide
 *   Cérès   → "Comment tu nourris" — how you nurture and what you need to feel fed
 *   Pallas  → "Ta stratégie intuitive" — pattern recognition, creative intelligence
 *   Junon   → "Ce que tu attends des liens" — partnership needs, boundary-setting
 *   Vesta   → "Ton feu intérieur" — devotion, where you burn sacred
 *
 * LLM generates intimate interpretation for each, plus a synthesis headline.
 * Cached for life (natal positions never change).
 *
 * Factory: receives shared deps, returns an Express router.
 */
import { Router } from 'express';

// ─── Constants ───────────────────────────────────────────────

const SIGN_GLYPHS = {
  'Bélier': '♈', 'Taureau': '♉', 'Gémeaux': '♊', 'Cancer': '♋',
  'Lion': '♌', 'Vierge': '♍', 'Balance': '♎', 'Scorpion': '♏',
  'Sagittaire': '♐', 'Capricorne': '♑', 'Verseau': '♒', 'Poissons': '♓'
};

// Mean orbital elements at J2000 (simplified Kepler)
const ASTEROIDS = {
  chiron:  { name: 'Chiron',  archetype: 'La blessure guérisseuse',  archetypeShort: 'Blessure', icon: '🩹',
             a: 13.65, e: 0.379, i: 6.93,  node: 209.3, argPeri: 339.8, M0: 92.3,  period: 50.7 },
  ceres:   { name: 'Cérès',   archetype: 'Comment tu nourris',        archetypeShort: 'Nourriture', icon: '🌾',
             a: 2.77,  e: 0.076, i: 10.59, node: 80.41, argPeri: 71.0,  M0: 78.6,  period: 4.60 },
  pallas:  { name: 'Pallas',  archetype: 'Ta stratégie intuitive',    archetypeShort: 'Stratégie', icon: '🦉',
             a: 2.77,  e: 0.231, i: 34.84, node: 173.1, argPeri: 309.9, M0: 134.7, period: 4.61 },
  juno:    { name: 'Junon',   archetype: 'Ce que tu attends des liens', archetypeShort: 'Liens',   icon: '💍',
             a: 2.67,  e: 0.258, i: 12.98, node: 169.9, argPeri: 247.7, M0: 71.2,  period: 4.36 },
  vesta:   { name: 'Vesta',   archetype: 'Ton feu intérieur',         archetypeShort: 'Dévotion',  icon: '🔥',
             a: 2.36,  e: 0.088, i: 7.14,  node: 103.9, argPeri: 149.8, M0: 109.7, period: 3.63 },
};

const SIGNS = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];

// ─── Asteroid position calculation (simplified Kepler) ───────

function asteroidEclipticLon(el, date) {
  const epoch = Date.UTC(2000, 0, 0, 12, 0, 0); // J2000.0
  const days = (date.getTime() - epoch) / 86400000;
  // Mean anomaly
  const n = 360 / (el.period * 365.25);
  let M = el.M0 + n * days;
  M = ((M % 360) + 360) % 360 * Math.PI / 180;
  // Solve Kepler equation: M = E - e * sin(E)
  let E = M;
  for (let iter = 0; iter < 8; iter++) {
    E = E - (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  }
  E = E * 180 / Math.PI;
  // True anomaly
  const v = Math.atan2(Math.sqrt(1 - el.e * el.e) * Math.sin(E * Math.PI / 180), Math.cos(E * Math.PI / 180) - el.e) * 180 / Math.PI;
  // Heliocentric longitude
  let lon = ((el.node + el.argPeri + v) % 360 + 360) % 360;
  return Math.round(lon * 100) / 100;
}

function degToSignInfo(lon) {
  const sign = SIGNS[Math.floor(lon / 30)];
  const deg = Math.round((lon % 30) * 10) / 10;
  return { sign, degree: deg, absDeg: lon };
}

/**
 * v14.7.1.3 — Fallback déterministe PAR archétype (et non plus copier-coller générique).
 * Chaque astéroïde a sa propre grille d'interprétation indexée par signe. Quand le LLM
 * échoue (timeout, rate-limit, JSON cassé), on sert ce texte déterministe — au moins
 * chaque ligne est unique et cohérente avec la position natale calculée.
 *
 * Pour rester honnête intellectuellement, on utilise des descriptions génériques mais
 * qui varient par archétype ET par signe (pas juste un template "tu as une capacité").
 */
const ARCH_FALLBACK = {
  chiron: {
    baseMeaning: (sign) => `Ta blessure guérisseuse se loge en ${sign}. Là où tu as souffert, tu deviens le médecin des autres. C'est un don paradoxal : ta fragilité devient ton expertise la plus fine.`,
    baseGift: (sign) => `Tu peux accompagner ceux qui vivent ce que tu as traversé — sans en faire un métier, mais avec une présence qui désarme.`,
    baseShadow: (sign) => `Le piège : rester dans le rôle du blessé pour ne pas avoir à vivre ta propre guérison. Tant que tu soignes les autres, tu n'as pas à te soigner toi-même.`,
    basePractice: (sign) => `Accepte cette semaine de recevoir au lieu de donner — accepte un soin, un compliment, un service.`,
  },
  ceres: {
    baseMeaning: (sign) => `Cérès en ${sign} raconte comment tu nourris et ce dont tu as besoin pour te sentir nourri·e. Ta manière de prendre soin est ta signature.`,
    baseGift: (sign) => `Tu sais créer un espace où les gens se sentent en sécurité — par ta présence, ta cuisine, ton écoute.`,
    baseShadow: (sign) => `Attention à confondre "prendre soin des autres" et s\u2019oublier soi-même. Le don peut devenir épuisement si tu ne reçois rien en retour.`,
    basePractice: (sign) => `Liste trois choses qui te nourrissent vraiment cette semaine — et fais-en au moins une chaque jour, sans négocier.`,
  },
  pallas: {
    baseMeaning: (sign) => `Pallas en ${sign} révèle ton intelligence stratégique — là où tu vois des patterns que personne d'autre ne voit. C'est ta façon de penser unique.`,
    baseGift: (sign) => `Tu peux résoudre des problèmes que d'autres fuient — par ta capacité à relier des informations que personne ne rapproche.`,
    baseShadow: (sign) => `Le piège : intellectualiser au lieu de ressentir. Quand tu analyses trop, tu perds l'intuition qui fait ta vraie force.`,
    basePractice: (sign) => `Coupe ton esprit 10 minutes par jour (marche, musique, danse) — et vois ce qui remonte quand tu n'analyses plus.`,
  },
  juno: {
    baseMeaning: (sign) => `Junon en ${sign} décrit ce que tu attends des liens profonds — ta vision du partenariat égal et juste.`,
    baseGift: (sign) => `Tu sais créer des relations où chacun a sa place, sans jeu de pouvoir. C'est rare.`,
    baseShadow: (sign) => `Le piège : confondre engagement et perte de soi. T'investir à fond peut t'amener à oublier tes propres besoins.`,
    basePractice: (sign) => `Note ce qui est non-négociable pour toi dans un lien — et ce qui est négociable. Mets les deux listes par écrit.`,
  },
  vesta: {
    baseMeaning: (sign) => `Vesta en ${sign} indique où brûle ton feu sacré — ce à quoi tu es prêt·e à te consacrer entièrement.`,
    baseGift: (sign) => `Quand tu t'engages sur quelque chose qui compte, tu deviens inarrêtable. Ta concentration devient magnétique.`,
    baseShadow: (sign) => `Le piège : te consumer entièrement pour une cause au point de t'oublier. Le feu sacré a besoin d'être protégé pour durer.`,
    basePractice: (sign) => `Identifie une chose que tu as négligée à force de te consacrer à ce qui brûle — et donne-lui 30 minutes aujourd'hui.`,
  },
};

function archFallback(p) {
  const fb = ARCH_FALLBACK[p.key];
  if (!fb) {
    // Astéroïde inconnu (futur ajout) — fallback minimal mais non-copier-coller.
    return {
      title: p.archetype,
      meaning: `${p.name} en ${p.sign} marque une facette de ton chemin intérieur — explore-la.`,
      gift: `Ce que cette position t'enseigne se révèle dans tes relations profondes.`,
      shadow: `Le piège serait de l'ignorer ou d'en faire trop — vise le milieu.`,
      practice: `Prends un moment de silence aujourd'hui et écoute ce que cette part de toi veut te dire.`,
    };
  }
  return {
    title: p.archetype,
    meaning: fb.baseMeaning(p.sign),
    gift: fb.baseGift(p.sign),
    shadow: fb.baseShadow(p.sign),
    practice: fb.basePractice(p.sign),
  };
}

// ─── Main router factory ─────────────────────────────────────

export function createAsteroidWisdomRouter({ db, auth, getNatalPositions, callLLMWithRetry }) {
  const router = Router();

  // Use existing natal_interpretations table for lifetime cache
  // Feature key: 'asteroid_wisdom'

  // ─── GET /api/asteroid-wisdom ──────────────────────────
  router.get('/', auth, async (req, res) => {
    const userId = req.user.id;

    // Check lifetime cache
    const cached = db.prepare('SELECT data FROM natal_interpretations WHERE user_id = ? AND feature = ?').get(userId, 'asteroid_wisdom');
    if (cached) {
      return res.json({ ...JSON.parse(cached.data), cached: true });
    }

    // Get birth data
    let row = null;
    try { row = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(userId); } catch {}
    if (!row || !row.birth_data) {
      try { row = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId); } catch {}
    }
    if (!row || !row.birth_data) {
      return res.status(400).json({ error: 'Configure tes données de naissance.' });
    }

    let birthData;
    try {
      birthData = typeof row.birth_data === 'string' ? JSON.parse(row.birth_data) : row.birth_data;
    } catch {
      return res.status(400).json({ error: 'Données de naissance invalides.' });
    }

    try {
      // Compute asteroid positions
      const [y, m, d] = birthData.date.split('-').map(Number);
      const [h, min] = (birthData.time || '12:00').split(':').map(Number);
      const birthDate = new Date(Date.UTC(y, m - 1, d, h, min, 0));

      const positions = Object.entries(ASTEROIDS).map(([key, el]) => {
        const lon = asteroidEclipticLon(el, birthDate);
        const info = degToSignInfo(lon);
        return {
          key,
          name: el.name,
          archetype: el.archetype,
          archetypeShort: el.archetypeShort,
          icon: el.icon,
          sign: info.sign,
          degree: info.degree,
          absDeg: info.absDeg,
          glyph: SIGN_GLYPHS[info.sign] || '·',
        };
      });

      // Get natal sun sign for context
      const natal = getNatalPositions(birthData);
      const sunSign = natal.sun?.sign || 'inconnu';
      const moonSign = natal.moon?.sign || 'inconnu';

      // Build LLM prompt
      const summary = positions.map(p => `${p.name} (${p.archetype}) en ${p.sign} (${p.degree}°)`).join('; ');

      const llmResponse = await callLLMWithRetry([
        {
          role: 'system',
          content: `Tu es Céleste, une guide intime et profonde. Tu parles en français, à la deuxième personne (tu). Tu rends les archétypes astrologiques concrets, émotionnels, vivants — jamais académiques. Tu parles de blessures avec tendresse et de pouvoirs avec respect.`
        },
        {
          role: 'user',
          content: `Profil: Soleil ${sunSign}, Lune ${moonSign}.

Voici les positions d'astéroïdes natals:
${summary}

Génère un JSON:
{
  "headline": "Une phrase qui relie ces archétypes au chemin de vie de la personne. Max 120 caractères. Évite le jargon.",
  "archetypes": [
    Pour CHAQUE astéroïde:
    {
      "title": "Un titre court et personnel. Format: 'Ton [archétype]'. Ex: 'Ta blessure guérisseuse'",
      "meaning": "Ce que cette position révèle. 2-3 phrases. Sois intime, pas clinique. Relie le signe à l'archétype: 'Chiron en Scorpion — ta blessure se trouve là où tu as cru devoir cacher ton pouvoir.'",
      "gift": "Le don caché dans cette position. 1 phrase. Ce que la personne peut offrir au monde grâce à ça.",
      "shadow": "Le piège à éviter. 1 phrase. Comment ça peut se retourner contre elle.",
      "practice": "Une pratique concrète pour intégrer ça. 1 phrase qui commence par un verbe."
    }
  ]
}

Règles:
- Pas de jargon: ne dis pas 'Chiron en Scorpion', dis 'Ta blessure guérisseuse est dans le signe du Scorpion'
- Sois direct, doux, comme une amie sage
- gift/shadow/practice: court, percutant
- Réponds UNIQUEMENT avec le JSON`
        }
      ], 3, 4000, { temperature: 0.9, reasoning_effort: 'low' }, 90000);

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
        // v14.7.1.3 — Fallback déterministe par archétype (jamais de copier-coller générique).
        // Chaque astéroïde a son propre texte selon le signe qu'il occupe. Ça reste pauvre vs LLM
        // mais au moins chaque ligne est unique et actionnable, pas une phrase identique.
        parsed = {
          headline: 'Tes archétypes intérieurs dessinent un chemin unique.',
          archetypes: positions.map(p => archFallback(p)),
        };
      }

      // Merge LLM with computed positions
      const llmArchetypes = Array.isArray(parsed.archetypes) ? parsed.archetypes : [];
      const finalArchetypes = positions.map((p, i) => ({
        ...p,
        ...((llmArchetypes[i] || {})),
      }));

      // v14.7.1.3 — Apostrophe typographique française (\u2019) au lieu de concat bizarre.
      const result = {
        headline: parsed.headline || 'Tes archétypes intérieurs t\u2019attendent.',
        archetypes: finalArchetypes,
        generatedAt: new Date().toISOString(),
      };

      // Save to lifetime cache
      db.prepare('INSERT OR REPLACE INTO natal_interpretations (user_id, feature, data) VALUES (?, ?, ?)')
        .run(userId, 'asteroid_wisdom', JSON.stringify(result));

      return res.json(result);
    } catch (err) {
      console.error('[asteroid-wisdom] error:', err.message);
      return res.status(500).json({ error: 'Impossible de générer tes archétypes pour le moment.' });
    }
  });

  return router;
}
