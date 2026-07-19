/**
 * TrialBanner — bandeau "Il te reste X jours d'essai Premium"
 *
 * P2-Fix-5 : transparence sur la fin de l'essai gratuit.
 * Source de vérité : `user.trialStartedAt` (timestamp secondes) + `user.premiumUntil`.
 * Si l'utilisateur est en trial (premiumUntil > now) ET qu'il n'a pas d'abonnement
 * Stripe actif (trialStartedAt != null = utilisé le trial), on affiche le bandeau.
 *
 * Apparition : au-dessus du premier bloc des écrans premium (Home, Horoscope, Explorer).
 * Disparaît automatiquement quand premiumUntil est dépassé (gratuit) ou quand
 * l'utilisateur passe à un abonnement payant (trialStartedAt inchangé mais
 * `isPremium` reste à true → masqué par le check final).
 *
 * Navigation : reçoit `onNavigate` du parent (pattern App.tsx), PAS useNavigate
 * (l'app n'est pas sous BrowserRouter — crash garanti).
 *
 * Copy VMF-aligned : chaleureux, jamais anxiogène. On remercie d'avance.
 */

import { useMemo } from 'react';
import type { User } from '../types';

export function TrialBanner({
  user,
  onNavigate,
}: {
  user: User;
  onNavigate?: (screen: string) => void;
}) {
  const info = useMemo(() => {
    if (!user?.trialStartedAt) return null;
    // trialStartedAt est en secondes (timestamp Unix) côté backend
    const start = typeof user.trialStartedAt === 'number'
      ? user.trialStartedAt
      : Math.floor(new Date(user.trialStartedAt as unknown as string).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const elapsedDays = Math.floor((now - start) / 86400);
    const daysLeft = Math.max(0, 7 - elapsedDays);

    // Le bandeau s'affiche uniquement pendant les 7 jours du trial
    if (daysLeft <= 0 || daysLeft > 7) return null;
    return { daysLeft };
  }, [user?.trialStartedAt]);

  if (!info) return null;

  // On n'affiche le bandeau que si l'utilisateur n'a PAS encore un abonnement payant.
  // Heuristique simple : si premiumUntil > now + 30 jours, c'est un vrai abonnement.
  // Sinon c'est le trial (max 7 jours + marge).
  const premiumUntil = user?.premiumUntil
    ? (typeof user.premiumUntil === 'number'
      ? user.premiumUntil
      : Math.floor(new Date(user.premiumUntil as unknown as string).getTime() / 1000))
    : 0;
  const now = Math.floor(Date.now() / 1000);
  const isLikelyPaidSubscription = premiumUntil > now + 30 * 86400;
  if (isLikelyPaidSubscription) return null;

  const isLastDay = info.daysLeft === 1;
  const isLast3Days = info.daysLeft <= 3;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate('paywall');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full mb-4 rounded-2xl p-4 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] animate-fade-in ${
        isLastDay
          ? 'bg-gradient-to-r from-amber-500/15 to-rose-500/10 border border-amber-400/40 glass'
          : isLast3Days
            ? 'bg-gradient-to-r from-cosmic-500/15 to-gold-500/10 border border-cosmic-400/30 glass-cosmic'
            : 'bg-gradient-to-r from-gold-500/10 to-cosmic-500/10 border border-gold-500/20 glass-gold'
      }`}
      aria-label={`Essai Premium : ${info.daysLeft} jour${info.daysLeft > 1 ? 's' : ''} restant${info.daysLeft > 1 ? 's' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{isLastDay ? '⏳' : '✨'}</div>
        <div className="flex-1 min-w-0">
          <p className="text-night-100 font-semibold text-sm">
            {isLastDay
              ? 'Ton essai se termine aujourd\'hui'
              : `Il te reste ${info.daysLeft} jour${info.daysLeft > 1 ? 's' : ''} d'essai Premium`}
          </p>
          <p className="text-night-300 text-xs mt-0.5">
            {isLastDay
              ? 'Profite de tes dernières lectures, puis choisis ce qui te convient.'
              : 'Profite de toutes les fonctionnalités Premium. Annule quand tu veux.'}
          </p>
        </div>
        <span className="text-gold-300 text-lg shrink-0">→</span>
      </div>
    </button>
  );
}