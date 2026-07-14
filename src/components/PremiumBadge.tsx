import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

type PremiumStatus = {
  isPremium: boolean;
  plan: 'free' | 'monthly' | 'yearly' | 'lifetime';
  premiumUntil: string | null;
  daysRemaining: number | null;
  benefits: string[];
};

const PLAN_LABELS: Record<PremiumStatus['plan'], { label: string; icon: string; color: string }> = {
  free: { label: 'Gratuit', icon: '🌱', color: 'bg-gray-100 text-gray-700' },
  monthly: { label: 'Mensuel', icon: '🌙', color: 'bg-blue-100 text-blue-700' },
  yearly: { label: 'Annuel', icon: '✨', color: 'bg-purple-100 text-purple-700' },
  lifetime: { label: 'À vie', icon: '👑', color: 'bg-amber-100 text-amber-800' }
};

export default function PremiumBadge({ onUpgrade }: { onUpgrade?: () => void }) {
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPremiumStatus()
      .then(setStatus)
      .catch(e => console.error('premium load:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="celeste-card mb-4 animate-pulse">
        <div className="h-4 bg-celeste-primary/10 rounded w-1/3 mb-2" />
        <div className="h-3 bg-celeste-primary/10 rounded w-1/2" />
      </div>
    );
  }

  if (!status) return null;

  const planInfo = PLAN_LABELS[status.plan];

  return (
    <div className={`celeste-card mb-4 ${status.isPremium ? 'border-l-4 border-amber-400' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="text-lg">{planInfo.icon}</span>
          <span>Statut Premium</span>
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${planInfo.color}`}>
          {planInfo.label}
        </span>
      </div>

      {status.isPremium && status.premiumUntil && status.plan !== 'lifetime' && (
        <p className="text-xs text-celeste-text/70 mb-3">
          Renouvellement le{' '}
          <span className="font-medium">
            {new Date(status.premiumUntil).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </span>
          {status.daysRemaining != null && (
            <span className="ml-1 text-celeste-text/50">
              ({status.daysRemaining} jours)
            </span>
          )}
        </p>
      )}

      {status.isPremium && status.plan === 'lifetime' && (
        <p className="text-xs text-amber-700 mb-3 italic">
          ✨ Tu fais partie des fondateurs — merci pour ta confiance
        </p>
      )}

      <ul className="space-y-1.5">
        {status.benefits.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="text-celeste-accent mt-0.5">✓</span>
            <span className="text-celeste-text/80">{b}</span>
          </li>
        ))}
      </ul>

      {!status.isPremium && (
        <button onClick={onUpgrade} className="mt-4 w-full py-2 px-4 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
          Passer Premium ✨
        </button>
      )}
    </div>
  );
}