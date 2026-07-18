/**
 * P0#6 — Email verification + transactional via Resend.
 *
 * Resend (https://resend.com) — API simple, 3000 emails/mois gratuits.
 * Dépendance : `resend` npm package (ou fetch direct).
 *
 * Variables d'env requises :
 *   RESEND_API_KEY=re_xxx         (facultatif → mode noop en dev)
 *   RESEND_FROM=Céleste <ne-pas-repondre@celeste.app>  (from: header)
 *   APP_PUBLIC_URL=https://app.celeste.app             (pour le lien de vérif)
 *
 * Si RESEND_API_KEY n'est pas configuré, les emails sont loggés en console
 * (mode dev) — l'app fonctionne sans Resend en local.
 */

import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Céleste <ne-pas-repondre@celeste.app>';
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || process.env.VAPID_SUBJECT || 'http://localhost:3000';
const RESEND_API_URL = 'https://api.resend.com/emails';

const isConfigured = Boolean(RESEND_API_KEY);

/**
 * Envoie un email via Resend. Retourne { ok, id } ou { ok: false, error }.
 * En mode non-configé (dev), logge et retourne ok:true.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured) {
    console.log(`\n📧 [EMAIL DEV MODE — Resend non configuré]`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text?.slice(0, 200) ?? '[HTML only]'}\n`);
    return { ok: true, id: 'dev-mode-noop' };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        subject,
        html,
        text: text || subject, // fallback plain text
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[email] Resend API error:', res.status, errBody);
      return { ok: false, error: `Resend ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] sendEmail failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Envoie l'email de vérification avec un lien contenant le token.
 * Le lien pointe vers /verify-email?token=XXX qui déclenche /api/auth/verify-email.
 */
async function sendVerificationEmail(toEmail, verifyToken) {
  const verifyUrl = `${APP_PUBLIC_URL.replace(/\/$/, '')}/verify-email?token=${verifyToken}`;

  const subject = '✨ Confirme ton adresse email — Céleste';
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a1a;min-height:300px;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="500" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#12122a 0%,#0a0a1a 100%);border-radius:24px;border:1px solid rgba(255,215,128,0.15);padding:40px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="font-size:42px;">✨</div>
          <h1 style="color:#fbbf24;font-size:28px;font-weight:700;margin:16px 0 4px;letter-spacing:-0.5px;">Céleste</h1>
          <p style="color:#9ca3af;font-size:14px;margin:0;">Le ciel, version quotidienne.</p>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <h2 style="color:#e5e5f0;font-size:20px;font-weight:600;margin:0 0 16px;">Confirme ton email</h2>
          <p style="color:#a5a5c0;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Bienvenue. Un dernier geste pour activer ton compte : clique sur le bouton ci-dessous.
            On en a besoin pour t'envoyer tes horoscopes, te protéger contre les spams, et garder ta
            constellation privée.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <a href="${verifyUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#0a0a1a;font-weight:600;font-size:16px;padding:14px 40px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">
            Vérifier mon email
          </a>
        </td></tr>
        <tr><td style="padding-bottom:16px;">
          <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0;">
            Si le bouton ne marche pas, copie ce lien :<br>
            <span style="color:#9ca3af;word-break:break-all;">${verifyUrl}</span>
          </p>
        </td></tr>
        <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          <p style="color:#4b5563;font-size:12px;margin:0;">
            Si tu n'as pas créé de compte Céleste, ignore cet email — il sera supprimé automatiquement.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `CÉLESTE — Vérifie ton email

Bienvenue dans Céleste. Pour activer ton compte, ouvre ce lien :
${verifyUrl}

Si tu n'as pas créé de compte, ignore cet email.`;

  return sendEmail({ to: toEmail, subject, html, text });
}

/**
 * Génère un token opaque 32 bytes en hex (64 chars).
 * Utilisé pour la vérification email (et potentiellement d'autres flux).
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export {
  sendEmail,
  sendVerificationEmail,
  generateToken,
  isConfigured as isEmailConfigured,
};
