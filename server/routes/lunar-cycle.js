/**
 * server/routes/lunar-cycle.js — Lunar cycle intentions & release
 *
 * New Moon → user writes 1-3 intentions (what they want to manifest)
 * Full Moon → user reviews what came true, releases what didn't
 *
 * Creates a natural 2-week rhythm that keeps users engaged.
 *
 * Factory: receives shared deps, returns an Express router.
 */
import { Router } from 'express';

export function createLunarCycleRouter({ db, auth, moonPhaseForDate }) {
  const router = Router();

  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS lunar_intentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      cycle_date TEXT NOT NULL,
      phase TEXT NOT NULL,
      intention_text TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      reflection_text TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT
    )
  `);

  // ─── GET /api/lunar-cycle/status ───────────────────────
  // Returns current moon phase + user's intentions for this cycle
  router.get('/status', auth, (req, res) => {
    try {
      const userId = req.user.id;
      const moon = moonPhaseForDate(new Date());

      // Find the start of the current lunar cycle (last new moon approximation)
      // We use the moon age to compute backwards
      const cycleStart = new Date();
      cycleStart.setDate(cycleStart.getDate() - Math.floor(moon.age));
      const cycleDate = cycleStart.toISOString().slice(0, 10);

      // Get intentions set during this cycle
      const intentions = db.prepare(`
        SELECT * FROM lunar_intentions
        WHERE user_id = ? AND cycle_date >= ?
        ORDER BY created_at DESC
      `).all(userId, cycleDate);

      // Determine phase window
      const isNewMoonWindow = moon.name === 'Nouvelle Lune' || (moon.age < 3.5);
      const isFullMoonWindow = moon.name === 'Pleine Lune' || (moon.age >= 13 && moon.age <= 17);
      const isWaning = moon.age > 17;

      return res.json({
        moonPhase: moon,
        cycleDate,
        intentions: intentions.map(rowToResponse),
        isNewMoonWindow,
        isFullMoonWindow,
        isWaning,
        canSetIntention: isNewMoonWindow,
        canReview: isFullMoonWindow || isWaning,
      });
    } catch (err) {
      console.error('[lunar-cycle] status error:', err.message);
      return res.status(500).json({ error: 'Erreur lors de la récupération du cycle lunaire' });
    }
  });

  // ─── POST /api/lunar-cycle/intention ───────────────────
  router.post('/intention', auth, (req, res) => {
    const userId = req.user.id;
    const { intentionText } = req.body || {};

    if (!intentionText || typeof intentionText !== 'string' || !intentionText.trim()) {
      return res.status(400).json({ error: 'Intention requise' });
    }
    if (intentionText.length > 500) {
      return res.status(400).json({ error: 'Intention trop longue (max 500 caractères)' });
    }

    try {
      const moon = moonPhaseForDate(new Date());
      const cycleStart = new Date();
      cycleStart.setDate(cycleStart.getDate() - Math.floor(moon.age));
      const cycleDate = cycleStart.toISOString().slice(0, 10);

      // Limit: max 3 intentions per cycle
      const existing = db.prepare(`
        SELECT COUNT(*) as count FROM lunar_intentions
        WHERE user_id = ? AND cycle_date = ? AND status = 'active'
      `).get(userId, cycleDate);

      if (existing?.count >= 3) {
        return res.status(400).json({ error: 'Maximum 3 intentions par cycle lunaire' });
      }

      const result = db.prepare(`
        INSERT INTO lunar_intentions (user_id, cycle_date, phase, intention_text)
        VALUES (?, ?, ?, ?)
      `).run(userId, cycleDate, moon.name, intentionText.trim().slice(0, 500));

      const row = db.prepare('SELECT * FROM lunar_intentions WHERE id = ?').get(result.lastInsertRowid);
      return res.json(rowToResponse(row));
    } catch (err) {
      console.error('[lunar-cycle] intention save error:', err.message);
      return res.status(500).json({ error: 'Sauvegarde impossible' });
    }
  });

  // ─── POST /api/lunar-cycle/intention/:id/review ─────────
  router.post('/intention/:id/review', auth, (req, res) => {
    const userId = req.user.id;
    const intentionId = parseInt(req.params.id);
    const { status, reflectionText } = req.body || {};

    if (!['manifested', 'released', 'active'].includes(status)) {
      return res.status(400).json({ error: 'Status doit être: manifested, released, ou active' });
    }

    try {
      const intention = db.prepare('SELECT * FROM lunar_intentions WHERE id = ? AND user_id = ?').get(intentionId, userId);
      if (!intention) {
        return res.status(404).json({ error: 'Intention introuvable' });
      }

      db.prepare(`
        UPDATE lunar_intentions
        SET status = ?, reflection_text = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `).run(
        status,
        reflectionText ? String(reflectionText).slice(0, 1000) : null,
        intentionId,
      );

      const updated = db.prepare('SELECT * FROM lunar_intentions WHERE id = ?').get(intentionId);
      return res.json(rowToResponse(updated));
    } catch (err) {
      console.error('[lunar-cycle] review error:', err.message);
      return res.status(500).json({ error: 'Mise à jour impossible' });
    }
  });

  // ─── DELETE /api/lunar-cycle/intention/:id ──────────────
  router.delete('/intention/:id', auth, (req, res) => {
    const userId = req.user.id;
    const intentionId = parseInt(req.params.id);
    try {
      const result = db.prepare('DELETE FROM lunar_intentions WHERE id = ? AND user_id = ?').run(intentionId, userId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Intention introuvable' });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('[lunar-cycle] delete error:', err.message);
      return res.status(500).json({ error: 'Suppression impossible' });
    }
  });

  // ─── GET /api/lunar-cycle/history ──────────────────────
  router.get('/history', auth, (req, res) => {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 12, 52);
    try {
      const rows = db.prepare(`
        SELECT * FROM lunar_intentions
        WHERE user_id = ?
        ORDER BY cycle_date DESC, created_at DESC
        LIMIT ?
      `).all(userId, limit);
      return res.json({ intentions: rows.map(rowToResponse) });
    } catch (err) {
      console.error('[lunar-cycle] history error:', err.message);
      return res.json({ intentions: [] });
    }
  });

  return router;
}

// ─── Helpers ─────────────────────────────────────────────────
function rowToResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    cycleDate: row.cycle_date,
    phase: row.phase,
    intentionText: row.intention_text,
    status: row.status,
    reflectionText: row.reflection_text || null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || null,
  };
}
