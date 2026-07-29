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
    const now = Math.floor(Date.now() / 1000);
    const premiumUntil = user?.premiumUntil
      ? (typeof user.premiumUntil === 'number'
        ? user.premiumUntil
        : Math.floor(new Date(user.premiumUntil as unknown as string).getTime() / 1000))
      : 0;
    const isLikelyPaidSubscription = premiumUntil > now + 30 * 86400;

    // v14.8 — CTA DÉMARRAGE TRIAL : si user non-premium et trialStartedAt vide,
    // on affiche une invitation douce à essayer 7 jours gratuit.
    if (!user?.isPremium && !user?.trialStartedAt && !isLikelyPaidSubscription) {
      return { mode: 'invite' as const };
    }

    // Trial en cours : bandeau décompte
    if (!user?.trialStartedAt) return null;
    const start = typeof user.trialStartedAt === 'number'
      ? user.trialStartedAt
      : Math.floor(new Date(user.trialStartedAt as unknown as string).getTime() / 1000);
    const elapsedDays = Math.floor((now - start) / 86400);
    const daysLeft = Math.max(0, 7 - elapsedDays);

    // Le bandeau s'affiche uniquement pendant les 7 jours du trial
    if (daysLeft <= 0 || daysLeft > 7) return null;
    if (isLikelyPaidSubscription) return null;
    return { mode: 'active' as const, daysLeft };
  }, [user?.trialStartedAt, user?.isPremium, user?.premiumUntil]);

  if (!info) return null;

  const handleClick = () => {
    if (onNavigate) onNavigate('paywall');
  };

  // ── Mode "invite" : jamais essayé, propose 7 jours gratuit ─────────────
  // v14.9.c — redesign épuré : liseré or top, badge OFFERT, vrai bouton CTA,
  // pas d'emoji (Sparkles SVG). Hiérarchie typo nette.
  if (info.mode === 'invite') {
    return (
      <div
        className="relative w-full mb-4 rounded-2xl overflow-hidden bg-night-900 border-t-2 border-cosmic-500 animate-fade-in"
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        aria-label="Essayer Premium gratuitement pendant 7 jours"
      >
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              {/* Sparkles icon — minimal SVG, pas d'emoji */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-cosmic-400 shrink-0">
                <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="currentColor" />
                <circle cx="19" cy="5" r="1.2" fill="currentColor" opacity="0.6" />
                <circle cx="5" cy="19" r="1" fill="currentColor" opacity="0.5" />
              </svg>
              <span className="text-cosmic-300 text-[10px] tracking-[0.2em] font-semibold uppercase">
                Premium
              </span>
            </div>
            {/* Badge OFFERT — pill gold */}
            <span className="bg-cosmic-500 text-night-950 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full">
              Offert
            </span>
          </div>

          <h3 className="text-night-50 text-lg leading-tight font-light mb-1.5" style={{ fontFamily: 'Georgia, "Cormorant Garamond", serif' }}>
            7 jours pour explorer
            <br />
            <span className="text-cosmic-300 italic">tout Premium</span>
          </h3>

          <p className="text-night-400 text-xs leading-relaxed mb-4">
            Toutes les lectures, sans carte bancaire. Annule quand tu veux.
          </p>

          <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-cosmic-400 to-cosmic-600 text-night-950 text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-cosmic-500/20">
            Activer mes 7 jours
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── Mode "active" : trial en cours, décompte ──────────────────────────
  // v14.9.c — même structure épurée : liseré or top + icône SVG + bouton CTA.
  const isLastDay = info.daysLeft === 1;
  const isLast3Days = info.daysLeft <= 3;

  const borderClass = isLastDay
    ? 'border-t-rose-400'
    : isLast3Days
      ? 'border-t-cosmic-500'
      : 'border-t-cosmic-500';

  const accentText = isLastDay ? 'text-rose-300' : 'text-cosmic-300';
  const accentBg = isLastDay ? 'bg-rose-500' : 'bg-cosmic-500';

  return (
    <div
      className={`relative w-full mb-4 rounded-2xl overflow-hidden bg-night-900 border-t-2 ${borderClass} animate-fade-in`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      aria-label={`Essai Premium : ${info.daysLeft} jour${info.daysLeft > 1 ? 's' : ''} restant${info.daysLeft > 1 ? 's' : ''}`}
    >
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`${accentText} shrink-0`}>
              {isLastDay ? (
                <path d="M12 2C11 6 8 8 8 13a4 4 0 008 0c0-5-3-7-4-11z" fill="currentColor" />
              ) : (
                <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="currentColor" />
              )}
            </svg>
            <span className={`${accentText} text-[10px] tracking-[0.2em] font-semibold uppercase`}>
              {isLastDay ? 'Dernière chance' : 'Essai en cours'}
            </span>
          </div>
          <span className={`${accentBg} text-night-950 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full`}>
            J-{info.daysLeft}
          </span>
        </div>

        <h3 className="text-night-50 text-lg leading-tight font-light mb-1.5" style={{ fontFamily: 'Georgia, "Cormorant Garamond", serif' }}>
          {isLastDay ? (
            <>Ton essai se termine <span className={`${accentText} italic`}>aujourd'hui</span></>
          ) : (
            <>Il te reste <span className={`${accentText} italic`}>{info.daysLeft} jours</span> d'essai</>
          )}
        </h3>

        <p className="text-night-400 text-xs leading-relaxed mb-4">
          {isLastDay
            ? 'Profite de tes dernières lectures, puis choisis ce qui te convient.'
            : 'Profite de toutes les fonctionnalités Premium. Annule quand tu veux.'}
        </p>

        <div className={`flex items-center justify-center gap-2 bg-gradient-to-r ${isLastDay ? 'from-rose-400 to-rose-600' : 'from-cosmic-400 to-cosmic-600'} text-night-950 text-sm font-semibold py-2.5 rounded-xl shadow-lg ${isLastDay ? 'shadow-rose-500/20' : 'shadow-cosmic-500/20'}`}>
          Voir Premium
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}