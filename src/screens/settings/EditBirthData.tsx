import { useState } from 'react';
import type { User, BirthData } from '../../types';
import { setBirthData } from '../../lib/storage';
import { calculateNatalChart } from '../../lib/astrology';
import { api } from '../../lib/api';
import { toast } from '../../components/Toast';
import { CitySearch } from '../../components/CitySearch';
import type { GeoPlace } from '../../lib/geocode';

export function EditBirthData({ user, onUpdate, onCancel }: {
  user: User;
  onUpdate: (u: User) => void;
  onCancel: () => void;
}) {
  const initial = user.birthData!;
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [selectedPlace, setSelectedPlace] = useState<GeoPlace | null>(
    initial.city && initial.country
      ? {
          displayName: `${initial.city}, ${initial.country}`,
          city: initial.city,
          country: initial.country,
          latitude: initial.latitude,
          longitude: initial.longitude,
          tzOffset: initial.timezone,
          timeZone: undefined,
        }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setErr('');
    if (!date) return setErr('Date manquante.');
    if (!time) return setErr('Heure manquante.');
    if (!selectedPlace) return setErr('Ville manquante.');
    const c = selectedPlace;
    const birth: BirthData = {
      date, time, city: c.city, country: c.country,
      latitude: c.latitude, longitude: c.longitude, timezone: c.tzOffset,
    };
    setSaving(true);
    try {
      const newChart = calculateNatalChart(birth);
      setBirthData(birth, newChart);
      try {
        await api.saveBirthData(birth);
        toast.success('Thème natal mis à jour ✨');
      } catch {
        toast.info('Sauvegardé localement — sync dès que possible');
      }
      onUpdate({ ...user, birthData: birth, natalChart: newChart });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'inconnue';
      setErr(`Erreur : ${msg}`);
      toast.error(`Recalcul impossible : ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <button onClick={onCancel} className="text-night-400 text-sm mb-4">← Retour</button>
      <h1 className="text-xl font-bold mb-2 text-gold-gradient">Modifier mes données</h1>
      <p className="text-night-400 text-xs mb-6">
        Tout changement recalcule ton thème natal et met à jour tes horoscopes.
      </p>

      <label className="block text-night-300 text-xs uppercase tracking-widest mb-2">Date de naissance</label>
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 mb-4 focus:outline-none focus:border-cosmic-500"
      />

      <label className="block text-night-300 text-xs uppercase tracking-widest mb-2">Heure de naissance</label>
      <input
        type="time" value={time} onChange={e => setTime(e.target.value)}
        className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 mb-6 focus:outline-none focus:border-cosmic-500"
      />

      <label className="block text-night-300 text-xs uppercase tracking-widest mb-2">Ville de naissance</label>
      <CitySearch
        onSelect={setSelectedPlace}
        value={selectedPlace}
        placeholder="🔎 Rechercher ta ville..."
      />

      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-50 text-night-950 font-semibold transition-all font-display tracking-wide"
      >
        {saving ? 'Recalcul…' : 'Enregistrer et recalculer'}
      </button>
    </div>
  );
}

export default EditBirthData;
