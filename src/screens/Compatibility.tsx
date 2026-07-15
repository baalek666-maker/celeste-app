import { useState } from 'react';
import type { User, ZodiacSign, BirthData, CompatibilityResult } from '../types';
import { api } from '../lib/api';
import { ZODIAC_SIGNS, ZODIAC_ORDER } from '../data/zodiac';
import { Skeleton, SkeletonCard } from '../components/Skeleton';

// Representative dates per sign (used in quick mode as approximation only).
// NOTE: in quick mode the moon is computed by the backend from this date, so
// the partner's moon sign returned is genuine for that date — not a fake.
const SIGN_REPRESENTATIVE_DATES: Record<string, string> = {
  aries: '2000-04-05', taurus: '2000-05-05', gemini: '2000-06-05',
  cancer: '2000-07-05', leo: '2000-08-05', virgo: '2000-09-05',
  libra: '2000-10-05', scorpio: '2000-11-05', sagittarius: '2000-12-05',
  capricorn: '2000-01-05', aquarius: '2000-02-05', pisces: '2000-03-05',
};

// Simplified: user enters partner's date + place (like onboarding-lite)
const CITIES = [
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, tz: 2 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, tz: 2 },
  { city: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357, tz: 2 },
  { city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442, tz: 2 },
  { city: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620, tz: 2 },
  { city: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536, tz: 2 },
  { city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792, tz: 2 },
  { city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573, tz: 2 },
  { city: 'Genève', country: 'Suisse', lat: 46.2044, lng: 6.1432, tz: 2 },
  { city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517, tz: 2 },
  { city: 'Montréal', country: 'Canada', lat: 45.5017, lng: -73.5673, tz: -4 },
  { city: 'New York', country: 'États-Unis', lat: 40.7128, lng: -74.0060, tz: -4 },
  { city: 'Londres', country: 'Royaume-Uni', lat: 51.5074, lng: -0.1278, tz: 1 },
  { city: 'Berlin', country: 'Allemagne', lat: 52.5200, lng: 13.4050, tz: 2 },
];

