/**
 * server/routes/journal.js — Journal endpoints
 *
 * Factory: receives shared deps, returns an Express router.
 * Extracted from server.js Phase 2A.
 */
import { Router } from 'express';

export function createJournalRouter({ db, auth }) {
  const router = Router();

  router.get('/', auth, (req, res) => {
    const entries = db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC LIMIT 90').all(req.user.id);
    res.json(entries.map(e => ({
      id: e.id, date: e.date, horoscopeSummary: e.horoscope_summary,
      userNote: e.user_note, userRating: e.user_rating,
    })));
  });

  router.post('/', auth, (req, res) => {
    const { date, horoscopeSummary, userNote, userRating } = req.body;
    const id = `${req.user.id}-${date}`;
    db.prepare(`INSERT OR REPLACE INTO journal_entries (id, user_id, date, horoscope_summary, user_note, user_rating)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, req.user.id, date, horoscopeSummary, userNote, userRating || 0);
    res.json({ ok: true });
  });

  return router;
}
