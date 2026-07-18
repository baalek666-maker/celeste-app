import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';

/**
 * P0#6 — Bannière "Email non vérifié" affichée en haut des écrans sensibles
 * (Settings, Profils). L'utilisateur peut renvoyer le mail de vérification.
 * Disparaît automatiquement une fois l'email confirmé.
 *
 * Ne s'affiche pas si :
 *  - l'API indique que l'email n'est pas configuré côté serveur (pas de Resend key)
 *  - l'email est déjà vérifié
 *  - l'utilisateur est en mode invité (pas d'email)
 */
export function EmailVerificationBanner({ email }: { email?: string | null }) {
  const [status, setStatus] = useState<{ emailVerified: boolean; isEmailConfigured: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Ne dérange pas les invités (pas d'email local)
    if (!email) return;
    api.getEmailStatus()
      .then(s => { if (alive) setStatus(s); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [email]);

  if (!email) return null;
  if (dismissed) return null;
  if (!status) return null;
  if (status.emailVerified) return null;
  if (!status.isEmailConfigured) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await api.resendVerification();
      toast.success('Mail de vérification renvoyé ✓ Va voir ta boîte mail.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'envoyer le mail — réessaie plus tard.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-3 mb-4 border border-amber-500/30 flex items-center gap-3">
      <span className="text-xl">📧</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 text-xs font-medium">Confirme ton adresse email</p>
        <p className="text-night-500 text-[11px] truncate">
          Vérifie ta boîte mail (et spams) pour accéder à la synchronisation cloud.
        </p>
      </div>
      <button
        onClick={handleResend}
        disabled={sending}
        className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 whitespace-nowrap"
      >
        {sending ? '…' : 'Renvoyer'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        className="text-night-500 hover:text-night-300 text-xs px-1"
      >
        ✕
      </button>
    </div>
  );
}

export default EmailVerificationBanner;
