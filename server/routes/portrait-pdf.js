/**
 * server/routes/portrait-pdf.js — Portrait astral PDF (one-shot IAP).
 *
 * Endpoints:
 *   GET  /api/portrait/pdf/status  → quota restant { freeUsed, freeQuota, hasPaid }
 *   POST /api/portrait/pdf/mark-paid  → enregistre 1 achat (auth requise + secret header)
 *   GET  /api/portrait/pdf           → génère et stream le PDF (auth requise)
 *
 * Logique de quota:
 *   - Chaque user a droit à 1 PDF gratuit via `pdf_grants` table.
 *   - Le client DOIT vérifier le paiement côté IAP (Apple/Google) puis POST /mark-paid
 *     avec le receipt. En attendant un vrai webhook Receipt validation, le serveur
 *     accepte un X-Celeste-IAP-Secret header partagé uniquement via env var.
 *   - Le secret défaut 'DEV-IAP-SECRET' DOIT être changé en prod (process.env.CELESTE_IAP_SECRET).
 */
import { Router } from 'express';
import { generatePortraitPdf } from '../portrait-pdf.js';

const QUOTA_FREE_DEFAULT = 1;

/**
 * Idempotent migration: creates pdf_grants table + grants the user 1 free
 * PDF on first read, if absent.
 */
function ensurePdfGrants(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pdf_grants (
      user_id INTEGER PRIMARY KEY,
      free_used INTEGER DEFAULT 0,
      free_quota INTEGER DEFAULT 1,
      paid_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
}

export function createPortraitPdfRouter({ db, auth, getNatalPositions }) {
  ensurePdfGrants(db);

  const router = Router();

  /**
   * GET /api/portrait/pdf/status
   * Returns: { freeUsed, freeQuota, hasPaid, canDownload }.
   */
  router.get('/status', auth, (req, res) => {
    try {
      const userId = req.user.id;
      const row = db.prepare('SELECT free_used, free_quota, paid_count FROM pdf_grants WHERE user_id = ?').get(userId);
      if (!row) {
        db.prepare('INSERT INTO pdf_grants (user_id) VALUES (?)').run(userId);
        return res.json({ freeUsed: 0, freeQuota: QUOTA_FREE_DEFAULT, paidCount: 0, canDownload: true });
      }
      const canDownload = row.free_used < row.free_quota || row.paid_count > 0;
      res.json({
        freeUsed: row.free_used,
        freeQuota: row.free_quota,
        paidCount: row.paid_count,
        canDownload,
      });
    } catch (err) {
      console.error('[portrait-pdf/status] error:', err.message);
      res.status(500).json({ error: 'status lookup failed' });
    }
  });

  /**
   * POST /api/portrait/pdf/mark-paid
   * Body: { receipt?: string, source?: 'ios'|'android'|'stripe' }
   *
   * Increments paid_count by 1, granting 1 extra PDF download.
   * The receipt validation is stubbed — production must validate against
   * App Store / Play Store / Stripe BEFORE incrementing.
   */
  // POST /portrait/pdf/mark-paid — @DEPRECATED Route désactivée.
  // La gate x-celeste-iap-secret a été supprimée (secret hardcodé côté client = faille).
  // Pour acheter un PDF : /api/billing/create-consumable {type:'pdf'} → Stripe webhook.
  router.post('/mark-paid', auth, (req, res) => {
    res.status(410).json({
      error: 'route_deprecated',
      message: 'Utilise /api/billing/create-consumable {type:"pdf"} pour acheter un Portrait PDF.',
    });
  });

  /**
   * GET /api/portrait/pdf
   * Streams the portrait PDF. Decrements free quota OR consumes 1 paid token.
   */
  router.get('/', auth, async (req, res) => {
    try {
      const userId = req.user.id;
      const grants = db.prepare('SELECT free_used, free_quota, paid_count FROM pdf_grants WHERE user_id = ?').get(userId)
        ?? (() => { db.prepare('INSERT INTO pdf_grants (user_id) VALUES (?)').run(userId); return { free_used: 0, free_quota: QUOTA_FREE_DEFAULT, paid_count: 0 }; })();

      const canUseFree = grants.free_used < grants.free_quota;
      if (!canUseFree && grants.paid_count <= 0) {
        return res.status(402).json({ error: 'quota_exceeded', message: 'Tu as déjà utilisé ton PDF offert. Achète un PDF supplémentaire (9,99€).' });
      }

      // Fetch portrait text
      const cached = db.prepare('SELECT portrait FROM astro_portraits WHERE user_id = ?').get(userId);
      if (!cached?.portrait || cached.portrait.length < 200) {
        return res.status(404).json({ error: 'no_portrait', message: 'Aucun portrait disponible. Génère-le d\'abord depuis l\'app.' });
      }
      const userRow = db.prepare('SELECT email, display_name, birth_data FROM users WHERE id = ?').get(userId);
      const birthData = userRow?.birth_data ? safeParse(userRow.birth_data) : null;
      const name = userRow?.display_name || (userRow?.email ? userRow.email.split('@')[0] : 'Céleste voyageur');

      // Fric-pdf-v3 — Calculer le natal chart complet pour enrichir le PDF
      // (tableau planétaire, roue zodiacale, distribution éléments/modes).
      let natalChart = null;
      if (getNatalPositions && birthData?.date && birthData?.time) {
        try {
          natalChart = getNatalPositions(birthData, true);
        } catch (e) {
          console.warn('[portrait-pdf] getNatalPositions failed:', e.message);
        }
      }

      const sun = natalChart?.sun?.sign
        ? frSignToEn(natalChart.sun.sign)
        : (birthData?.sun || birthData?.sunSign || 'sagittarius');
      const moon = natalChart?.moon?.sign
        ? frSignToEn(natalChart.moon.sign)
        : (birthData?.moon || birthData?.moonSign || 'cancer');
      const rising = natalChart?.ascendant?.sign
        ? frSignToEn(natalChart.ascendant.sign)
        : (birthData?.rising || birthData?.ascendant || 'libra');

      // Decrement quota
      if (canUseFree) {
        db.prepare('UPDATE pdf_grants SET free_used = free_used + 1, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ?').run(userId);
      } else {
        db.prepare('UPDATE pdf_grants SET paid_count = paid_count - 1, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ?').run(userId);
      }

      const pdf = await generatePortraitPdf({
        portrait: cached.portrait,
        name,
        sun,
        moon,
        rising,
        birthData,
        natalChart,
      });

      const filename = `portrait-astral-${sanitizeFilename(name)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(pdf);
    } catch (err) {
      console.error('[portrait-pdf/get] error:', err.message);
      res.status(500).json({ error: 'pdf_gen_failed', message: err.message });
    }
  });

  return router;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// FR sign name → EN key (matches ZODIAC_SIGNS keys)
const FR_TO_EN_SIGNS = {
  'Bélier': 'aries', 'Taureau': 'taurus', 'Gémeaux': 'gemini',
  'Cancer': 'cancer', 'Lion': 'leo', 'Vierge': 'virgo',
  'Balance': 'libra', 'Scorpion': 'scorpio', 'Sagittaire': 'sagittarius',
  'Capricorne': 'capricorn', 'Verseau': 'aquarius', 'Poissons': 'pisces',
};
function frSignToEn(fr) { return FR_TO_EN_SIGNS[fr] || 'sagittarius'; }

function sanitizeFilename(s) {
  return String(s || 'celeste')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'celeste';
}
