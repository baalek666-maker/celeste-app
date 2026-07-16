/**
 * server/routes/notifications.js — Web Push notification endpoints
 *
 * Factory: receives shared deps, returns an Express router.
 * Extracted from server.js Phase 2A.
 */
import { Router } from 'express';

export function createNotificationsRouter({ db, auth, webpush, vapidPublicKey }) {
  const router = Router();

  // Public — frontend needs the public key to subscribe
  router.get('/vapid-key', (req, res) => {
    if (!vapidPublicKey) return res.status(503).json({ error: 'Push not configured' });
    res.json({ publicKey: vapidPublicKey });
  });

  router.get('/status', auth, (req, res) => {
    const u = db.prepare('SELECT notification_hour, last_notification_date FROM users WHERE id = ?').get(req.user.id);
    const subs = db.prepare('SELECT COUNT(*) as n FROM push_subscriptions WHERE user_id = ?').get(req.user.id);
    res.json({
      enabled: subs.n > 0,
      subscriptionCount: subs.n,
      hour: u?.notification_hour ?? 9,
      lastSent: u?.last_notification_date || null,
    });
  });

  router.post('/subscribe', auth, async (req, res) => {
    if (!vapidPublicKey) return res.status(503).json({ error: 'Push not configured' });
    const { subscription, hour, timezone } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    try {
      db.prepare(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, user_agent = excluded.user_agent
      `).run(req.user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, req.headers['user-agent'] || '');
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
        const tz = (typeof timezone === 'number' && timezone >= -12 && timezone <= 14) ? timezone : 0;
        db.prepare('UPDATE users SET notification_hour = ?, notification_timezone = ? WHERE id = ?').run(hour, tz, req.user.id);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('subscribe error:', err.message);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });

  router.delete('/unsubscribe', auth, (req, res) => {
    const { endpoint } = req.body || {};
    if (endpoint) {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(req.user.id, endpoint);
    } else {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(req.user.id);
    }
    res.json({ ok: true });
  });

  router.patch('/preferences', auth, (req, res) => {
    const { hour } = req.body || {};
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'hour must be 0-23' });
    }
    db.prepare('UPDATE users SET notification_hour = ? WHERE id = ?').run(hour, req.user.id);
    res.json({ ok: true });
  });

  router.post('/test', auth, async (req, res) => {
    if (!vapidPublicKey) return res.status(503).json({ error: 'Push not configured' });
    const subs = db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(req.user.id);
    if (subs.length === 0) return res.status(404).json({ error: 'No active subscription' });
    const payload = JSON.stringify({
      title: '✨ Céleste — test',
      body: 'Si tu lis ceci, les notifications marchent. 🌙',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      url: '/',
    });
    const results = await Promise.allSettled(subs.map(s => webpush.sendNotification({
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    }, payload)));
    const sent = results.filter(r => r.status === 'fulfilled').length;
    results.forEach((r, i) => {
      if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subs[i].endpoint);
      }
    });
    res.json({ sent, total: subs.length });
  });

  return router;
}
