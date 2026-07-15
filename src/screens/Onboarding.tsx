import { useState } from 'react';
import { calculateNatalChart } from '../lib/astrology';
import { setBirthData, setOnboarded } from '../lib/storage';
import { api } from '../lib/api';
import type { User, BirthData, NatalChart } from '../types';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { toast } from '../components/Toast';

// Strip diacritics so "Strasbourg" matches "strasboug" and "Côte" matches "cote".
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const CITIES = [
  // France — grandes villes
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, tz: 2 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, tz: 2 },
  { city: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357, tz: 2 },
  { city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442, tz: 2 },
  { city: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620, tz: 2 },
  { city: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536, tz: 2 },
  { city: 'Montpellier', country: 'France', lat: 43.6109, lng: 3.8772, tz: 2 },
  { city: 'Strasbourg', country: 'France', lat: 48.5734, lng: 7.7521, tz: 2 },
  { city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792, tz: 2 },
  { city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573, tz: 2 },
  { city: 'Rennes', country: 'France', lat: 48.1173, lng: -1.6778, tz: 2 },
  { city: 'Reims', country: 'France', lat: 49.2583, lng: 4.0317, tz: 2 },
  { city: 'Le Havre', country: 'France', lat: 49.4944, lng: 0.1079, tz: 2 },
  { city: 'Saint-Étienne', country: 'France', lat: 45.4397, lng: 4.3872, tz: 2 },
  { city: 'Toulon', country: 'France', lat: 43.1242, lng: 5.9280, tz: 2 },
  { city: 'Le Mans', country: 'France', lat: 48.0061, lng: 0.1996, tz: 2 },
  { city: 'Angers', country: 'France', lat: 47.4784, lng: -0.5632, tz: 2 },
  { city: 'Grenoble', country: 'France', lat: 45.1885, lng: 5.7245, tz: 2 },
  { city: 'Dijon', country: 'France', lat: 47.3220, lng: 5.0415, tz: 2 },
  { city: 'Nîmes', country: 'France', lat: 43.8367, lng: 4.3601, tz: 2 },
  { city: 'Aix-en-Provence', country: 'France', lat: 43.5297, lng: 5.4474, tz: 2 },
  { city: 'Brest', country: 'France', lat: 48.3904, lng: -4.4861, tz: 2 },
  { city: 'Tours', country: 'France', lat: 47.3745, lng: 0.6890, tz: 2 },
  { city: 'Amiens', country: 'France', lat: 49.8941, lng: 2.2957, tz: 2 },
  { city: 'Limoges', country: 'France', lat: 45.8336, lng: 1.2627, tz: 2 },
  { city: 'Clermont-Ferrand', country: 'France', lat: 45.7772, lng: 3.0870, tz: 2 },
  { city: 'Villeurbanne', country: 'France', lat: 45.7640, lng: 4.8811, tz: 2 },
  { city: 'Besançon', country: 'France', lat: 47.2380, lng: 6.0244, tz: 2 },
  { city: 'Orléans', country: 'France', lat: 47.9029, lng: 1.9093, tz: 2 },
  { city: 'Metz', country: 'France', lat: 49.1193, lng: 6.1727, tz: 2 },
  { city: 'Rouen', country: 'France', lat: 49.4432, lng: 1.0993, tz: 2 },
  { city: 'Perpignan', country: 'France', lat: 42.6886, lng: 2.8947, tz: 2 },
  { city: 'Caen', country: 'France', lat: 49.1829, lng: -0.3707, tz: 2 },
  { city: 'Mulhouse', country: 'France', lat: 47.7508, lng: 7.3359, tz: 2 },
  { city: 'Boulogne-Billancourt', country: 'France', lat: 48.8397, lng: 2.2398, tz: 2 },
  { city: 'Nancy', country: 'France', lat: 48.6921, lng: 6.1844, tz: 2 },
  { city: 'Roubaix', country: 'France', lat: 50.6913, lng: 3.1800, tz: 2 },
  { city: 'Tourcoing', country: 'France', lat: 50.7240, lng: 3.1618, tz: 2 },
  { city: 'Avignon', country: 'France', lat: 43.9493, lng: 4.8055, tz: 2 },
  { city: 'Vitry-sur-Seine', country: 'France', lat: 48.7871, lng: 2.4025, tz: 2 },
  { city: 'Créteil', country: 'France', lat: 48.7839, lng: 2.4663, tz: 2 },
  { city: 'Dunkirk', country: 'France', lat: 51.0344, lng: 2.3768, tz: 2 },
  { city: 'Poitiers', country: 'France', lat: 46.5813, lng: 0.3400, tz: 2 },
  { city: 'Asnières-sur-Seine', country: 'France', lat: 48.9110, lng: 2.2842, tz: 2 },
  { city: 'Courbevoie', country: 'France', lat: 48.8964, lng: 2.2567, tz: 2 },
  { city: 'Nanterre', country: 'France', lat: 48.8919, lng: 2.2070, tz: 2 },
  { city: 'Versailles', country: 'France', lat: 48.8014, lng: 2.1301, tz: 2 },
  { city: 'Colombes', country: 'France', lat: 48.9237, lng: 2.2530, tz: 2 },
  { city: 'Aubervilliers', country: 'France', lat: 48.9162, lng: 2.3840, tz: 2 },
  { city: 'Aulnay-sous-Bois', country: 'France', lat: 48.9399, lng: 2.4978, tz: 2 },
  { city: 'Cherbourg', country: 'France', lat: 49.6387, lng: -1.6160, tz: 2 },
  { city: 'La Rochelle', country: 'France', lat: 46.1591, lng: -1.1521, tz: 2 },
  { city: 'Annecy', country: 'France', lat: 45.8992, lng: 6.1294, tz: 2 },
  { city: 'Bastia', country: 'France', lat: 42.7028, lng: 9.4470, tz: 2 },
  { city: 'Ajaccio', country: 'France', lat: 41.9272, lng: 8.7346, tz: 2 },
  { city: 'Calais', country: 'France', lat: 50.9513, lng: 1.8587, tz: 2 },
  { city: 'Valenciennes', country: 'France', lat: 50.3598, lng: 3.5227, tz: 2 },
  { city: 'La Roche-sur-Yon', country: 'France', lat: 46.6710, lng: -1.4300, tz: 2 },
  { city: 'Antibes', country: 'France', lat: 43.5863, lng: 7.1246, tz: 2 },
  { city: 'Cannes', country: 'France', lat: 43.5528, lng: 7.0174, tz: 2 },
  { city: 'Saint-Nazaire', country: 'France', lat: 47.2735, lng: -2.2139, tz: 2 },
  { city: 'Pau', country: 'France', lat: 43.2951, lng: -0.3708, tz: 2 },
  { city: 'Tarbes', country: 'France', lat: 43.2300, lng: 0.0700, tz: 2 },
  // DOM-TOM
  { city: 'Fort-de-France', country: 'Martinique', lat: 14.6042, lng: -61.0667, tz: -4 },
  { city: 'Saint-Denis', country: 'Réunion', lat: -20.8823, lng: 55.4504, tz: 4 },
  { city: 'Cayenne', country: 'Guyane', lat: 4.9224, lng: -52.3135, tz: -3 },
  { city: 'Nouméa', country: 'Nouvelle-Calédonie', lat: -22.2758, lng: 166.4580, tz: 11 },
  { city: 'Papeete', country: 'Polynésie', lat: -17.5331, lng: -149.5664, tz: -10 },
  // Belgique
  { city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517, tz: 2 },
  { city: 'Anvers', country: 'Belgique', lat: 51.2194, lng: 4.4025, tz: 2 },
  { city: 'Gand', country: 'Belgique', lat: 51.0543, lng: 3.7174, tz: 2 },
  { city: 'Charleroi', country: 'Belgique', lat: 50.4108, lng: 4.4446, tz: 2 },
  { city: 'Liège', country: 'Belgique', lat: 50.6326, lng: 5.5797, tz: 2 },
  { city: 'Bruges', country: 'Belgique', lat: 51.2093, lng: 3.2247, tz: 2 },
  { city: 'Namur', country: 'Belgique', lat: 50.4674, lng: 4.8720, tz: 2 },
  { city: 'Mons', country: 'Belgique', lat: 50.4550, lng: 3.9444, tz: 2 },
  // Suisse
  { city: 'Genève', country: 'Suisse', lat: 46.2044, lng: 6.1432, tz: 2 },
  { city: 'Lausanne', country: 'Suisse', lat: 46.5197, lng: 6.6323, tz: 2 },
  { city: 'Zurich', country: 'Suisse', lat: 47.3769, lng: 8.5417, tz: 2 },
  { city: 'Bâle', country: 'Suisse', lat: 47.5596, lng: 7.5886, tz: 2 },
  { city: 'Berne', country: 'Suisse', lat: 46.9481, lng: 7.4474, tz: 2 },
  { city: 'Neuchâtel', country: 'Suisse', lat: 46.9929, lng: 6.9319, tz: 2 },
  // Luxembourg
  { city: 'Luxembourg', country: 'Luxembourg', lat: 49.6116, lng: 6.1319, tz: 2 },
  // Canada (Québec)
  { city: 'Montréal', country: 'Canada', lat: 45.5017, lng: -73.5673, tz: -4 },
  { city: 'Québec', country: 'Canada', lat: 46.8139, lng: -71.2080, tz: -4 },
  { city: 'Gatineau', country: 'Canada', lat: 45.4760, lng: -75.7014, tz: -4 },
  { city: 'Sherbrooke', country: 'Canada', lat: 45.4012, lng: -71.8824, tz: -4 },
  { city: 'Laval', country: 'Canada', lat: 45.5300, lng: -73.5800, tz: -4 },
  // Afrique du Nord
  { city: 'Casablanca', country: 'Maroc', lat: 33.5731, lng: -7.5898, tz: 1 },
  { city: 'Rabat', country: 'Maroc', lat: 34.0209, lng: -6.8416, tz: 1 },
  { city: 'Marrakech', country: 'Maroc', lat: 31.6295, lng: -7.9811, tz: 1 },
  { city: 'Tanger', country: 'Maroc', lat: 35.7595, lng: -5.8340, tz: 1 },
  { city: 'Alger', country: 'Algérie', lat: 36.7538, lng: 3.0588, tz: 1 },
  { city: 'Oran', country: 'Algérie', lat: 35.6976, lng: -0.6337, tz: 1 },
  { city: 'Tunis', country: 'Tunisie', lat: 36.8065, lng: 10.1815, tz: 1 },
];

