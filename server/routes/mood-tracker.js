/**
 * server/routes/mood-tracker.js — Daily mood check-in + astro correlation
 *
 * User logs mood/energy (emoji + scale 1-5).
 * Backend correlates with astro events over time.
 * Creates a feedback loop: "Tu te sens mieux les jours de transit Feu".
 *
 * Factory pattern: receives shared deps, returns Express Router.
 */
import { Router } from 'express';

export function createMoodTrackerRouter({ db, auth, getNatalPositions, getTransits }) {
  const router = Router();

  // Ensure table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mood_checkins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      mood_emoji TEXT NOT NULL,
      mood_score INTEGER NOT NULL,
      energy_score INTEGER NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date)
    )
  `);

  // ─── POST /api/mood/checkin ─────────────────────────────
  router.post('/checkin', auth, (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const { moodEmoji, moodScore, energyScore, note } = req.body || {};

    // Validate
    const validEmojis = ['😔', '😕', '😐', '🙂', '😄'];
    if (!validEmojis.includes(moodEmoji)) {
      return res.status(400).json({ error: 'Emoji invalide' });
    }
    if (![1, 2, 3, 4, 5].includes(moodScore)) {
      return res.status(400).json({ error: 'moodScore doit être entre 1 et 5' });
    }
    if (![1, 2, 3, 4, 5].includes(energyScore)) {
      return res.status(400).json({ error: 'energyScore doit être entre 1 et 5' });
    }

    const noteStr = note ? String(note).slice(0, 500) : null;

    try {
      const id = `${userId}-${today}`;
      db.prepare(`
        INSERT OR REPLACE INTO mood_checkins
          (id, user_id, date, mood_emoji, mood_score, energy_score, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, today, moodEmoji, moodScore, energyScore, noteStr);

      return res.json({ ok: true, date: today, moodEmoji, moodScore, energyScore });
    } catch (err) {
      console.error('[mood] checkin error:', err.message);
      return res.status(500).json({ error: 'Sauvegarde impossible' });
    }
  });

  // ─── GET /api/mood/today ────────────────────────────────
  router.get('/today', auth, (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const row = db.prepare('SELECT * FROM mood_checkins WHERE user_id = ? AND date = ?').get(userId, today);
      if (!row) return res.json({ checkedIn: false });
      return res.json({
        checkedIn: true,
        moodEmoji: row.mood_emoji,
        moodScore: row.mood_score,
        energyScore: row.energy_score,
        note: row.note,
      });
    } catch {
      return res.json({ checkedIn: false });
    }
  });

  // ─── GET /api/mood/stats ────────────────────────────────
  // Returns last 30 days of mood data + correlation insights
  router.get('/stats', auth, async (req, res) => {
    const userId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    try {
      const rows = db.prepare(`
        SELECT date, mood_emoji, mood_score, energy_score, note
        FROM mood_checkins
        WHERE user_id = ?
        ORDER BY date DESC
        LIMIT ?
      `).all(userId, days);

      if (rows.length === 0) {
        return res.json({ totalCheckins: 0, insights: null });
      }

      // Compute basic stats
      const avgMood = rows.reduce((s, r) => s + r.mood_score, 0) / rows.length;
      const avgEnergy = rows.reduce((s, r) => s + r.energy_score, 0) / rows.length;

      // Compute correlation with transits (if we have birth data)
      let correlations = null;
      let bRow = null;
      try { bRow = db.prepare('SELECT birth_data FROM profiles WHERE user_id = ? AND is_self = 1').get(userId); } catch {}
      if (!bRow || !bRow.birth_data) {
        try { bRow = db.prepare('SELECT birth_data FROM users WHERE id = ?').get(userId); } catch {}
      }
      if (bRow?.birth_data && rows.length >= 5) {
        try {
          const birthData = typeof bRow.birth_data === 'string' ? JSON.parse(bRow.birth_data) : bRow.birth_data;
          const natal = getNatalPositions(birthData, true);
          const elementMood = { Fire: [], Earth: [], Air: [], Water: [] };

          for (const row of rows) {
            try {
              const transits = getTransits(new Date(row.date));
              // Score the day's dominant element energy from transits
              const ELEMENTS = {
                Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
                Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
                Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
                Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
              };
              const planetKeys = ['sun','moon','mercury','venus','mars'];
              const dayElements = planetKeys.map(p => ELEMENTS[transits[p]?.sign] || 'Earth');
              const dominantEl = dayElements.sort((a, b) =>
                dayElements.filter(v => v === b).length - dayElements.filter(v => v === a).length
              )[0];
              elementMood[dominantEl].push(row.mood_score);
            } catch {}
          }

          // Build insights — only if we have meaningful data
          const insights = [];
          for (const [el, scores] of Object.entries(elementMood)) {
            if (scores.length >= 2) {
              const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
              insights.push({ element: el, avgMood: Math.round(avg * 10) / 10, samples: scores.length });
            }
          }
          insights.sort((a, b) => b.avgMood - a.avgMood);

          if (insights.length >= 2) {
            const best = insights[0];
            const worst = insights[insights.length - 1];
            if (best.avgMood - worst.avgMood >= 0.5) {
              correlations = {
                type: 'element',
                bestElement: best.element,
                bestAvgMood: best.avgMood,
                worstElement: worst.element,
                worstAvgMood: worst.avgMood,
                insight: `Tu te sens en moyenne ${best.avgMood.toFixed(1)}/5 les jours dominés par l'élément ${elementFr(best.element)}, contre ${worst.avgMood.toFixed(1)}/5 pour ${elementFr(worst.element)}.`,
              };
            }
          }
        } catch (e) {
          console.warn('[mood] correlation failed:', e.message);
        }
      }

      return res.json({
        totalCheckins: rows.length,
        avgMood: Math.round(avgMood * 10) / 10,
        avgEnergy: Math.round(avgEnergy * 10) / 10,
        checkins: rows.slice(0, 30).reverse(),
        insights: correlations,
      });
    } catch (err) {
      console.error('[mood] stats error:', err.message);
      return res.json({ totalCheckins: 0, insights: null });
    }
  });

  return router;
}

const ELEMENT_FR = { Fire: 'Feu', Earth: 'Terre', Air: 'Air', Water: 'Eau' };
function elementFr(el) { return ELEMENT_FR[el] || el; }
