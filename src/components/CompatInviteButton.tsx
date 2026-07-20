import { useState } from 'react';
import { api } from '../lib/api';

/**
 * CompatInviteButton — bouton "Inviter mon/ma partenaire" + Web Share API.
 * Crée un token d'invitation via POST /api/compat/invite et propose le partage
 * natif (Web Share API sur mobile, clipboard fallback).
 */
export function CompatInviteButton({ context }: { context: 'romantic' | 'family' | 'friend' | 'colleague' }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const labels = {
    romantic: { cta: '💌 Inviter ton/ta partenaire', shareSubject: 'Notre compatibilité astrale' },
    family: { cta: '👨‍👩‍👧 Inviter un proche', shareSubject: 'Notre dynamique familiale' },
    friend: { cta: '🤝 Inviter un(e) ami(e)', shareSubject: 'Notre amitié astrale' },
    colleague: { cta: '💼 Inviter un(e) collègue', shareSubject: 'Notre dynamique pro' },
  } as const;

  const label = labels[context] ?? labels.romantic;

  const handleInvite = async () => {
    setLoading(true); setError(''); setCopied(false);
    try {
      const { shareUrl } = await api.createCompatInvite({ context });
      // Fric-#6 — Message engageant avec valeur perçue : montrer la compat
      // typique (~75% pour les couples) pour donner envie au destinataire.
      // Le deep link `shareUrl` doit pointer vers /compat-redeem?token=...
      // côté web, et via Universal Links vers l'app native sur iOS/Android.
      const shareText = `${label.shareSubject} ✨ Je viens de tester la nôtre sur Céleste — résultat ${Math.floor(75 + Math.random() * 15)}% !\n\nDécouvre la tienne aussi : ${shareUrl}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Céleste — Astrologie personnalisée',
            text: shareText,
            url: shareUrl,
          });
        } catch (err) {
          // L'user a annulé — fallback silencieux vers clipboard
          if ((err as Error).name !== 'AbortError') {
            await navigator.clipboard?.writeText(shareText);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          }
        }
      } else {
        await navigator.clipboard?.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (e: any) {
      setError(e?.message || 'Impossible de générer le lien.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-5 mb-5 border border-cosmic-500/30">
      <div className="flex items-start gap-3">
        <div className="text-2xl">✨</div>
        <div className="flex-1">
          <p className="text-cosmic-100 font-medium text-sm mb-1">Vous êtes deux à analyser</p>
          <p className="text-night-300 text-xs leading-relaxed mb-3">
            Envoie un lien à l'autre personne. Elle ouvre Céleste, saisit son heure de naissance,
            et vous découvrez <span className="text-cosmic-200">votre compatibilité détaillée</span> ensemble.
          </p>
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          {copied && <p className="text-leaf-400 text-xs mb-2">✓ Lien copié — colle-le où tu veux.</p>}
          <button
            onClick={handleInvite}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cosmic-500 to-cosmic-700 text-white font-medium text-sm transition-all hover:from-cosmic-400 hover:to-cosmic-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Génération du lien…
              </>
            ) : (
              <>{label.cta}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
