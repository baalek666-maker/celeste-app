/**
 * OAuth Routes — Sign in with Apple + Google (P1, fric-#1)
 *
 * Mode PRODUCTION : on vérifie la signature JWT via JWKS Google/Apple.
 * - Google : `https://www.googleapis.com/oauth2/v3/certs` (rotating)
 * - Apple  : `https://appleid.apple.com/auth/keys`
 * On rejette tout token qui ne porte pas un `iss` autorisé et un `aud`
 * matchant notre client ID. Démo/mock désactivé par défaut.
 *
 * Pour activer le mode démo local (VITE_OAUTH_DEMO=true côté front),
 * on garde un fallback qui accepte les tokens commençant par `mock.`
 * UNIQUEMENT si OAUTH_DEMO_MODE=1 côté serveur (variables d'env séparées).
 *
 * Flow :
 *  1. Frontend OAuth lib (Google Account Services / Apple ID) → idToken JWT signé
 *  2. POST /api/auth/oauth { provider, idToken, email?, displayName?, avatar? }
 *  3. Backend vérifie signature + claims, cherche user par oauth_provider+oauth_id
 *     ou par email. Crée si besoin. Retourne { token, refreshToken, user }.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes, createPublicKey, verify, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { issueTokenPair } from '../auth-tokens.js';

const router = express.Router();

const VALID_PROVIDERS = ['google', 'apple'];

// JWKS providers — Google + Apple. Cached pour 24h avec TTL.
const JWKS_CACHE = new Map(); // uri -> { keys: [...], ts: number }
const JWKS_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchJwks(uri) {
  const cached = JWKS_CACHE.get(uri);
  if (cached && Date.now() - cached.ts < JWKS_TTL_MS) return cached.keys;
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = await res.json();
  JWKS_CACHE.set(uri, { keys: data.keys, ts: Date.now() });
  return data.keys;
}

function jwkToPem(jwk) {
  // Convertit une JWK (kty, n, e) en PEM public key pour Node crypto.
  // On utilise la conversion via KeyObject pour rester propre.
  const { n, e } = jwk;
  if (!n || !e) throw new Error('Invalid JWK: missing n or e');
  // Décode base64url -> bigint -> Buffer
  const base64urlToBuffer = (s) => {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
    return Buffer.from(padded, 'base64');
  };
  const modulus = base64urlToBuffer(n);
  const exponent = base64urlToBuffer(e);
  // Crée un DER SubjectPublicKeyInfo pour RSA
  // ASN.1 minimal : RSAPublicKey = SEQUENCE { modulus INTEGER, publicExponent INTEGER }
  const der = buildRsaSpki(modulus, exponent);
  const keyObj = createPublicKey({ key: der, format: 'der', type: 'spki' });
  return keyObj.export({ type: 'spki', format: 'pem' });
}

// Construction DER pour RSAPublicKey (modulus, exponent) → SPKI.
// Algo : subjectPublicKeyInfo = SEQUENCE { algorithm AlgorithmIdentifier, subjectPublicKey BIT STRING }
// où subjectPublicKey contient le RSAPublicKey (modulus, exponent).
function buildRsaSpki(modulus, exponent) {
  // RSAPublicKey DER
  const rsaPubKey = encodeAsn1Sequence(
    encodeAsn1Integer(modulus),
    encodeAsn1Integer(exponent)
  );
  // AlgorithmIdentifier pour rsaEncryption: OID 1.2.840.113549.1.1.1 + NULL
  const algoId = encodeAsn1Sequence(
    encodeAsn1Oid('1.2.840.113549.1.1.1'),
    Buffer.from([0x05, 0x00]) // NULL
  );
  // BIT STRING wrapping RSAPublicKey
  const bitString = Buffer.concat([
    Buffer.from([0x03]), // BIT STRING tag
    ...encodeDerLength(rsaPubKey.length + 1),
    Buffer.from([0x00]), // unused bits
    rsaPubKey,
  ]);
  // SPKI
  const spki = encodeAsn1Sequence(algoId, bitString);
  return spki;
}

function encodeAsn1Integer(buf) {
  // Ajoute 0x00 si MSB est 1 (ASN.1 INTEGER must be positive)
  const padded = buf[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), buf]) : buf;
  return Buffer.concat([
    Buffer.from([0x02]),
    ...encodeDerLength(padded.length),
    padded,
  ]);
}

function encodeAsn1Oid(oid) {
  const parts = oid.split('.').map(Number);
  const first = parts[0] * 40 + parts[1];
  const bytes = [first];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack = [v & 0x7f];
    v >>= 7;
    while (v > 0) {
      stack.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    bytes.push(...stack);
  }
  const body = Buffer.from(bytes);
  return Buffer.concat([
    Buffer.from([0x06]),
    ...encodeDerLength(body.length),
    body,
  ]);
}

function encodeAsn1Sequence(...children) {
  const body = Buffer.concat(children);
  return Buffer.concat([
    Buffer.from([0x30]),
    ...encodeDerLength(body.length),
    body,
  ]);
}

function encodeDerLength(n) {
  if (n < 0x80) return [Buffer.from([n])];
  const bytes = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v >>= 8;
  }
  return [Buffer.from([0x80 | bytes.length]), Buffer.from(bytes)];
}

async function getPemForKid(provider, kid) {
  const uri = provider === 'google'
    ? 'https://www.googleapis.com/oauth2/v3/certs'
    : 'https://appleid.apple.com/auth/keys';
  const keys = await fetchJwks(uri);
  const jwk = keys.find(k => k.kid === kid);
  if (!jwk) throw new Error(`No matching JWK for kid=${kid}`);
  return jwkToPem(jwk);
}

// Audience IDs attendus — configurés via variables d'environnement.
// En prod, OBLIGATOIRE. En mode démo, on accepte tout (mais on log un warning).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || '';
const DEMO_MODE = process.env.OAUTH_DEMO_MODE === '1';

if (!DEMO_MODE && (!GOOGLE_CLIENT_ID || !APPLE_CLIENT_ID)) {
  console.warn('[oauth] ⚠️  GOOGLE_CLIENT_ID et APPLE_CLIENT_ID non définis — auth Google/Apple sera refusée en prod.');
}

/**
 * Décode un JWT pour récupérer le header (alg, kid) avant vérification.
 */