export function Onboarding({ onComplete }: { onComplete: (u: User) => void }) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [cityIdx, setCityIdx] = useState(0);
  const [calculating, setCalculating] = useState(false);

  const filteredCities = CITIES.filter(c => {
    if (!citySearch) return true;
    const q = normalize(citySearch);
    return normalize(c.city).includes(q) || normalize(c.country).includes(q);
  });

  const handleSubmit = () => {
    setCalculating(true);
    const c = CITIES[cityIdx];
    const finalTime = timeUnknown ? '12:00' : time;
    const birth: BirthData = {
      date, time: finalTime, city: c.city, country: c.country,
      latitude: c.lat, longitude: c.lng, timezone: c.tz,
    };

    // Compute chart immediately (sync), fire-and-forget backend save, then
    // transition after the cosmic animation window so the user gets feedback
    // while the request actually completes in parallel.
    const chart = calculateNatalChart(birth);
    setBirthData(birth, chart);
    setOnboarded();
    const save = api.saveBirthData(birth)
      .then(() => { toast.success('Thème natal sauvegardé ✨'); return 'synced'; })
      .catch(() => { toast.info('Sauvegardé localement — sync dès que possible'); return 'queued'; });

    // 1500ms (was 2800ms — felt too long during testing) plus save.
    const minDelay = new Promise(r => setTimeout(r, 1500));
    Promise.all([minDelay, save]).finally(() => {
      let user: Partial<User> = {};
      try { user = JSON.parse(localStorage.getItem('celeste_user') || '{}'); } catch { /* corrupt localStorage */ }
      onComplete(user as User);
    });
  };

  // Step indicator: 3 dots + progress bar (visible on steps 1-3)
  const ProgressBar = ({ current }: { current: number }) => (
    <div className="fixed top-0 left-0 right-0 px-8 pt-4 z-50">
      <div className="flex gap-2 mb-2">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex-1 h-1 rounded-full bg-night-800 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-cosmic-500 to-gold-500 transition-all duration-500 ${current >= n ? 'w-full' : 'w-0'}`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const BackButton = ({ to }: { to: number }) => (
    step > 0 && (
      <button
        type="button"
        onClick={() => setStep(to)}
        aria-label="Retour à l'étape précédente"
        className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full glass flex items-center justify-center text-night-300 hover:text-gold-400 transition-colors"
      >
        ←
      </button>
    )
  );

  const steps = [
    // Step 0: Welcome
    <div key="0" className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-fade-in">
      <div className="mb-8 relative">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cosmic-500/20 to-gold-500/20 flex items-center justify-center animate-glow">
          <svg width="64" height="64" viewBox="0 0 64 64" className="animate-spin-slow">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#fbbf24" strokeWidth="0.5" opacity="0.5" />
            <circle cx="32" cy="32" r="20" fill="none" stroke="#c084fc" strokeWidth="0.5" opacity="0.5" />
            <circle cx="32" cy="32" r="12" fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.5" />
            <circle cx="32" cy="4" r="2" fill="#fbbf24" />
            <circle cx="60" cy="32" r="1.5" fill="#c084fc" />
            <circle cx="32" cy="60" r="1.5" fill="#a855f7" />
            <circle cx="4" cy="32" r="1.5" fill="#fbbf24" />
            <circle cx="32" cy="32" r="3" fill="#fcd34d" opacity="0.8" />
          </svg>
        </div>
      </div>
      <h1 className="text-4xl font-bold mb-3 text-gold-gradient">Céleste</h1>
      <p className="text-night-300 text-lg mb-2">Ta carte du ciel,</p>
      <p className="text-night-300 text-lg mb-12">ton miroir</p>
      <p className="text-night-400 text-sm mb-8 max-w-xs">
        Une astrologie qui tu parle à toi. Pas de texte recyclé — chaque mot est calculé à partir de tes planètes réelles.
      </p>
      {/* P10 — Explain free tier upfront to set expectations */}
      <div className="glass rounded-2xl px-5 py-4 mb-8 max-w-xs border border-gold-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🎁</span>
          <span className="text-gold-400 text-sm font-semibold">3 scans offerts</span>
        </div>
        <p className="text-night-400 text-xs leading-relaxed text-left">
          Découvre ton compatibilité amoureuse, familiale ou amicale — 3 analyses gratuites pour explorer tout le potentiel de Céleste.
        </p>
      </div>
      <button
        onClick={() => setStep(1)}
        className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-lg shadow-lg shadow-cosmic-900/50 hover:shadow-cosmic-700/50 transition-all animate-glow"
      >
        Commencer
      </button>
    </div>,

    // Step 1: Date of birth
    <div key="1" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in relative">
      <ProgressBar current={1} />
      <BackButton to={0} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 1 sur 3</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Quand êtes-tu né·e ?</h2>
      <p className="text-night-400 text-sm mb-8 text-center max-w-xs">La position des planètes change chaque jour. Ton date de naissance est le point de départ.</p>
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors"
      />
      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          disabled={!date}
          onClick={() => setStep(2)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition-all"
        >
          Continuer
        </button>
      </div>
    </div>,

    // Step 2: Time of birth
    <div key="2" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in relative">
      <ProgressBar current={2} />
      <BackButton to={1} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 2 sur 3</p>
      <h2 className="text-2xl font-bold mb-2 text-center">À quelle heure exactement ?</h2>
      <p className="text-night-400 text-sm mb-8 text-center max-w-xs">L'heure exacte détermine ton Ascendant et tes Maisons astrologiques. Sans elle, ton thème sera incomplet.</p>
      <input
        type="time" value={time} disabled={timeUnknown}
        onChange={e => setTime(e.target.value)}
        className={`w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors ${timeUnknown ? 'opacity-40' : ''}`}
      />
      <button
        onClick={() => { setTimeUnknown(!timeUnknown); if (!timeUnknown) setTime(''); }}
        className="mt-4 text-cosmic-400 text-sm underline decoration-dotted hover:text-cosmic-300 transition-colors"
      >
        {timeUnknown ? '← Entrer mon heure' : 'Je ne connais pas mon heure de naissance'}
      </button>
      {timeUnknown && (
        <p className="text-night-500 text-xs mt-3 max-w-xs text-center">
          ⚠️ Sans l'heure, l'Ascendant et les Maisons seront approximatifs (calculés à midi).
        </p>
      )}
      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          disabled={!time && !timeUnknown}
          onClick={() => setStep(3)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition-all"
        >
          Continuer
        </button>
      </div>
    </div>,

    // Step 3: Place of birth
    <div key="3" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in relative">
      <ProgressBar current={3} />
      <BackButton to={2} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 3 sur 3</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Où êtes-tu né·e ?</h2>
      <p className="text-night-400 text-sm mb-6 text-center max-w-xs">Le lieu de naissance complète ta carte du ciel.</p>

      {/* Search bar */}
      <input
        type="text" value={citySearch} placeholder="🔎 Rechercher une ville..."
        onChange={e => setCitySearch(e.target.value)}
        className="w-full max-w-xs py-3 px-4 mb-3 rounded-xl glass border border-night-700 text-night-100 text-sm focus:outline-none focus:border-cosmic-500 transition-colors"
      />

      <div className="w-full max-w-xs space-y-2 mb-4 max-h-64 overflow-y-auto">
        {filteredCities.map((c, i) => {
          const realIdx = CITIES.indexOf(c);
          const isSelected = cityIdx === realIdx;
          return (
            <button
              key={realIdx}
              onClick={() => setCityIdx(realIdx)}
              className={`w-full py-3 px-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                isSelected
                  ? 'glass border-2 border-gold-500 bg-gold-500/10 shadow-md shadow-gold-900/30'
                  : 'glass border border-transparent hover:border-cosmic-500/40'
              }`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  isSelected ? 'bg-gold-500 text-night-950' : 'bg-night-800/60 text-night-600'
                }`}
              >
                {isSelected ? '✓' : ''}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-night-100">{c.city}</span>
                <span className="text-night-400 text-sm ml-2">{c.country}</span>
              </span>
            </button>
          );
        })}
        {filteredCities.length === 0 && (
          <p className="text-night-500 text-sm text-center py-4">Aucune ville trouvée. Essayez une autre recherche.</p>
        )}
      </div>

      {/* Selection confirmation banner — tells user exactly what will be used. */}
      <div className="w-full max-w-xs mb-4 px-4 py-3 rounded-2xl glass border border-gold-500/30 bg-gold-500/5 animate-fade-in">
        <p className="text-night-400 text-xs uppercase tracking-widest mb-1">Ville sélectionnée</p>
        <p className="text-gold-300 text-sm font-medium">
          ✦ {CITIES[cityIdx].city}, {CITIES[cityIdx].country}
        </p>
        <p className="text-night-500 text-xs mt-1">
          Fuseau UTC{CITIES[cityIdx].tz >= 0 ? '+' : ''}{CITIES[cityIdx].tz} · {CITIES[cityIdx].lat.toFixed(2)}°, {CITIES[cityIdx].lng.toFixed(2)}°
        </p>
      </div>

      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 text-night-950 font-semibold text-lg shadow-lg shadow-gold-900/50 transition-all"
        >
          Révéler mon thème ✨
        </button>
      </div>
    </div>,

    // Step 4: Calculating
    <div key="4" className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-fade-in">
      {calculating ? (
        <>
          <div className="relative mb-8">
            <svg width="120" height="120" viewBox="0 0 120 120" className="animate-spin-slow">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#383964" strokeWidth="1" />
              <circle cx="60" cy="60" r="35" fill="none" stroke="#56589c" strokeWidth="1" />
              <circle cx="60" cy="60" r="20" fill="none" stroke="#a855f7" strokeWidth="1" />
              <circle cx="60" cy="10" r="3" fill="#fbbf24" />
              <circle cx="60" cy="60" r="4" fill="#fcd34d" opacity="0.8" />
              <circle cx="90" cy="60" r="2" fill="#c084fc" />
              <circle cx="60" cy="95" r="2" fill="#a855f7" />
              <circle cx="25" cy="60" r="2" fill="#757bc4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-3 text-gold-gradient">Calcul de ton thème natal</h2>
          <p className="text-night-400 text-sm">Analyse des positions planétaires...</p>
          <div className="mt-8 space-y-2 text-night-500 text-xs">
            <p className="animate-fade-in" style={{ animationDelay: '0.3s' }}>◆ Position du Soleil</p>
            <p className="animate-fade-in" style={{ animationDelay: '0.8s' }}>◆ Position de la Lune</p>
            <p className="animate-fade-in" style={{ animationDelay: '1.3s' }}>◆ Calcul de l'Ascendant</p>
            <p className="animate-fade-in" style={{ animationDelay: '1.8s' }}>◆ Répartition des Maisons</p>
          </div>
        </>
      ) : null}
    </div>,
  ];

  return steps[step] || steps[0];
}
