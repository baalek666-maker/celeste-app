export function LegalModal({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-5 pt-12 pb-4">
      <button onClick={onBack} className="text-night-400 text-sm mb-4">← Retour</button>
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
          Tes données de naissance (date, heure, lieu) sont stockées localement sur ton appareil
          et synchronisées sur nos serveurs (chiffrés en transit et au repos) pour te permettre
          d'y accéder depuis n'importe quel appareil connecté à ton compte. Elles ne sont jamais
          transmises à des tiers ni utilisées à des fins publicitaires.
        </p>
        <p className="text-night-400 text-sm leading-relaxed mt-2">
          Conformément au RGPD (articles 15, 16, 17 et 21), tu peux à tout moment :
        </p>
        <ul className="text-night-400 text-sm leading-relaxed mt-1 ml-4 list-disc">
          <li>Accéder à tes données (Profil → Modifier mes données de naissance)</li>
          <li>Les rectifier (idem)</li>
          <li>Les supprimer définitivement (bouton « Supprimer mon compte » ci-dessous)</li>
          <li>Retirer ton consentement aux notifications push</li>
        </ul>
      </div>

      <div className="glass rounded-2xl p-5 mb-4">
        <h2 className="text-night-100 font-semibold mb-2">Documents légaux</h2>
        <p className="text-night-400 text-sm leading-relaxed mb-3">Consulte nos documents complets :</p>
        <a
          href="/legal/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 text-sm hover:border-cosmic-500/50 transition-all mb-2"
        >
          🔒 Politique de confidentialité →
        </a>
        <a
          href="/legal/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 text-sm hover:border-cosmic-500/50 transition-all"
        >
          📜 Conditions générales d'utilisation (CGU) →
        </a>
      </div>

      <div className="glass rounded-2xl p-5 mb-4">
        <h2 className="text-night-100 font-semibold mb-2">Conditions d'abonnement</h2>
        <p className="text-night-400 text-sm leading-relaxed">
          • Essai gratuit de 7 jours sur l'offre annuelle, sans engagement.<br/>
          • Rappel par notification 24h avant le premier prélèvement.<br/>
          • Annulation possible à tout moment dans les réglages de l'App Store / Google Play.<br/>
          • Droit de rétractation de 14 jours (sauf contenu numérique déjà consommé).<br/>
          • Pas de remboursement pour la période en cours.
        </p>
      </div>
    </div>
  );
}

export default LegalModal;
