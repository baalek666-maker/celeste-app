/**
 * server/routes/profiles.js — Multi-profile CRUD
 *
 * Factory: receives shared deps, returns an Express router.
 * Extracted from server.js Phase 2A.
 */
import { Router } from 'express';

export function createProfilesRouter({ db, auth, safeJsonParse }) {
  const router = Router();

  // List all profiles (own natal + saved family/friends)
  router.get('/', auth, (req, res) => {
    const rows = db.prepare(
      'SELECT id, name, relation, birth_data, is_self, created_at FROM profiles WHERE user_id = ? ORDER BY is_self DESC, created_at ASC'
    ).all(req.user.id);
    res.json({
      profiles: rows.map(r => ({
        id: r.id,
        name: r.name,
        relation: r.relation,
        isSelf: !!r.is_self,
        birthData: safeJsonParse(r.birth_data, null, `profile #${r.id} birth_data`),
        createdAt: r.created_at,
      })),
    });
  });

  // Create a new profile
  router.post('/', auth, (req, res) => {
    const { name, relation, birthData, isSelf } = req.body || {};
    if (!name || !birthData) return res.status(400).json({ error: 'name and birthData are required' });
    const safeName = String(name).slice(0, 60).trim();
    const safeRelation = ['self', 'family', 'friend', 'partner', 'child', 'other'].includes(relation) ? relation : 'other';
    if (!birthData.date || !birthData.time || !birthData.city) {
      return res.status(400).json({ error: 'birthData must include date, time, city' });
    }
    const cleanBd = {
      date: birthData.date,
      time: birthData.time,
      city: birthData.city,
      country: birthData.country || '',
      latitude: Number(birthData.latitude) || 0,
      longitude: Number(birthData.longitude) || 0,
      timezone: Number(birthData.timezone) || 0,
    };
    if (isSelf) {
      db.prepare('UPDATE profiles SET is_self = 0 WHERE user_id = ?').run(req.user.id);
    }
    const result = db.prepare(
      'INSERT INTO profiles (user_id, name, relation, birth_data, is_self) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, safeName, safeRelation, JSON.stringify(cleanBd), isSelf ? 1 : 0);
    res.json({ ok: true, id: result.lastInsertRowid });
  });

  // Update a profile
  router.put('/:id', auth, (req, res) => {
    const profileId = parseInt(req.params.id, 10);
    if (!Number.isFinite(profileId)) return res.status(400).json({ error: 'Invalid profile id' });
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Profile not found' });
    const { name, relation, birthData, isSelf } = req.body || {};
    const newName = name ? String(name).slice(0, 60).trim() : existing.name;
    const newRelation = relation && ['self', 'family', 'friend', 'partner', 'child', 'other'].includes(relation) ? relation : existing.relation;
    let newBd = existing.birth_data;
    if (birthData) {
      if (!birthData.date || !birthData.time || !birthData.city) {
        return res.status(400).json({ error: 'birthData must include date, time, city' });
      }
      newBd = JSON.stringify({
        date: birthData.date,
        time: birthData.time,
        city: birthData.city,
        country: birthData.country || '',
        latitude: Number(birthData.latitude) || 0,
        longitude: Number(birthData.longitude) || 0,
        timezone: Number(birthData.timezone) || 0,
      });
    }
    if (isSelf) {
      db.prepare('UPDATE profiles SET is_self = 0 WHERE user_id = ? AND id != ?').run(req.user.id, profileId);
    }
    const newIsSelf = isSelf === undefined ? existing.is_self : (isSelf ? 1 : 0);
    db.prepare('UPDATE profiles SET name = ?, relation = ?, birth_data = ?, is_self = ? WHERE id = ?').run(
      newName, newRelation, newBd, newIsSelf, profileId
    );
    res.json({ ok: true });
  });

  // Delete a profile
  router.delete('/:id', auth, (req, res) => {
    const profileId = parseInt(req.params.id, 10);
    if (!Number.isFinite(profileId)) return res.status(400).json({ error: 'Invalid profile id' });
    const existing = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Profile not found' });
    db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
    res.json({ ok: true });
  });

  // Get a single profile with birth data
  router.get('/:id', auth, (req, res) => {
    const profileId = parseInt(req.params.id, 10);
    if (!Number.isFinite(profileId)) return res.status(400).json({ error: 'Invalid profile id' });
    const r = db.prepare('SELECT id, name, relation, birth_data, is_self, created_at FROM profiles WHERE id = ? AND user_id = ?').get(profileId, req.user.id);
    if (!r) return res.status(404).json({ error: 'Profile not found' });
    res.json({
      id: r.id,
      name: r.name,
      relation: r.relation,
      isSelf: !!r.is_self,
      birthData: safeJsonParse(r.birth_data, null, `partner profile #${r.id} birth_data`),
      createdAt: r.created_at,
    });
  });

  return router;
}