function decodeJwtHeader(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const header = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const padded = header + '='.repeat((4 - (header.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function decodeJwtPayload(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Vérifie un idToken Google ou Apple.
 * Retourne { valid: true, claims } ou { valid: false, error }.
 */
async function verifyIdToken(provider, idToken) {
  // Filet de sécurité : mode démo
  if (DEMO_MODE && typeof idToken === 'string' && idToken.startsWith('mock.')) {
    console.warn('[oauth] ⚠️  DEMO MODE: token mock accepté — NE PAS UTILISER EN PROD');
    const claims = decodeJwtPayload(idToken);
    if (!claims) return { valid: false, error: 'Malformed demo token' };
    return { valid: true, claims, demo: true };
  }

  if (!['google', 'apple'].includes(provider)) {
    return { valid: false, error: 'Invalid provider' };
  }

  const header = decodeJwtHeader(idToken);
  if (!header || !header.kid || !header.alg) {
    return { valid: false, error: 'Invalid token header (missing kid or alg)' };
  }
  if (header.alg !== 'RS256') {
    return { valid: false, error: `Unsupported algorithm: ${header.alg} (only RS256 allowed)` };
  }

  let pem;
  try {
    pem = await getPemForKid(provider, header.kid);
  } catch (e) {
    return { valid: false, error: `Key lookup failed: ${e.message}` };
  }

  // Récupère le payload sans vérifier pour lire iss/aud
  const payload = decodeJwtPayload(idToken);
  if (!payload) return { valid: false, error: 'Invalid token payload' };

  // Vérifie iss/aud AVANT la signature (fail fast)
  const expectedIssuer = provider === 'google'
    ? ['https://accounts.google.com', 'accounts.google.com']
    : ['https://appleid.apple.com'];
  const expectedAudiences = provider === 'google'
    ? [GOOGLE_CLIENT_ID].filter(Boolean)
    : [APPLE_CLIENT_ID, APPLE_BUNDLE_ID].filter(Boolean);

  if (!DEMO_MODE && expectedAudiences.length === 0) {
    return { valid: false, error: `Server missing ${provider.toUpperCase()}_CLIENT_ID` };
  }

  const issuers = Array.isArray(expectedIssuer) ? expectedIssuer : [expectedIssuer];
  if (!issuers.includes(payload.iss)) {
    return { valid: false, error: `Invalid issuer: ${payload.iss}` };
  }

  const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const audMatches = DEMO_MODE
    ? true
    : expectedAudiences.some(a => tokenAud.includes(a));
  if (!audMatches) {
    return { valid: false, error: `Invalid audience: ${JSON.stringify(tokenAud)}` };
  }

  // Vérifie la signature crypto avec node crypto
  const sig = (() => {
    const parts = idToken.split('.');
    const s = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    return Buffer.from(padded, 'base64');
  })();
  const data = Buffer.from(idToken.split('.').slice(0, 2).join('.'), 'utf-8');

  const ok = verify('RSA-SHA256', data, pem, sig);
  if (!ok) {
    return { valid: false, error: 'Signature verification failed' };
  }

  // Vérifie expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return { valid: false, error: 'Token expired' };
  }

  return { valid: true, claims: payload };
}

router.post('/login', async (req, res) => {
  try {
    const { provider, idToken, email: claimedEmail, displayName, avatar } = req.body || {};
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be google or apple.' });
    }
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken required' });
    }

    // ✅ Vérification de signature JWT (Google JWKS ou Apple JWKS)
    const verification = await verifyIdToken(provider, idToken);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error || 'Invalid idToken signature' });
    }
    const claims = verification.claims;

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