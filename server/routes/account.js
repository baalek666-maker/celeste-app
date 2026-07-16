/**
 * server/routes/account.js — Account management (GDPR export + delete)
 *
 * Factory: receives shared deps, returns an Express router.
 * Extracted from server.js Phase 2A.
 */
import { Router } from 'express';

export function createAccountRouter({ db, auth }) {
  const router = Router();

  router.get('/export', auth, (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

    try {
      const user = db.prepare('SELECT id, email, created_at, is_premium, premium_until, streak_count, notification_hour FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(404).json({ error: 'Compte introuvable.' });

      const data = {
        exportedAt: new Date().toISOString(),
        user,
        profiles: [],
        journalEntries: [],
        horoscopeFavorites: [],
        pushSubscriptions: [],
        dailyRituals: [],
        onboardingProgress: null,
      };

      const collect = (table, where = 'user_id') => {
        try {
          return db.prepare(`SELECT * FROM ${table} WHERE ${where} = ?`).all(userId);
        } catch { return []; }
      };

      data.profiles = collect('profiles');
      data.journalEntries = collect('journal_entries');
      data.horoscopeFavorites = collect('horoscope_favorites');
      data.pushSubscriptions = collect('push_subscriptions');
      data.dailyRituals = collect('daily_rituals');
      try {
        data.onboardingProgress = db.prepare('SELECT * FROM onboarding_progress WHERE user_id = ?').get(userId) || null;
      } catch { /* table may not exist */ }

      res.setHeader('Content-Disposition', `attachment; filename="celeste-data-${userId}-${Date.now()}.json"`);
      res.json(data);
    } catch (err) {
      console.error('[gdpr-export] error:', err.message);
      res.status(500).json({ error: 'Export impossible.' });
    }
  });

  router.delete('/', auth, (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

    try {
      const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
      if (!exists) return res.status(401).json({ error: 'Compte introuvable. Reconnecte-toi.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur vérification compte.' });
    }

    try {
      const tx = db.transaction(() => {
        const tables = [
          'profiles',
          'push_subscriptions',
          'daily_rituals',
          'onboarding_progress',
          'horoscope_favorites',
          'journal_entries',
          'user_xp',
          'daily_quests',
          'user_badges',
          'xp_log',
          'astro_portraits',
          'horoscope_feedback',
        ];
        for (const t of tables) {
          try {
            db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
          } catch (err) {
            console.warn(`[delete-account] table ${t} skip:`, err.message);
          }
        }
        try { db.prepare('DELETE FROM stripe_events WHERE type LIKE ?').run(`%${userId}%`); }
        catch (err) { console.warn('[delete-account] stripe_events skip:', err.message); }
        for (const gt of ['gamification_achievements', 'gamification_streaks', 'gamification_xp']) {
          try { db.prepare(`DELETE FROM ${gt} WHERE user_id = ?`).run(userId); }
          catch { /* table inexistante — OK */ }
        }
        const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        if (result.changes === 0) {
          throw new Error('Compte introuvable.');
        }
        return result.changes;
      });
      const deleted = tx();
      console.log(`[delete-account] ✅ Compte user ${userId} supprimé (${deleted} row)`);
      return res.json({ ok: true, deletedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[delete-account] ❌', err.message);
      return res.status(500).json({ error: 'Suppression impossible. Réessaie ou contacte le support.' });
    }
  });

  return router;
}
