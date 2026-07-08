import { useState, useEffect } from 'react';
import type { User, HoroscopeEntry } from '../types';
import { generateHoroscope } from '../lib/horoscope';
import { getCachedHoroscope, cacheHoroscope } from '../lib/storage';

export function Horoscope({ user }: { user: User }) {
  const [horoscope, setHoroscope] = useState<HoroscopeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const todayFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    const cached = getCachedHoroscope(today);
    if (cached) { setHoroscope(cached); setLoading(false); return; }
    if (!user.natalChart) return;
    generateHoroscope(user.natalChart, today).then(h => {
      setHoroscope(h);
      cacheHoroscope(today, h);
      setLoading(false);
    });
  }, [today, user.natalChart]);

  if (loading) {
    return (
      <div className="px-5 pt-12 flex flex-col items-center justify-center min-h-[60vh]">
        <svg width="80" height="80" viewBox="0 0 80 80" className="animate-spin-slow mb-6">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#383964" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="24" fill="none" stroke="#56589c" strokeWidth="0.5" />
          <circle cx="40" cy="6" r="2" fill="#fbbf24" />
          <circle cx="40" cy="40" r="3" fill="#fcd34d" opacity="0.6" />
        </svg>
        <p className="text-night-400 text-sm">Analyse des transits planétaires...</p>
      </div>
    );
  }

  if (!horoscope) return null;
  const energyBars = '◆'.repeat(horoscope.energy) + '◇'.repeat(5 - horoscope.energy);

  return (
    <div className="px-5 pt-12 pb-4">
      <p className="text-night-400 text-sm capitalize mb-1">{todayFr}</p>
      <h1 className="text-2xl font-bold mb-6 text-gold-gradient">Votre horoscope</h1>

      {/* Energy + Mood */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass rounded-2xl p-4">
          <p className="text-night-400 text-xs uppercase tracking-widest mb-2">Énergie</p>
          <p className="text-gold-400 text-lg tracking-wider">{energyBars}</p>
          <p className="text-night-300 text-sm mt-1">{horoscope.energy}/5</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-night-400 text-xs uppercase tracking-widest mb-2">Humeur</p>
          <p className="text-cosmic-300 text-lg font-medium">{horoscope.mood}</p>
        </div>
      </div>

      {/* General */}
      <div className="glass rounded-3xl p-5 mb-4 animate-fade-in">
        <p className="text-gold-400 text-xs uppercase tracking-widest mb-3">✦ Général</p>
        <p className="text-night-100 leading-relaxed">{horoscope.general}</p>
      </div>

      {/* Love */}
      <div className="glass rounded-3xl p-5 mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <p className="text-cosmic-300 text-xs uppercase tracking-widest mb-3">♥ Amour</p>
        <p className="text-night-100 leading-relaxed">{horoscope.love}</p>
      </div>

      {/* Career */}
      <div className="glass rounded-3xl p-5 mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <p className="text-leaf-400 text-xs uppercase tracking-widest mb-3">★ Carrière</p>
        <p className="text-night-100 leading-relaxed">{horoscope.career}</p>
      </div>

      {/* Lucky */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-night-400 text-xs mb-1">Numéro chance</p>
          <p className="text-gold-400 text-2xl font-bold">{horoscope.luckyNumber}</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <p className="text-night-400 text-xs mb-1">Couleur du jour</p>
          <p className="text-cosmic-300 text-lg font-medium">{horoscope.luckyColor}</p>
        </div>
      </div>

      <p className="text-night-500 text-xs text-center mt-6 italic">
        Contenu proposé à titre de divertissement et de réflexion personnelle.
      </p>
    </div>
  );
}
