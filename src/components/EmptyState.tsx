/**
 * P2#14 — EmptyState component.
 *
 * Affiche un état vide élégant et engageant quand une liste / un écran n'a
 * pas encore de contenu. Au lieu de laisser l'user devant une page blanche,
 * on lui offre un petit mot doux + un CTA pour démarrer.
 *
 * VMF : ton chaleureux, jamais culpabilisant ("ton journal t'attend",
 * pas "aucune entrée trouvée"). Inspire CHANI gold standard.
 *
 * Usage :
 *   <EmptyState
 *     title="Ton journal t'attend"
 *     subtitle="Écris ce que tu ressens..."
 *     icon="📖"
 *     ctaLabel="Écrire ma première entrée"
 *     onCta={() => navigate('/journal/new')}
 *   />
 */

import { type ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode | string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  subtitle,
  icon = '✨',
  ctaLabel,
  onCta,
  secondaryCtaLabel,
  onSecondaryCta,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      <div
        className="mb-4 text-5xl opacity-80 select-none"
        aria-hidden="true"
        style={{ filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.25))' }}
      >
        {typeof icon === 'string' && icon.length <= 2 ? icon : icon}
      </div>
      <h3 className="mb-2 text-lg font-serif text-gold-100">{title}</h3>
      {subtitle && (
        <p className="mb-6 max-w-xs text-sm leading-relaxed text-night-300">{subtitle}</p>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-medium text-night-900 shadow-lg shadow-amber-500/20 transition active:scale-95"
        >
          {ctaLabel}
        </button>
      )}
      {secondaryCtaLabel && onSecondaryCta && (
        <button
          onClick={onSecondaryCta}
          className="mt-3 text-sm text-night-400 underline underline-offset-4 transition hover:text-gold-200"
        >
          {secondaryCtaLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
