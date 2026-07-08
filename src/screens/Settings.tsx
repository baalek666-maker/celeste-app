import { useState } from 'react';
import type { User } from '../types';
import { logout } from '../lib/storage';
import { ZODIAC_SIGNS } from '../data/zodiac';

export function Settings({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const [showLegal, setShowLegal] = useState(false);

  const handleLogout = () => {
    const u = logout();
    onUpdate(u);
    window.location.reload();
  };

  if (showLegal) {
    return (
      <div className="px-5 pt-12 pb-4">
        <button onClick={() => setShowLegal(false)} className="text-night-400 text-sm mb-4">← Retour</button>
        <h1 className="text-xl font-bold mb-6 text-gold-gradient">Informations légales</h1>

        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-night-100 font-semibold mb-2">Mentions légales</h2>
          <p className="text-night-400 text-sm leading-relaxed">
            Céleste est une application d'astrologie personnalisée éditée à titre informatif et de divertissement.
            Les contenus proposés ne constituent ni un conseil médical, ni un conseil financier, ni un conseil juridique.
            En cas de besoin professionnel, consultez un spécialiste qualifié.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-night-100 font-semibold mb-2">Confidentialité (RGPD)</h2>
          <p className="text-night-400 text-sm leading-relaxed">
            Vos données de naissance (date, heure, lieu) sont stockées localement sur votre appareil.
            Elles ne sont jamais transmises à des tiers ni utilisées à des fins publicitaires.
            Vous pouvez les supprimer à tout moment en vous déconnectant.
          </p>
        </div>

        <div className="glass rounded-2xl p-5 mb-4">
          <h2 className="text-night-100 font-semibold mb-2">Conditions d'abonnement</h2>
          <p className="text-night-400 text-sm leading-relaxed">
            • Essai gratuit de 3 jours sur l'offre annuelle, sans engagement.<br/>
            • Rappel par notification 24h avant le premier prélèvement.<br/>
            • Annulation possible à tout moment dans les réglages de l'App Store / Google Play.<br/>
            • Droit de rétractation de 14 jours (sauf contenu numérique déjà consommé).<br/>
            • Pas de remboursement pour la période en cours.
          </p>
        </div>
      </div>
    );
  }

  const chart = user.natalChart;
  const sun = chart ? ZODIAC_SIGNS[chart.sun] : null;

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-6 text-gold-gradient">Profil</h1>

      {/* User card */}
      <div className="glass rounded-3xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cosmic-500/30 to-gold-500/30 flex items-center justify-center">
            <span className="text-2xl">{sun?.emoji}</span>
          </div>
          <div className="flex-1">
            <p className="text-night-100 font-semibold">{user.email || 'Invité'}</p>
            <p className="text-night-400 text-sm">
              {sun ? `Soleil ${sun.name}` : '—'}
            </p>
            {user.birthData && (
              <p className="text-night-500 text-xs mt-0.5">
                {user.birthData.city}, {user.birthData.date}
              </p>
            )}
          </div>
        </div>

        {/* Premium badge */}
        <div className="mt-4 pt-4 border-t border-night-700">
          {user.isPremium ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gold-400">★</span>
                <p className="text-gold-300 font-medium text-sm">Premium</p>
              </div>
              {user.premiumUntil && (
                <p className="text-night-400 text-xs">
                  jusqu'au {new Date(user.premiumUntil).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-night-400 text-sm">Compte gratuit</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={() => setShowLegal(true)}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left hover:border-night-600 border border-transparent transition-all">
          <span className="text-night-200 text-sm">Informations légales</span>
          <span className="text-night-400">→</span>
        </button>
        <button onClick={handleLogout}
          className="w-full glass rounded-2xl p-4 flex items-center justify-between text-left border border-transparent hover:border-red-900/50 transition-all">
          <span className="text-red-400 text-sm">Se déconnecter / Réinitialiser</span>
          <span className="text-red-400">→</span>
        </button>
      </div>

      <p className="text-night-600 text-xs text-center mt-8">Céleste · v1.0.0</p>
    </div>
  );
}
