/**
 * server/routes/daily-energy.js — Personalized daily astro-energy + reflection prompt
 *
 * The core idea: instead of showing generic astrological info, we compute which
 * natal planets are most activated by today's transits, then ask the LLM to
 * produce a short, personal, actionable "energy forecast" + a reflection question.
 *
 * Cached per user per day (same content all day, refreshed at midnight).
 * Reflection is saved to the DB and can be reviewed in the journal.
 *
 * Factory: receives shared deps, returns an Express router.
 */
import { Router } from 'express';

// ─── Helpers ─────────────────────────────────────────────────

const ENERGY_LEVELS = [
  { max: 2, label: 'repos', emoji: '🌙', advice: 'Préserve ton énergie, ralentis' },
  { max: 4, label: 'flow',   emoji: '🌫️', advice: 'Avance en douceur, reste attentif' },
  { max: 6, label: 'élan',   emoji: '✨', advice: 'Bonne dynamique, agis avec confiance' },
  { max: 8, label: 'feu',    emoji: '🔥', advice: 'Haute énergie, saisis les opportunités' },
  { max: 10,label: 'pic',    emoji: '⚡', advice: 'Pic d\'énergie, fonce !' },
];

function getEnergyLevel(score) {
  return ENERGY_LEVELS.find(e => score <= e.max) || ENERGY_LEVELS[0];
}

// Compute which natal planets are most "activated" by today's transits
function computeActivations(natal, transits) {
  const activations = [];
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn'];

  for (const np of planets) {
    const natalLon = natal[np]?.longitude;
    if (natalLon == null) continue;
    for (const tp of planets) {
      const transitLon = transits[tp]?.longitude;
      if (transitLon == null) continue;
      const diff = Math.abs(natalLon - transitLon);
      const d = Math.min(diff, 360 - diff);
      // Major aspects with tight orbs = strong activation
      for (const [angle, weight] of [[0, 3], [60, 1], [90, 2], [120, 2], [180, 2.5]]) {
        if (Math.abs(d - angle) <= 3) {
          activations.push({
            natalPlanet: np,
            transitPlanet: tp,
            aspect: angle,
            weight,
            orb: Math.round(Math.abs(d - angle) * 10) / 10,
          });
        }
      }
    }
  }
  activations.sort((a, b) => b.weight - a.weight);
  return activations.slice(0, 5); // top 5 most activated
}

