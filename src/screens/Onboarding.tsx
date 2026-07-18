import { useState } from 'react';
import { calculateNatalChart } from '../lib/astrology';
import { setBirthData, setOnboarded } from '../lib/storage';
import { api } from '../lib/api';
import type { User, BirthData, NatalChart } from '../types';
import { toast } from '../components/Toast';
import { CitySearch } from '../components/CitySearch';
import type { GeoPlace } from '../lib/geocode';

// P0#2 — 117 villes hardcodées supprimées. Remplacées par geocoding OSM Nominatim
// via <CitySearch /> (composant réutilisable). Plus aucun blocage géographique :
// n'importe quel lieu francophone (Sénégal, Liban, Vietnam, Antilles...) est trouvable.

export function Onboarding({ onComplete }: { onComplete: (u: User) => void }) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GeoPlace | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleSubmit = () => {
    if (!selectedPlace) return;
    setCalculating(true);
    const c = selectedPlace;
    const finalTime = timeUnknown ? '12:00' : time;
    const birth: BirthData = {
      date, time: finalTime, city: c.city, country: c.country,
      latitude: c.latitude, longitude: c.longitude, timezone: c.tzOffset,
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

  // Step indicator (P1 — segments glass + gold avec labels, vs simple dots)
  const STEP_LABELS = ['Bienvenue', 'Tes infos', 'Ton thème'];
  const ProgressBar = ({ current }: { current: number }) => (
    <div className="fixed top-0 left-0 right-0 px-6 pt-5 z-50">
      {/* Segmented progress */}
      <div className="flex gap-1.5 mb-2">
        {STEP_LABELS.map((_, n) => (
          <div key={n} className="flex-1 h-1.5 rounded-full bg-night-800/80 overflow-hidden backdrop-blur-sm">
            <div
              className={`h-full bg-gradient-to-r from-cosmic-500 via-cosmic-400 to-gold-400 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(251,191,36,0.4)] ${
                current >= n ? 'w-full' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>
      {/* Step labels */}
      <div className="flex justify-between">
        {STEP_LABELS.map((label, n) => (
          <p key={label} className={`text-[10px] uppercase tracking-wider transition-colors ${
            current === n
              ? 'text-gold-400 font-semibold'
              : current > n
                ? 'text-night-300'
                : 'text-night-700'
          }`}>
            {label}
          </p>
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
        Une astrologie qui te parle à toi. Pas de texte recyclé — chaque mot est calculé à partir de tes planètes réelles.
      </p>
      {/* P10 — Explain free tier upfront to set expectations */}
      <div className="glass rounded-2xl px-5 py-4 mb-8 max-w-xs border border-gold-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🎁</span>
          <span className="text-gold-400 text-sm font-semibold">7 lectures offertes</span>
        </div>
        <p className="text-night-400 text-xs leading-relaxed text-left">
          Horoscope, compatibilité, portrait astral — explore tout le potentiel de Céleste sans payer. Sans carte bancaire.
        </p>
      </div>
      {/* P3 — 3 mini-cartes preview avant le CTA : montre ce qui t'attend */}
      <div className="w-full max-w-xs mb-8">
        <p className="text-night-500 text-xs uppercase tracking-widest mb-3 text-center">Tu vas découvrir</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '✦', title: 'Horoscope', sub: 'quotidien', gradient: 'from-cosmic-500/30 to-cosmic-500/10' },
            { icon: '☽', title: 'Portrait', sub: 'cosmique', gradient: 'from-gold-500/30 to-gold-500/10' },
            { icon: '♡', title: 'Compatibilité', sub: 'deux ciels', gradient: 'from-rose-500/25 to-rose-500/5' },
          ].map((card, idx) => (
            <div
              key={card.title}
              className={`glass rounded-2xl p-3 text-center border border-white/10 bg-gradient-to-br ${card.gradient} animate-fade-in`}
              style={{ animationDelay: `${0.15 + idx * 0.12}s` }}
            >
              <div className="text-2xl mb-1.5">{card.icon}</div>
              <p className="text-white text-xs font-semibold leading-tight">{card.title}</p>
              <p className="text-night-400 text-[10px] mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setStep(1)}
        className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-lg shadow-lg shadow-cosmic-900/50 hover:shadow-cosmic-700/50 transition-all animate-glow"
      >
        Commencer
      </button>
    </div>,

    // Step 1: Date + Time of birth (merged — was 2 separate steps)
    <div key="1" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in relative">
      <ProgressBar current={1} />
      <BackButton to={0} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 1 sur 2</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Quand es-tu né·e ?</h2>
      <p className="text-night-400 text-sm mb-8 text-center max-w-xs">
        La position des planètes change chaque jour, chaque heure. Ta date et l'heure de naissance donnent ton Ascendant.
      </p>

      {/* Date input */}
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors mb-3"
      />

      {/* Time input + unknown toggle */}
      <button
        onClick={() => { setTimeUnknown(!timeUnknown); if (!timeUnknown) setTime(''); }}
        className={`w-full max-w-xs mb-3 py-3 rounded-2xl border text-sm font-medium transition-all ${timeUnknown ? 'glass border-cosmic-500 text-cosmic-300' : 'glass border-night-700 text-night-300 hover:border-cosmic-500/50'}`}
      >
        {timeUnknown ? '✓ Je ne connais pas mon heure' : '🕐 Je ne connais pas mon heure de naissance'}
      </button>
      <input
        type="time" value={time} disabled={timeUnknown}
        onChange={e => setTime(e.target.value)}
        className={`w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors mb-2 ${timeUnknown ? 'opacity-40' : ''}`}
      />
      {timeUnknown && (
        <p className="text-night-500 text-xs mt-1 max-w-xs text-center mb-2">
          ⚠️ Sans l'heure, l'Ascendant et les Maisons seront approximatifs (calculés à midi).
        </p>
      )}

      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          disabled={!date || (!time && !timeUnknown)}
          onClick={() => setStep(2)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition-all"
        >
          Continuer
        </button>
      </div>
    </div>,

    // Step 2: Place of birth (P0#2 — CitySearch remplace la liste hardcodée)
    <div key="2" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in relative">
      <ProgressBar current={2} />
      <BackButton to={1} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 2 sur 2</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Où es-tu né·e ?</h2>
      <p className="text-night-400 text-sm mb-6 text-center max-w-xs">
        Le lieu de naissance complète ta carte du ciel. Tape ta ville — partout dans le monde.
      </p>

      <div className="w-full max-w-xs">
        <CitySearch
          onSelect={setSelectedPlace}
          value={selectedPlace}
          placeholder="🔎 Paris, Dakar, Saigon..."
        />
      </div>

      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          disabled={!selectedPlace}
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 disabled:opacity-30 disabled:cursor-not-allowed text-night-950 font-semibold text-lg shadow-lg shadow-gold-900/50 transition-all"
        >
          Révéler mon thème ✨
        </button>
      </div>
    </div>,

    // Step 3: Calculating (was step 4)
    <div key="3" className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-fade-in">
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
