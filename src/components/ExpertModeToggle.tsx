/**
 * P2#18 — Toggle du mode expert (insérable dans Settings).
 *
 * Affiche les données astronomiques techniques (degrés, maisons, aspects)
 * pour les utilisateur·rice·s qui veulent aller plus loin que la lecture
 * poétique de Céleste.
 *
 * VMF : pas de jargon. "Vue détaillée" plutôt que "mode expert astronomical".
 */

import { useExpertMode } from '../lib/expert-mode';

export function ExpertModeToggle() {
  const [enabled, setEnabled] = useExpertMode();

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-night-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-night-100 text-sm font-medium">🔬 Vue détaillée</p>
          <p className="text-night-400 text-xs mt-1 leading-relaxed">
            Affiche les degrés exacts des planètes, les maisons astrologiques
            et les aspects techniques. Pour les astro-curieux·ses.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Activer la vue détaillée"
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-gold-500' : 'bg-night-700'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {enabled && (
        <p className="text-gold-300 text-[11px] mt-3 italic">
          ✦ Mode détaillé activé — tu verras les coordonnées célestes précises.
        </p>
      )}
    </div>
  );
}

export default ExpertModeToggle;
