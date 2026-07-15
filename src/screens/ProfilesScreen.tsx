import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api';
import type { User } from '../types';

type Profile = {
  id: number;
  name: string;
  relation: string;
  isSelf: boolean;
  birthData: {
    date: string;
    time: string;
    city: string;
    country?: string;
    latitude: number;
    longitude: number;
    timezone: number;
  };
  createdAt: number;
};

const RELATION_LABELS: Record<string, string> = {
  self: 'Moi',
  family: 'Famille',
  friend: 'Ami·e',
  partner: 'Partenaire',
  child: 'Enfant',
  other: 'Autre',
};

const RELATION_ICONS: Record<string, string> = {
  self: '✨',
  family: '🌳',
  friend: '🌟',
  partner: '💞',
  child: '🧸',
  other: '🌀',
};

export function ProfilesScreen({ user, onClose }: { user: User; onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const reload = async () => {
    if (!getToken()) return;
    setLoading(true);
    try {
      const { profiles: list } = await api.listProfiles();
      setProfiles(list);
    } catch (e) {
      console.error('Failed to load profiles', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) return;
      if (!cancelled) setLoading(true);
      try {
        const { profiles: list } = await api.listProfiles();
        if (!cancelled) setProfiles(list);
      } catch (e) {
        console.error('Failed to load profiles', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.email]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteProfile(id);
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      console.error('Failed to delete profile', e);
      setConfirmDelete(null);
    }
  };

  const handleSetSelf = async (id: number) => {
    try {
      await api.updateProfile(id, { isSelf: true });
      await reload();
    } catch (e) {
      console.error('Failed to set self profile', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0420] text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-lg bg-[#0b0420]/80 border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light tracking-wide">Profils</h1>
          <p className="text-xs text-white/50 mt-0.5">
            {profiles.length === 0 ? 'Aucun profil' : `${profiles.length} profil${profiles.length > 1 ? 's' : ''} enregistré${profiles.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          ✕ Fermer
        </button>
      </div>

      {/* Add button */}
      <div className="px-5 pt-5">
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-2xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 transition-colors p-4 text-white/70 hover:text-white text-sm"
        >
          + Ajouter un profil (famille, ami·e, partenaire…)
        </button>
      </div>

      {/* List */}
      <div className="px-5 py-5 space-y-3">
        {loading && <div className="text-center text-white/50 py-8">Chargement…</div>}
        {!loading && profiles.length === 0 && (
          <div className="text-center text-white/40 py-12 text-sm">
            Aucun profil pour le moment.<br />
            Commence par enregistrer ton propre thème astral, puis ajoutez tes proches pour comparer tes compatibilités.
          </div>
        )}
        {!loading && profiles.map(p => (
          <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{RELATION_ICONS[p.relation] || '🌀'}</span>
                  <span className="font-medium truncate">{p.name}</span>
                  {p.isSelf && (
                    <span className="text-[10px] uppercase tracking-wider bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full">
                      Mon thème
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50">
                  {RELATION_LABELS[p.relation] || p.relation} · {p.birthData.date} à {p.birthData.time}
                </div>
                <div className="text-xs text-white/40 mt-0.5 truncate">📍 {p.birthData.city}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                {!p.isSelf && (
                  <button
                    onClick={() => handleSetSelf(p.id)}
                    className="text-[11px] text-white/60 hover:text-amber-200 px-2 py-1 rounded hover:bg-white/5"
                    title="Définir comme mon thème principal"
                  >
                    ⭐ Moi
                  </button>
                )}
                <button
                  onClick={() => setEditing(p)}
                  className="text-[11px] text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => setConfirmDelete(p)}
                  className="text-[11px] text-white/60 hover:text-red-300 px-2 py-1 rounded hover:bg-white/5"
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(showAdd || editing) && (
        <ProfileForm
          existing={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={async () => { setShowAdd(false); setEditing(null); await reload(); }}
        />
      )}

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-5 animate-fade-in" onClick={() => setConfirmDelete(null)}>
          <div className="glass-gold rounded-2xl p-6 max-w-xs w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-3">🗑️</div>
            <p className="text-night-100 font-medium mb-1">Supprimer ce profil ?</p>
            <p className="text-night-400 text-xs mb-5">
              « {confirmDelete.name} » sera définitivement supprimé. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-2.5 text-sm text-night-200"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 bg-red-500/80 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile add/edit form (modal) ─────────────────────
function ProfileForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: Profile | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(existing?.name || '');
  const [relation, setRelation] = useState(existing?.relation || 'family');
  const [date, setDate] = useState(existing?.birthData.date || '');
  const [time, setTime] = useState(existing?.birthData.time || '12:00');
  const [city, setCity] = useState(existing?.birthData.city || '');
  const [isSelf, setIsSelf] = useState(existing?.isSelf || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !date || !time || !city.trim()) {
      setError('Tous les champs sont requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Geocode via Nominatim (free, no API key, CORS-enabled)
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`
      );
      if (!geoRes.ok) throw new Error('Géolocalisation indisponible');
      const geo = await geoRes.json();
      if (!Array.isArray(geo) || geo.length === 0) {
        setError(`Ville introuvable : "${city}". Essaie un nom plus précis (ex : Paris, FR).`);
        setSaving(false);
        return;
      }
      const lat = parseFloat(geo[0].lat);
      const lon = parseFloat(geo[0].lon);
      if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        setError('Coordonnées GPS invalides reçues du géocodeur. Réessaie.');
        setSaving(false);
        return;
      }

      // Déduction du fuseau horaire : on utilise le fuseau du navigateur (correct dans ~90%
      // des cas — users nés dans le même fuseau où ils vivent). Le fallback par longitude
      // (Math.round(lon/15)) ignorait les fuseaux politiques et le DST (Paris → UTC+0 au lieu de +1/+2).
      // TODO long terme : ajouter un sélecteur de fuseau horaire dans le formulaire.
      const tz = -new Date().getTimezoneOffset() / 60;

      const birthData = {
        date, time, city: city.trim(),
        country: geo[0].display_name?.split(',').pop()?.trim() || '',
        latitude: lat,
        longitude: lon,
        timezone: tz,
      };

      if (existing) {
        await api.updateProfile(existing.id, { name, relation, birthData, isSelf });
      } else {
        await api.createProfile({ name, relation, birthData, isSelf });
      }
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-[#15082e] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-medium mb-4">
          {existing ? 'Modifier le profil' : 'Nouveau profil'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Prénom</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex : Maman, Léa, Tom…"
              maxLength={60}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="text-xs text-white/60 mb-1 block">Lien</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(RELATION_LABELS).filter(([k]) => k !== 'self').map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setRelation(k)}
                  className={`text-xs px-2 py-2 rounded-lg border transition-colors ${
                    relation === k
                      ? 'border-amber-300/60 bg-amber-300/10 text-amber-100'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1">{RELATION_ICONS[k]}</span>{label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Date de naissance</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Heure</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60 mb-1 block">Ville de naissance</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="ex : Paris, FR"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelf}
              onChange={e => setIsSelf(e.target.checked)}
              className="accent-amber-300"
            />
            <span>Définir comme mon thème principal</span>
          </label>

          {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</div>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-2.5 text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-amber-400/90 hover:bg-amber-400 text-[#0b0420] font-medium rounded-lg py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : existing ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}