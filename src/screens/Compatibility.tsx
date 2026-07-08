import { useState } from 'react';
import type { User, ZodiacSign, CompatibilityResult } from '../types';
import { generateCompatibility } from '../lib/horoscope';
import { ZODIAC_SIGNS, ZODIAC_ORDER } from '../data/zodiac';

export function Compatibility({ user }: { user: User }) {
  const [theirSign, setTheirSign] = useState<ZodiacSign>('leo');
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = () => {
    if (!user.natalChart) return;
    setLoading(true);
    generateCompatibility(user.natalChart, theirSign, theirSign).then(r => {
      setResult(r);
      setLoading(false);
    });
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-1 text-gold-gradient">Compatibilité</h1>
      <p className="text-night-400 text-sm mb-6">Découvrez la dynamique entre vous et un autre signe</p>

      {!result && !loading && (
        <>
          <div className="glass rounded-3xl p-6 mb-6">
            <p className="text-night-400 text-xs uppercase tracking-widest mb-4">Vous</p>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                   style={{ background: `${ZODIAC_SIGNS[user.natalChart?.sun!].color}22` }}>
                <span className="text-2xl" style={{ color: ZODIAC_SIGNS[user.natalChart?.sun!].color }}>
                  {ZODIAC_SIGNS[user.natalChart?.sun!].symbol}
                </span>
              </div>
              <div>
                <p className="text-night-100 font-semibold">{ZODIAC_SIGNS[user.natalChart?.sun!].name}</p>
                <p className="text-night-400 text-xs">Soleil</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 mb-6">
            <p className="text-night-400 text-xs uppercase tracking-widest mb-4">L'autre personne</p>
            <div className="grid grid-cols-3 gap-3">
              {ZODIAC_ORDER.map(sign => (
                <button key={sign} onClick={() => setTheirSign(sign)}
                  className={`py-3 rounded-xl border transition-all ${theirSign === sign ? 'glass border-cosmic-500' : 'glass border-transparent'}`}>
                  <span className="text-xl block" style={{ color: ZODIAC_SIGNS[sign].color }}>
                    {ZODIAC_SIGNS[sign].symbol}
                  </span>
                  <span className="text-night-300 text-xs">{ZODIAC_SIGNS[sign].name}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAnalyze}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-lg transition-all">
            Analyser la compatibilité
          </button>
        </>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <svg width="80" height="80" viewBox="0 0 80 80" className="animate-spin-slow mb-6">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#383964" strokeWidth="0.5" />
            <circle cx="40" cy="6" r="2" fill="#ec4899" />
            <circle cx="40" cy="40" r="3" fill="#c084fc" opacity="0.6" />
          </svg>
          <p className="text-night-400 text-sm">Analyse des résonances astrales...</p>
        </div>
      )}

      {result && !loading && (
        <div className="animate-fade-in">
          {/* Score */}
          <div className="glass rounded-3xl p-6 mb-4 text-center">
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <span className="text-3xl block" style={{ color: ZODIAC_SIGNS[result.yourSun].color }}>
                  {ZODIAC_SIGNS[result.yourSun].symbol}
                </span>
                <p className="text-night-400 text-xs mt-1">Vous</p>
              </div>
              <div className="w-20 h-20 rounded-full glass border-2 border-gold-500/30 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gold-gradient">{result.score}%</span>
              </div>
              <div className="text-center">
                <span className="text-3xl block" style={{ color: ZODIAC_SIGNS[result.theirSun].color }}>
                  {ZODIAC_SIGNS[result.theirSun].symbol}
                </span>
                <p className="text-night-400 text-xs mt-1">L'autre</p>
              </div>
            </div>
            <h2 className="text-xl font-bold text-cosmic-gradient">{result.title}</h2>
          </div>

          {/* Description */}
          <div className="glass rounded-3xl p-5 mb-4">
            <p className="text-night-200 leading-relaxed text-sm">{result.description}</p>
          </div>

          {/* Strengths */}
          <div className="glass rounded-3xl p-5 mb-4">
            <p className="text-leaf-400 text-sm font-medium mb-3">✦ Points forts</p>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="text-night-200 text-sm flex gap-2">
                  <span className="text-leaf-400">+</span>{s}
                </li>
              ))}
            </ul>
          </div>

          {/* Challenges */}
          <div className="glass rounded-3xl p-5 mb-4">
            <p className="text-gold-400 text-sm font-medium mb-3">⚠ Défis</p>
            <ul className="space-y-2">
              {result.challenges.map((c, i) => (
                <li key={i} className="text-night-200 text-sm flex gap-2">
                  <span className="text-gold-400">!</span>{c}
                </li>
              ))}
            </ul>
          </div>

          <button onClick={() => setResult(null)}
            className="w-full py-3 rounded-2xl glass border border-night-600 text-night-200 font-medium transition-all">
            ← Nouvelle analyse
          </button>
        </div>
      )}
    </div>
  );
}
