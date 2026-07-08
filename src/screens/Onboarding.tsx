import { useState } from 'react';
import { calculateNatalChart } from '../lib/astrology';
import { setBirthData, setOnboarded } from '../lib/storage';
import type { User, BirthData, NatalChart } from '../types';
import { ZODIAC_SIGNS } from '../data/zodiac';

const CITIES = [
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, tz: 2 },
  { city: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357, tz: 2 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, tz: 2 },
  { city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792, tz: 2 },
  { city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573, tz: 2 },
  { city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442, tz: 2 },
  { city: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536, tz: 2 },
  { city: 'Strasbourg', country: 'France', lat: 48.5734, lng: 7.7521, tz: 2 },
  { city: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620, tz: 2 },
  { city: 'Montpellier', country: 'France', lat: 43.6109, lng: 3.8772, tz: 2 },
  { city: 'Rennes', country: 'France', lat: 48.1173, lng: -1.6778, tz: 2 },
  { city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517, tz: 2 },
  { city: 'Genève', country: 'Suisse', lat: 46.2044, lng: 6.1432, tz: 2 },
  { city: 'Montréal', country: 'Canada', lat: 45.5017, lng: -73.5673, tz: -4 },
];

export function Onboarding({ onComplete }: { onComplete: (u: User) => void }) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [cityIdx, setCityIdx] = useState(0);
  const [calculating, setCalculating] = useState(false);

  const handleSubmit = () => {
    setCalculating(true);
    const c = CITIES[cityIdx];
    const birth: BirthData = { date, time, city: c.city, country: c.country, latitude: c.lat, longitude: c.lng, timezone: c.tz };

    setTimeout(() => {
      const chart = calculateNatalChart(birth);
      setBirthData(birth, chart);
      setOnboarded();
      const user = JSON.parse(localStorage.getItem('celeste_user') || '{}');
      onComplete(user);
    }, 2500);
  };

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
      <p className="text-night-300 text-lg mb-2">Votre carte du ciel,</p>
      <p className="text-night-300 text-lg mb-12">votre miroir intérieur</p>
      <p className="text-night-400 text-sm mb-12 max-w-xs">
        Une astrologie profondément personnelle. Pas de texte générique — chaque mot est calculé à partir de vos planètes réelles.
      </p>
      <button
        onClick={() => setStep(1)}
        className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-lg shadow-lg shadow-cosmic-900/50 hover:shadow-cosmic-700/50 transition-all animate-glow"
      >
        Commencer
      </button>
    </div>,

    // Step 1: Date of birth
    <div key="1" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in">
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 1 sur 3</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Quand êtes-vous né·e ?</h2>
      <p className="text-night-400 text-sm mb-8 text-center max-w-xs">La position des planètes change chaque jour. Votre date de naissance est le point de départ.</p>
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
    <div key="2" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in">
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 2 sur 3</p>
      <h2 className="text-2xl font-bold mb-2 text-center">À quelle heure exactement ?</h2>
      <p className="text-night-400 text-sm mb-8 text-center max-w-xs">L'heure exacte détermine votre Ascendant et vos Maisons astrologiques. Sans elle, votre thème sera incomplet.</p>
      <input
        type="time" value={time} onChange={e => setTime(e.target.value)}
        className="w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors"
      />
      <p className="text-night-500 text-xs mt-4 max-w-xs text-center">
        💡 Sur votre acte de naissance ou en demandant à vos parents
      </p>
      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          disabled={!time}
          onClick={() => setStep(3)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition-all"
        >
          Continuer
        </button>
      </div>
    </div>,

    // Step 3: Place of birth
    <div key="3" className="flex flex-col items-center justify-center min-h-screen px-8 animate-fade-in">
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 3 sur 3</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Où êtes-vous né·e ?</h2>
      <p className="text-night-400 text-sm mb-8 text-center max-w-xs">Le lieu de naissance complète votre carte du ciel.</p>
      <div className="w-full max-w-xs space-y-2 mb-4 max-h-72 overflow-y-auto">
        {CITIES.map((c, i) => (
          <button
            key={i}
            onClick={() => setCityIdx(i)}
            className={`w-full py-3 px-4 rounded-xl text-left transition-all ${cityIdx === i ? 'glass border border-cosmic-500' : 'glass border border-transparent'}`}
          >
            <span className="text-night-100">{c.city}</span>
            <span className="text-night-400 text-sm ml-2">{c.country}</span>
          </button>
        ))}
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
          <h2 className="text-xl font-bold mb-3 text-gold-gradient">Calcul de votre thème natal</h2>
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