export function Compatibility({ user }: { user: User }) {
  const [mode, setMode] = useState<'quick' | 'detailed'>('quick');
  const [context, setContext] = useState<'romantic' | 'family' | 'friend' | 'colleague'>('romantic');
  const [theirSign, setTheirSign] = useState<ZodiacSign>('leo');
  const [pDate, setPDate] = useState('');
  const [pTime, setPTime] = useState('');
  const [pCityIdx, setPCityIdx] = useState(0);
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      let partnerData: BirthData;

      if (mode === 'detailed') {
        const c = CITIES[pCityIdx];
        partnerData = {
          date: pDate,
          time: pTime || '12:00',
          city: c.city,
          country: c.country,
          latitude: c.lat,
          longitude: c.lng,
          timezone: c.tz,
        };
      } else {
        // Quick mode: use a representative date for the chosen sign. The
        // backend computes a real chart for that date, so theirMoon comes
        // back genuinely calculated (not a fake).
        partnerData = {
          date: SIGN_REPRESENTATIVE_DATES[theirSign],
          time: '12:00',
          city: 'Paris',
          country: 'France',
          latitude: 48.8566,
          longitude: 2.3522,
          timezone: 2,
        };
      }

      const res = await api.getCompatibility(partnerData, context);
      // Trust the backend: it returns yourMoon/theirMoon computed from real
      // birth data. Only fall back to the user/sun if the field is absent.
      setResult({
        ...res,
        yourSun: user.natalChart?.sun || 'aries',
        theirSun: theirSign,
        yourMoon: res.yourMoon ?? user.natalChart?.moon ?? 'aries',
        theirMoon: res.theirMoon ?? theirSign,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
  const ctxMap: Record<'romantic' | 'family' | 'friend' | 'colleague', string> = {
    romantic: '💞', family: '👨‍👩‍👧', friend: '🤝', colleague: '💼',
  };
  const ctxLabelMap: Record<'romantic' | 'family' | 'friend' | 'colleague', string> = {
    romantic: 'compatibilité', family: 'dynamique familiale', friend: 'amitié', colleague: 'dynamique pro',
  };
  const ctxKey = (result.context as 'romantic' | 'family' | 'friend' | 'colleague') || 'romantic';
  const ctxEmoji = ctxMap[ctxKey];
  const ctxLabel = ctxLabelMap[ctxKey];
    const text = `${ctxEmoji} Notre ${ctxLabel} astrale : ${result.score}% sur Céleste ! ${result.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mon analyse Céleste', text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // user cancelled or clipboard unavailable
    }
  };

  return (
    <div className="px-5 pt-12 pb-4">
      <h1 className="text-2xl font-bold mb-1 text-gold-gradient">Compatibilité</h1>
      <p className="text-night-400 text-sm mb-6">La chimie entre vous et cette personne</p>

      {!result && !loading && (
        <>
          {/* Context selector */}
          <div className="mb-5">
            <p className="text-night-400 text-xs uppercase tracking-widest mb-3">Type de relation</p>
            <div className="grid grid-cols-4 gap-2 p-1 glass rounded-2xl">
              {([
                { v: 'romantic', label: '💕 Amour', t: 'Amour' },
                { v: 'family', label: '👨‍👩‍👧 Famille', t: 'Famille' },
                { v: 'friend', label: '🤝 Ami(e)', t: 'Amitié' },
                { v: 'colleague', label: '💼 Travail', t: 'Travail' },
              ] as const).map((c) => (
                <button key={c.v} onClick={() => setContext(c.v)}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-all ${context === c.v ? 'bg-cosmic-600 text-white' : 'text-night-400'}`}
                  title={c.t}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-6 p-1 glass rounded-2xl">
            <button onClick={() => setMode('quick')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'quick' ? 'bg-cosmic-600 text-white' : 'text-night-400'}`}>
              Rapide (signe)
            </button>
            <button onClick={() => setMode('detailed')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'detailed' ? 'bg-cosmic-600 text-white' : 'text-night-400'}`}>
              Détaillé (thème)
            </button>
          </div>

          {/* You */}
          <div className="glass rounded-3xl p-6 mb-6">
            <p className="text-night-400 text-xs uppercase tracking-widest mb-4">Vous</p>
            <div className="flex items-center gap-3">
              {(() => {
                const sunSign = user.natalChart?.sun ? ZODIAC_SIGNS[user.natalChart.sun] : ZODIAC_SIGNS.aries;
                const moonSign = user.natalChart?.moon ? ZODIAC_SIGNS[user.natalChart.moon] : ZODIAC_SIGNS.cancer;
                return (
                  <>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                         style={{ background: `${sunSign.color}22` }}>
                      <span className="text-2xl" style={{ color: sunSign.color }}>
                        {sunSign.symbol}
                      </span>
                    </div>
                    <div>
                      <p className="text-night-100 font-semibold">{sunSign.name}</p>
                      <p className="text-night-400 text-xs">Soleil · {moonSign.name} Lune</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Partner input */}
          {mode === 'quick' ? (
            <div className="glass rounded-3xl p-6 mb-6">
              <p className="text-night-400 text-xs uppercase tracking-widest mb-4">Le signe solaire de l'autre</p>
              <div className="grid grid-cols-3 gap-3">
                {ZODIAC_ORDER.map((sign) => (
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
          ) : (
            <div className="glass rounded-3xl p-6 mb-6 space-y-4">
              <p className="text-night-400 text-xs uppercase tracking-widest">Date de naissance de l'autre</p>
              <input type="date" value={pDate} onChange={e => setPDate(e.target.value)}
                className="w-full py-3.5 px-4 rounded-2xl glass border border-night-700 text-night-100 focus:border-cosmic-500 focus:outline-none" />
              <input type="time" value={pTime} onChange={e => setPTime(e.target.value)}
                placeholder="Heure (optionnel)"
                className="w-full py-3.5 px-4 rounded-2xl glass border border-night-700 text-night-100 focus:border-cosmic-500 focus:outline-none" />
              <p className="text-night-400 text-xs uppercase tracking-widest">Ville</p>
              <select value={pCityIdx} onChange={e => setPCityIdx(Number(e.target.value))}
                className="w-full py-3.5 px-4 rounded-2xl glass border border-night-700 text-night-100 focus:border-cosmic-500 focus:outline-none">
                {CITIES.map((c, i) => <option key={c.city + i} value={i} className="bg-night-900">{c.city}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

          <button onClick={handleAnalyze}
            disabled={mode === 'detailed' && !pDate}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-50 text-white font-semibold text-lg transition-all">
            Analyser la compatibilité
          </button>
        </>
      )}

      {loading && (
        <div role="status" aria-label="Analyse en cours">
          <div className="flex flex-col items-center mb-6">
            <svg width="64" height="64" viewBox="0 0 80 80" className="animate-spin-slow mb-4">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#383964" strokeWidth="0.5" />
              <circle cx="40" cy="6" r="2" fill="#ec4899" />
              <circle cx="40" cy="40" r="3" fill="#c084fc" opacity="0.6" />
            </svg>
            <p className="text-night-400 text-sm">Analyse des résonances astrales...</p>
          </div>
          <div className="flex justify-center gap-4 mb-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-16 w-20 rounded-full" />
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          <SkeletonCard lines={4} className="mb-4" />
          <SkeletonCard lines={3} />
        </div>
      )}

      {result && !loading && (
        <div className="animate-fade-in">
          <div className="glass rounded-3xl p-6 mb-4 text-center">
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <span className="text-3xl block" style={{ color: ZODIAC_SIGNS[result.yourSun as ZodiacSign]?.color }}>
                  {ZODIAC_SIGNS[result.yourSun as ZodiacSign]?.symbol}
                </span>
                <p className="text-night-400 text-xs mt-1">Vous</p>
              </div>
              <div className="w-20 h-20 rounded-full glass border-2 border-gold-500/30 flex items-center justify-center">
                <span className="text-3xl font-bold text-gold-gradient">{result.score}%</span>
              </div>
              <div className="text-center">
                <span className="text-3xl block" style={{ color: ZODIAC_SIGNS[result.theirSun as ZodiacSign]?.color }}>
                  {ZODIAC_SIGNS[result.theirSun as ZodiacSign]?.symbol}
                </span>
                <p className="text-night-400 text-xs mt-1">L'autre</p>
              </div>
            </div>
            <h2 className="text-xl font-bold text-cosmic-gradient">{result.title}</h2>
          </div>

          <div className="glass rounded-3xl p-5 mb-4">
            <p className="text-night-200 leading-relaxed text-sm">{result.description}</p>
          </div>

          <button onClick={handleShare}
            className="w-full py-3 rounded-2xl glass border border-cosmic-500/40 text-cosmic-200 font-medium transition-all flex items-center justify-center gap-2 hover:border-cosmic-500/70 active:scale-[0.99] mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Partager
          </button>

          {result.strengths?.length > 0 && (
            <div className="glass rounded-3xl p-5 mb-4">
              <p className="text-leaf-400 text-sm font-medium mb-3">✦ Points forts</p>
              <ul className="space-y-2">
                {result.strengths.map((s: string, i: number) => (
                  <li key={`s-${i}-${s.slice(0, 12)}`} className="text-night-200 text-sm flex gap-2">
                    <span className="text-leaf-400">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.challenges?.length > 0 && (
            <div className="glass rounded-3xl p-5 mb-4">
              <p className="text-gold-400 text-sm font-medium mb-3">⚠ Défis</p>
              <ul className="space-y-2">
                {result.challenges.map((c: string, i: number) => (
                  <li key={`c-${i}-${c.slice(0, 12)}`} className="text-night-200 text-sm flex gap-2">
                    <span className="text-gold-400">!</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={() => setResult(null)}
            className="w-full py-3 rounded-2xl glass border border-night-600 text-night-200 font-medium transition-all">
            ← Nouvelle analyse
          </button>
        </div>
      )}
    </div>
  );
}