function formatActivationsForLLM(activations) {
  const aspectNames = { 0: 'conjunct', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opposition' };
  return activations.map(a =>
    `Transiting ${a.transitPlanet} ${aspectNames[a.aspect]} natal ${a.natalPlanet} (orb ${a.orb}°, weight ${a.weight})`
  ).join('\n');
}

// ─── Main endpoint factory ───────────────────────────────────

export function createDailyEnergyRouter({ db, auth, getNatalPositions, getTransits, callLLMWithRetry }) {
  const router = Router();

  // Ensure table exists (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_energy (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      headline TEXT,
      energy_score INTEGER DEFAULT 5,
      energy_label TEXT,
      energy_emoji TEXT,
      energy_advice TEXT,
      good_for TEXT,
      avoid TEXT,
      reflection_prompt TEXT,
      reflection_text TEXT,
      activations_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    )
  `);

  // ─── GET /api/daily-energy ──────────────────────────────
  router.get('/', auth, async (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    // Check cache first
    const cached = db.prepare('SELECT * FROM daily_energy WHERE user_id = ? AND date = ?').get(userId, today);
    if (cached && cached.headline) {
      return res.json({
        date: cached.date,
        headline: cached.headline,
        energy: {
          score: cached.energy_score,
          label: cached.energy_label,
          emoji: cached.energy_emoji,
          advice: cached.energy_advice,
        },
        goodFor: cached.good_for ? JSON.parse(cached.good_for) : [],
        avoid: cached.avoid ? JSON.parse(cached.avoid) : [],
        reflectionPrompt: cached.reflection_prompt,
        reflectionText: cached.reflection_text || '',
      });
    }

    // Need to generate. Get user's birth data.
    let row = null;
    try { row = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(userId); } catch {}
    if (!row || !row.birth_data) {
      try { row = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId); } catch {}
    }
    if (!row || !row.birth_data) {
      return res.status(400).json({ error: 'Configure d\'abord tes données de naissance pour recevoir ton énergie du jour.' });
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
      const activations = computeActivations(natal, transits);

      if (activations.length === 0) {
        // Quiet day — no major aspects. Return a calm default.
        const energy = getEnergyLevel(4);
        const result = {
          headline: 'Une journée calme cosmiquement. Le ciel ne t\'envoie pas de défi particulier aujourd\'hui.',
          energy: { score: 4, ...energy },
          goodFor: ['repos', 'introspection', 'tâches routinières'],
          avoid: ['grandes décisions précipitées'],
          reflectionPrompt: 'Qu\'est-ce qui te donne de la joie quand rien ne t\'oblige à rien ?',
        };
        saveDailyEnergy(db, userId, today, result, []);
        return res.json(result);
      }

      // Calculate energy score: sum of activation weights (capped at 10)
      const energyScore = Math.min(10, Math.round(activations.reduce((s, a) => s + a.weight, 0)));
      const energy = getEnergyLevel(energyScore);

      // Build LLM prompt
      const sunSign = natal.sun?.sign || 'inconnu';
      const moonSign = natal.moon?.sign || 'inconnu';
      const risingSign = natal.ascendant?.sign || 'inconnu';
      const activationsText = formatActivationsForLLM(activations);

      const llmResponse = await callLLMWithRetry([
        {
          role: 'system',
          content: `Tu es Céleste, une astrologue bienveillante et directe. Tu parles toujours en français, à la deuxième personne (tu), avec chaleur et sans jargon. Tu rends l'astrologie concrète, utile, émotionnellement vraie — jamais scolaire.`
        },
        {
          role: 'user',
          content: `Voici le profil natal:
- Soleil: ${sunSign}
- Lune: ${moonSign}
- Ascendant: ${risingSign}

Voici les activations majeures du jour (transits sur le thème natal):
${activationsText}

Niveau d'énergie cosmique du jour: ${energyScore}/10 (${energy.label})

Génère une réponse JSON valide avec ce format exact:
{
  "headline": "Une phrase percutante qui résume l'énergie du jour pour CETTE personne (max 120 caractères, personnelle, pas générique)",
  "goodFor": ["2-3 activités concrètes favorables aujourd'hui, liées aux transits"],
  "avoid": ["1-2 choses à éviter, liées aux transits"],
  "reflectionPrompt": "Une question personnelle et profonde, basée sur les transits actuels, qui invite à l'introspection (max 150 caractères)"
}

Règles:
- headline doit mentionner UNE spécificité du jour (pas "belle journée")
- goodFor et avoid doivent être concrets (pas "méditer" mais "écrire 3 pages avant midi")
- reflectionPrompt doit relier un transit à un aspect de la vie de la personne
- Réponds UNIQUEMENT avec le JSON, pas d'autres textes`
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
        parsed = {
          headline: 'Le ciel bouge pour toi aujourd\'hui. Écoute ce qui se présente.',
          goodFor: ['introspection', 'écriture', 'marcher en nature'],
          avoid: ['confrontations directes'],
          reflectionPrompt: 'Quelle partie de toi demande à être écoutée aujourd\'hui ?',
        };
      }

      const result = {
        date: today,
        headline: parsed.headline,
        energy: { score: energyScore, label: energy.label, emoji: energy.emoji, advice: energy.advice },
        goodFor: Array.isArray(parsed.goodFor) ? parsed.goodFor.slice(0, 4) : [],
        avoid: Array.isArray(parsed.avoid) ? parsed.avoid.slice(0, 3) : [],
        reflectionPrompt: parsed.reflectionPrompt || 'Qu\'est-ce qui est vivant en toi aujourd\'hui ?',
      };

      saveDailyEnergy(db, userId, today, result, activations);
      return res.json(result);
    } catch (err) {
      console.error('[daily-energy] error:', err.message);
      // Fallback — don't leave user without content
      const energy = getEnergyLevel(5);
      const result = {
        date: today,
        headline: 'Le ciel t\'accompagne aujourd\'hui, même dans le silence.',
        energy: { score: 5, ...energy },
        goodFor: ['être présent', 'écouter ton intuition'],
        avoid: ['te forcer'],
        reflectionPrompt: 'De quoi as-tu vraiment besoin aujourd\'hui ?',
      };
      try { saveDailyEnergy(db, userId, today, result, []); } catch {}
      return res.json(result);
    }
  });

  // ─── POST /api/daily-energy/reflection ──────────────────
  router.post('/reflection', auth, (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const { reflectionText } = req.body || {};

    if (!reflectionText || typeof reflectionText !== 'string') {
      return res.status(400).json({ error: 'reflectionText requis' });
    }
    if (reflectionText.length > 5000) {
      return res.status(400).json({ error: 'Texte trop long (max 5000 caractères)' });
    }

    try {
      const existing = db.prepare('SELECT id FROM daily_energy WHERE user_id = ? AND date = ?').get(userId, today);
      if (existing) {
        db.prepare('UPDATE daily_energy SET reflection_text = ? WHERE id = ?')
          .run(reflectionText.slice(0, 5000), existing.id);
      } else {
        // Create entry with just the reflection (energy will be generated on next GET)
        const id = `${userId}-${today}`;
        db.prepare(`INSERT OR REPLACE INTO daily_energy (id, user_id, date, reflection_text) VALUES (?, ?, ?, ?)`)
          .run(id, userId, today, reflectionText.slice(0, 5000));
      }

      // Also save to journal for continuity
      const journalId = `${userId}-${today}`;
      try {
        db.prepare(`INSERT OR REPLACE INTO journal_entries (id, user_id, date, horoscope_summary, user_note)
          VALUES (?, ?, ?, ?, ?)`)
          .run(journalId, userId, today, null, reflectionText.slice(0, 5000));
      } catch (e) {
        console.warn('[daily-energy] journal sync failed:', e.message);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[daily-energy] reflection save error:', err.message);
      return res.status(500).json({ error: 'Sauvegarde impossible' });
    }
  });

  // ─── GET /api/daily-energy/history ──────────────────────
  router.get('/history', auth, (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 30, 90);
    try {
      const rows = db.prepare(`
        SELECT date, headline, energy_score, energy_label, energy_emoji,
               reflection_prompt, reflection_text
        FROM daily_energy
        WHERE user_id = ?
        ORDER BY date DESC
        LIMIT ?
      `).all(userId, limit);
      return res.json({ entries: rows });
    } catch (err) {
      console.error('[daily-energy] history error:', err.message);
      return res.json({ entries: [] });
    }
  });

  return router;
}

// ─── DB save helper ──────────────────────────────────────────
function saveDailyEnergy(db, userId, date, data, activations) {
  const id = `${userId}-${date}`;
  db.prepare(`
    INSERT OR REPLACE INTO daily_energy
      (id, user_id, date, headline, energy_score, energy_label, energy_emoji,
       energy_advice, good_for, avoid, reflection_prompt, activations_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, date,
    data.headline,
    data.energy.score,
    data.energy.label,
    data.energy.emoji,
    data.energy.advice,
    JSON.stringify(data.goodFor),
    JSON.stringify(data.avoid),
    data.reflectionPrompt,
    JSON.stringify(activations),
  );
}
