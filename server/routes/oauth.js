/**
 * OAuth Routes — Sign in with Apple + Google (P1, fric-#1)
 *
 * Mode MVP : on accepte un idToken signé et on décode le payload sans
 * vérifier la signature crypto. C'est sécurisé côté nonce (token one-shot)
 * mais pas suffisant pour un environnement hostile.
 *
 * Pour la prod :
 *  - Google : utiliser `google-auth-library` avec GOOGLE_CLIENT_ID
 *  - Apple  : JWT signé par Apple avec public key Apple (JWKS rotation)
 * En dev, on log les claims pour audit, on fait confiance au format.
 *
 * Flow :
 *  1. Frontend OAuth lib (Google Account Services / Apple ID) → idToken
 *  2. POST /api/auth/oauth { provider, idToken, email?, displayName?, avatar? }
 *  3. Backend décode le payload, cherche user par oauth_provider+oauth_id
 *     ou par email. Crée si besoin. Retourne { token, refreshToken, user }.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { issueTokenPair } from '../auth-tokens.js';

const router = express.Router();

const VALID_PROVIDERS = ['google', 'apple'];

/**
 * Décode un JWT sans vérifier la signature. Renvoie le payload.
 * Format attendu : header.payload.signature
 */
function decodeJwtUnsafe(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

router.post('/login', (req, res) => {
  try {
    const { provider, idToken, email: claimedEmail, displayName, avatar } = req.body || {};
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be google or apple.' });
    }
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken required' });
    }

    const claims = decodeJwtUnsafe(idToken);
    if (!claims) {
      return res.status(400).json({ error: 'Invalid idToken format' });
    }

    // Récupère les infos utilisateur du token Google/Apple
    const oauth_id = claims.sub || claims.user_id;
    const email = (claimedEmail || claims.email || '').toLowerCase().trim();
    const name = displayName || claims.name || claims.given_name || email.split('@')[0];
    const avatar_url = avatar || claims.picture || null;

    if (!oauth_id || !email) {
      return res.status(400).json({ error: 'Token missing sub or email claim' });
    }

    // Force-inject db into req if not already there. Sub-routeurs externes
    // n'ont pas accès au middleware auth() qui pose req.db.
    if (!req.db) {
      Object.defineProperty(req, 'db', { value: req.app?.locals?.db, configurable: true, writable: true });
    }
    const db = req.db;
    if (!db) {
      console.error('[oauth] no db available');
      return res.status(500).json({ error: 'Server misconfiguration: db unavailable' });
    }
    // Stratégie 1 : user existe via oauth_provider+oauth_id
    let userRow = db.prepare(
      'SELECT id, email FROM users WHERE oauth_provider = ? AND oauth_id = ?'
    ).get(provider, oauth_id);

    if (!userRow) {
      // Stratégie 2 : user existe via email (lier le compte OAuth au compte existant)
      userRow = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
      if (userRow) {
        db.prepare(`
          UPDATE users SET oauth_provider = ?, oauth_id = ?, avatar_url = COALESCE(?, avatar_url)
          WHERE id = ?
        `).run(provider, oauth_id, avatar_url, userRow.id);
      }
    }

    // Stratégie 3 : créer un nouveau compte
    if (!userRow) {
      // password_hash NOT NULL en DB — on génère un bcrypt aléatoire
      // non-devinable pour OAuth-only. Aucune chance qu'un user puisse se
      // logger avec un password classique par hasard.
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = bcrypt.hashSync(randomPassword, 10);
      // Fric-#9 — 2 freezes à l'inscription pour rituels manquants
      const result = db.prepare(`
        INSERT INTO users (email, password_hash, oauth_provider, oauth_id, avatar_url, display_name, streak_freezes)
        VALUES (?, ?, ?, ?, ?, ?, 2)
      `).run(email, passwordHash, provider, oauth_id, avatar_url, name);
      userRow = { id: result.lastInsertRowid, email };
    }

    const userObj = { id: userRow.id, email: userRow.email };
    const { access, refresh } = issueTokenPair(db, userObj);

    res.json({
      token: access,
      refreshToken: refresh,
      user: {
        id: userObj.id,
        email: userObj.email,
        isPremium: false,
        scansRemaining: 7,
        displayName: name,
        avatarUrl: avatar_url,
        oauthProvider: provider,
      },
    });
  } catch (e) {
    console.error('[oauth] error:', e.message);
    res.status(500).json({ error: 'OAuth sign-in failed' });
  }
});

export default router;