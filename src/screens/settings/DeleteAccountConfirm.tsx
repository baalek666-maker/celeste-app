import { useState } from 'react';
import { logout } from '../../lib/storage';
import { api } from '../../lib/api';
import { toast } from '../../components/Toast';
import type { User } from '../../types';

export function DeleteAccountConfirm({
  user,
  onUpdate,
  onBack,
}: {
  user: User;
  onUpdate: (u: User) => void;
  onBack: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      const u = logout();
      onUpdate(u);
      toast.success('Compte supprimé. À bientôt ✨');
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible — réessaie ou contacte le support.');
      setDeleting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5 border border-red-500/30 mt-2">
      <p className="text-red-300 text-sm font-semibold mb-2">⚠️ Supprimer définitivement ton compte ?</p>
      <p className="text-night-300 text-xs leading-relaxed mb-3">
        Cette action est <strong>irréversible</strong>. Toutes tes données seront effacées :
        profil, données de naissance, favoris, scans de compatibilité, abonnements et préférences
        de notification. Tu devras recréer un compte pour utiliser à nouveau Céleste.
      </p>
      <p className="text-night-400 text-xs mb-4">
        Si tu avais un abonnement actif, pense à l'annuler au préalable via le bouton
        « Gérer mon abonnement » ci-dessus.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-night-800 text-night-200 text-sm hover:bg-night-700 disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
        >
          {deleting ? 'Suppression…' : 'Confirmer la suppression'}
        </button>
      </div>
    </div>
  );
}

export default DeleteAccountConfirm;
