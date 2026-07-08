import { useState } from 'react';
import type { User } from '../types';
import { activatePremium } from '../lib/storage';

export function Paywall({ onClose, onSubscribe }: {
  onClose: () => void;
  onSubscribe: (u: User) => void;
}) {
  const [plan, setPlan] = useState<'weekly' | 'yearly'>('yearly');

  const handleSubscribe = () => {
    const u = activatePremium(plan);
    onSubscribe(u);
  };

  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100">
      <div className="max-w-md mx-auto px-5 pt-12 pb-8 min-h-screen flex flex-col">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-night-400 hover:text-night-200">
          ✕
        </button>

        {/* Hero */}
        <div className="text-center mt-4 mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-cosmic-500/20 to-gold-500/20 flex items-center justify-center mb-4 animate-glow">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gold-gradient">Céleste Premium</h1>
          <p className="text-night-300 text-sm max-w-xs mx-auto">
            Débloquez l'astrologie profondément personnelle, chaque jour
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          {[
            { icon: '🌅', title: 'Horoscope quotidien personnalisé', desc: "Calculé à partir de VOS planètes, pas de votre seul signe solaire" },
            { icon: '💞', title: 'Compatibilité illimitée', desc: 'Analysez vos relations avec tous les signes' },
            { icon: '📖', title: 'Journal de bord', desc: 'Suivez vos ressentis et observez les cycles' },
            { icon: '🔮', title: 'Transits planétaires', desc: "Comprenez ce que les planètes activent en vous" },
          ].map(f => (
            <div key={f.title} className="glass rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-night-100 font-semibold text-sm">{f.title}</p>
                <p className="text-night-400 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="space-y-3 mb-6">
          <button onClick={() => setPlan('yearly')}
            className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${plan === 'yearly' ? 'border-gold-500 glass' : 'border-night-700 glass'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-night-100 font-bold">Annuel</p>
                  <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-xs font-medium">-58%</span>
                </div>
                <p className="text-night-400 text-xs mt-0.5">3 jours gratuits, puis 39,99€/an</p>
              </div>
              <div className="text-right">
                <p className="text-night-100 text-lg font-bold">3,33€</p>
                <p className="text-night-400 text-xs">/mois</p>
              </div>
            </div>
          </button>

          <button onClick={() => setPlan('weekly')}
            className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${plan === 'weekly' ? 'border-cosmic-500 glass' : 'border-night-700 glass'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-night-100 font-bold">Hebdomadaire</p>
                <p className="text-night-400 text-xs mt-0.5">6,99€/semaine</p>
              </div>
              <p className="text-night-100 text-lg font-bold">6,99€</p>
            </div>
          </button>
        </div>

        {/* CTA */}
        <button onClick={handleSubscribe}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 text-night-950 font-bold text-lg shadow-lg shadow-gold-900/50 transition-all animate-glow">
          {plan === 'yearly' ? 'Démarrer mon essai gratuit' : 'Activer maintenant'}
        </button>

        <p className="text-night-500 text-xs text-center mt-4">
          {plan === 'yearly'
            ? '3 jours gratuits puis 39,99€/an. Annulez à tout moment. Rappel avant prélèvement.'
            : '6,99€/semaine. Annulez à tout moment.'}
        </p>
        <p className="text-night-600 text-xs text-center mt-2">
          Contenu de divertissement. Ne constitue pas un conseil médical, financier ou juridique.
        </p>
      </div>
    </div>
  );
}
