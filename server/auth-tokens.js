/**
 * server/auth-tokens.js — JWT access + refresh tokens.
 *
 * Architecture:
 *   - access token: short-lived (15min), used for every API call
 *   - refresh token: long-lived (30d), used only to mint new access tokens
 *   - blacklist: refresh tokens can be revoked server-side (logout, password change)
 *
 * Both tokens are JWTs signed with the same JWT_SECRET but carry a `type` claim
 * ('access' | 'refresh') so they can't be confused.
 */

import jwt from 'jsonwebtoken';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

export function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: REFRESH_TTL,
  });
}

/**
 * Verify a refresh token. Throws if invalid, expired, blacklisted, or wrong type.
 * Caller is responsible for catching and returning a 401.
 */
export function verifyRefreshToken(token, db) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  // Check blacklist
  const blacklisted = db
    .prepare('SELECT 1 FROM token_blacklist WHERE jti = ?')
    .get(decoded.jti);
  if (blacklisted) {
    throw new Error('Token revoked');
  }
  return decoded;
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.type !== 'access') {
    throw new Error('Not an access token');
  }
  return decoded;
}

/**
 * Blacklist a refresh token by its JTI. Idempotent (INSERT OR IGNORE).
 */
export function blacklistRefreshToken(jti, db) {
  db.prepare('INSERT OR IGNORE INTO token_blacklist (jti, revoked_at) VALUES (?, ?)').run(
    jti,
    Math.floor(Date.now() / 1000)
  );
}

/**
 * Issue a fresh access + refresh token pair.
 * Each refresh token has a unique `jti` (random nonce) so it can be individually revoked.
 */
export function issueTokenPair(db, user) {
  const jti = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const access = signAccessToken({ id: user.id, email: user.email });
  const refresh = signRefreshToken({ id: user.id, email: user.email, jti });
  return { access, refresh, jti };
}