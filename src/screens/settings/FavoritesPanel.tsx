import { useState } from 'react';
import { useFavorites } from '../../lib/useFavorites';

export function FavoritesPanel({ onBack }: { onBack: () => void }) {
  const { favorites, remove, loading } = useFavorites();
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleRemove = async (id: number) => {
    setBusyId(id);
    try {
      await remove(id);
    } catch (err) {
      console.warn('remove fav failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const sectionLabel = (s: string) => {
    switch (s) {
      case 'general': return '✦ Général';
      case 'love': return '♥ Amour';
      case 'career': return '★ Carrière';
      default: return s;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <button onClick={onBack} className="text-night-400 text-sm mb-4">← Retour</button>
      <h1 className="text-2xl font-bold mb-6 text-gold-gradient">Mes favoris</h1>

      {loading && favorites.length === 0 ? (
        <p className="text-night-400 text-sm">Chargement...</p>
      ) : favorites.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">☆</div>
          <p className="text-night-300 text-sm mb-2">Aucun favori pour l'instant.</p>
          <p className="text-night-500 text-xs">
            Clique sur l'étoile à côté d'une section de ton horoscope pour la sauvegarder ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map(fav => (
            <div key={fav.id} className="glass rounded-2xl p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gold-400 text-xs">{sectionLabel(fav.section)}</span>
                  <span className="text-night-500 text-xs">· {formatDate(fav.date)}</span>
                </div>
                <button
                  onClick={() => handleRemove(fav.id)}
                  disabled={busyId === fav.id}
                  className="text-night-500 hover:text-rose-400 text-sm px-2 py-1 transition-colors"
                  aria-label="Supprimer"
                >
                  {busyId === fav.id ? '...' : '✕'}
                </button>
              </div>
              <p className="text-night-100 text-sm leading-relaxed">{fav.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FavoritesPanel;
