import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';

interface ReferralData {
  code: string;
  referralsCount: number;
  daysEarned: number;
  rewardPerReferral: number;
}

/**
 * P1#7 — Carte "Inviter tes amis".
 * Affiche le code de parrainage du user, lui permet de le partager via
 * Web Share API (mobile) ou de le copier. Indique aussi les gains (jours
 * premium).
 *
 * Ton VMF : chaleureux, pas transactionnel. "Offrir 7 jours" plutôt que
 * "Gagne du premium". Pas de jargon IA.
 */
export function ReferralCard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getReferralCode()
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Indisponible'); });
    return () => { alive = false; };
  }, []);

  const shareUrl = data
    ? `${window.location.origin}/?ref=${encodeURIComponent(data.code)}`
    : '';

  const handleShare = async () => {
    if (!data) return;
    const title = 'Céleste — ton horoscope personnalisé';
    const text = "J'utilise Céleste chaque matin pour mon horoscope. Voici 7 jours de premium offerts : ";
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        toast.success('Merci pour ce partage ✨');
      } catch (err) {
        // User cancelled — pas de toast.
        if ((err as Error)?.name !== 'AbortError') {
          void fallbackCopy();
        }
      }
    } else {
      void fallbackCopy();
    }
  };

  const fallbackCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Lien copié ✓ Colle-le où tu veux.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Copie impossible — copie le code manuellement.');
    }
  };

  if (error) {
    // Silencieux : si l'API n'est pas joignable, on ne bloque pas l'écran Settings.
    return null;
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-32 bg-night-700/50 rounded mb-2" />
        <div className="h-8 w-40 bg-night-700/30 rounded" />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4 border border-gold-500/20">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🎁</span>
        <p className="text-gold-300 text-sm font-medium">Offre 7 jours de premium</p>
      </div>
      <p className="text-night-400 text-xs mb-3 leading-relaxed">
        Partage Céleste avec tes ami·es. Pour chaque inscription avec ton code,
        vous <strong className="text-night-200">gagnez tous les deux 7 jours</strong> de premium.
      </p>

      <div className="flex items-center justify-between bg-night-900/40 rounded-xl px-3 py-2 mb-3 border border-night-700">
        <div>
          <p className="text-night-500 text-[10px] uppercase tracking-widest">Ton code</p>
          <p className="text-gold-300 font-mono text-sm font-semibold tracking-wider">{data.code}</p>
        </div>
        <button
          onClick={fallbackCopy}
          className="text-xs px-2.5 py-1 rounded-lg bg-night-700/60 text-night-200 hover:bg-night-700"
        >
          {copied ? '✓ Copié' : 'Copier'}
        </button>
      </div>

      <button
        onClick={handleShare}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-night-950 text-sm font-semibold transition-all hover:from-cosmic-500 hover:to-cosmic-600"
      >
        📋 Copier mon lien
      </button>

      {data.referralsCount > 0 && (
        <div className="mt-3 pt-3 border-t border-night-700/60 flex items-center justify-between">
          <span className="text-night-400 text-xs">Filleuls inscrits</span>
          <span className="text-gold-300 text-xs font-semibold">
            {data.referralsCount} · {data.daysEarned} jours offerts ✨
          </span>
        </div>
      )}
    </div>
  );
}

export default ReferralCard;
