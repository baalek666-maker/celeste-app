import { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { api } from '../lib/api';
import { getCachedHoroscope, cacheHoroscope } from '../lib/storage';
import ShareCard from '../components/ShareCard';

const LOADING_MESSAGES = [
  'Alignement des planètes...',
  'Lecture des transits...',
  'Interprétation du ciel...',
  'Calcul des aspects...',
  'Consultation des étoiles...',
];

export function Horoscope({ user }: { user: User }) {
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState<number>(user.streak ?? 0);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  // Week strip state (Feature 2)
  const [week, setWeek] = useState<any[] | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekError, setWeekError] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const todayFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const msgIdx = useRef(0);

  // 30s — laisse le temps au LLM + retry backoff (3 essais × ~7s max)
  const HOROSCOPE_TIMEOUT_MS = 30000;

  const fetchHoroscope = (force: boolean) => {
    if (!force) {
      const cached = getCachedHoroscope(today);
      if (cached) {
        setHoroscope(cached);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError('');

    // Timeout guard: si le backend hang (LLM lent), on surface une erreur claire après 30s.
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("L'horoscope met trop de temps à arriver. Réessaie dans un instant.")),
        HOROSCOPE_TIMEOUT_MS,
      );
    });

    Promise.race([api.getHoroscope(), timeoutPromise])
      .then(h => {
        const entry: any = {
          date: today,
          general: h.general,
          love: h.amour,
          career: h.carriere,
          energy: h.energie,
          mood: h.mood,
          luckyNumber: h.luckyNumber,
          luckyColor: h.luckyColor,
        };
        setHoroscope(entry);
        cacheHoroscope(today, entry);
        setLoading(false);
      })
      .catch(err => {
        const raw = (err?.message || '').toLowerCase();
        let msg = err.message || 'Erreur';
        if (raw.includes('429') || raw.includes('rate limit') || raw.includes('limite')) {
          msg = "Les étoiles sont momentanément surchargées. Réessaie dans 1 minute ✦";
        } else if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('load failed')) {
          msg = 'Connexion aux étoiles interrompue. Vérifie ton réseau.';
        }
        setError(msg);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchHoroscope(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // Feature 2: load week strip after main horoscope is shown
  useEffect(() => {
    if (loading || !horoscope) return;
    setLoadingWeek(true);
    setWeekError('');
    api.getWeekHoroscope()
      .then(data => setWeek(data.days))
      .catch(err => setWeekError(err?.message || 'Erreur chargement semaine'))
      .finally(() => setLoadingWeek(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, horoscope != null]);

  // Cycle loading messages while loading
  useEffect(() => {
    if (!loading) {
      msgIdx.current = 0;
      setLoadingMsg(LOADING_MESSAGES[0]);
      return;
    }
    const interval = setInterval(() => {
      msgIdx.current = (msgIdx.current + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx.current]);
    }, 1600);
    return () => clearInterval(interval);
  }, [loading]);

  const handleRefresh = () => {
    if (loading || refreshing) return;
    setRefreshing(true);
    // Bypass cache
    api.getHoroscope()
      .then(h => {
        const entry: any = {
          date: today,
          general: h.general,
          love: h.amour,
          career: h.carriere,
          energy: h.energie,
          mood: h.mood,
          luckyNumber: h.luckyNumber,
          luckyColor: h.luckyColor,
        };
        setHoroscope(entry);
        if (typeof h.streak === 'number') setStreak(h.streak);
        cacheHoroscope(today, entry);
      })
      .catch(err => setError(err.message || 'Erreur'))
      .finally(() => setRefreshing(false));
  };

  const [shareOpen, setShareOpen] = useState(false);

  const handleShare = async () => {
    // Ouvre la carte visuelle à partager (Feature 4)
    if (!horoscope) return;
    setShareOpen(true);
  };

  if (loading) {
    return (
      <div className="px-5 pt-12 flex flex-col items-center justify-center min-h-[60vh] relative z-10">
        <svg width="80" height="80" viewBox="0 0 80 80" className="animate-spin-slow mb-6">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#383964" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="24" fill="none" stroke="#56589c" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="14" fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.5" />
          <circle cx="40" cy="6" r="2" fill="#fbbf24" />
          <circle cx="40" cy="40" r="3" fill="#fcd34d" opacity="0.6" />
          <circle cx="74" cy="40" r="1.5" fill="#c084fc" />
          <circle cx="40" cy="74" r="1.5" fill="#a855f7" />
          <circle cx="6" cy="40" r="1.5" fill="#757bc4" />
        </svg>
        <p key={loadingMsg} className="text-night-400 text-sm animate-fade-in">{loadingMsg}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 pt-12 flex flex-col items-center justify-center min-h-[60vh] relative z-10">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button onClick={() => { setLoading(true); setError(''); window.location.reload(); }}
          className="px-6 py-3 rounded-2xl glass border border-night-600 text-night-200 hover:border-cosmic-500/50 transition-colors">
          Réessayer
        </button>
      </div>
    );
  }

  if (!horoscope) return null;
  const energyBars = '◆'.repeat(horoscope.energy) + '◇'.repeat(5 - horoscope.energy);

  return (
    <div className="px-5 pt-12 pb-4 relative z-10">
      {/* Streak banner */}
      {streak >= 1 && (
        <div className="glass-gold rounded-2xl px-4 py-2.5 mb-5 flex items-center justify-between border border-gold-500/30 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xl">{streak >= 2 ? '🔥' : '✨'}</span>
            <div>
              <p className="text-gold-400 text-sm font-semibold">
                {streak >= 2 ? `${streak} jours d'affilée` : 'Premier jour de constellation'}
              </p>
              <p className="text-night-400 text-xs">
                {streak >= 7 ? 'Vous brillez avec constance.' : streak >= 2 ? 'Continuez, l\'univers vous remarque.' : 'Revenez demain pour allonger la série.'}
              </p>
            </div>
          </div>
          {streak >= 7 && (
            <span className="text-xs text-gold-300 font-bold tracking-wider">CONSTELLATION</span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-night-400 text-sm capitalize mb-1">{todayFr}</p>
          <h1 className="text-2xl font-bold text-gold-gradient">Votre horoscope</h1>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            aria-label="Partager"
            className="w-10 h-10 rounded-full glass flex items-center justify-center border border-night-700 hover:border-cosmic-500/40 transition-all active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          {/* Pull-to-refresh style button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Actualiser"
            className="w-10 h-10 rounded-full glass flex items-center justify-center border border-night-700 hover:border-gold-500/40 transition-all active:scale-90 disabled:opacity-60"
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={refreshing ? 'animate-refresh' : ''}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Energy + Mood */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="glass rounded-2xl p-4 card-glow animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚡</span>
            <p className="text-night-400 text-xs uppercase tracking-widest">Énergie</p>
          </div>
          <p className="text-gold-400 text-lg tracking-wider">{energyBars}</p>
          <p className="text-night-300 text-sm mt-1">{horoscope.energy}/5</p>
        </div>
        <div className="glass rounded-2xl p-4 card-glow animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌙</span>
            <p className="text-night-400 text-xs uppercase tracking-widest">Humeur</p>
          </div>
          <p className="text-cosmic-300 text-lg font-medium">{horoscope.mood}</p>
        </div>
      </div>

      {/* General */}
      <div className="glass rounded-3xl p-5 mb-4 animate-fade-in card-glow">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">✦</span>
          <p className="text-gold-400 text-xs uppercase tracking-widest">Général</p>
        </div>
        <p className="text-night-100 leading-relaxed">{horoscope.general}</p>
      </div>

      {/* Love */}
      <div className="glass rounded-3xl p-5 mb-4 animate-fade-in card-glow" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">♥</span>
          <p className="text-cosmic-300 text-xs uppercase tracking-widest">Amour</p>
        </div>
        <p className="text-night-100 leading-relaxed">{horoscope.love}</p>
      </div>

      {/* Career */}
      <div className="glass rounded-3xl p-5 mb-4 animate-fade-in card-glow" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">★</span>
          <p className="text-gold-400 text-xs uppercase tracking-widest">Carrière</p>
        </div>
        <p className="text-night-100 leading-relaxed">{horoscope.career}</p>
      </div>

      {/* Lucky */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass rounded-2xl p-4 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="text-2xl mb-1">🎲</div>
          <p className="text-night-400 text-xs mb-1">Numéro chance</p>
          <p className="text-gold-400 text-2xl font-bold">{horoscope.luckyNumber}</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <div className="text-2xl mb-1">🎨</div>
          <p className="text-night-400 text-xs mb-1">Couleur du jour</p>
          <p className="text-cosmic-300 text-lg font-medium">{horoscope.luckyColor}</p>
        </div>
      </div>

      {/* Feature 2: Week strip — 7-day summary */}
      <div className="mt-8 mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-gold-300 text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
            <span className="text-base">📅</span> Cette semaine
          </h3>
          {!loadingWeek && week && (
            <span className="text-night-500 text-xs">
              {week.length} jour{week.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loadingWeek && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex-shrink-0 w-28 h-32 glass rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {weekError && !loadingWeek && (
          <div className="text-night-500 text-xs italic px-2">{weekError}</div>
        )}

        {week && week.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {week.map((day) => {
              const isToday = day.offset === 0;
              const hasError = !!day.error;
              const summary = day.summary;
              const energie = summary?.energie ?? 0;
              return (
                <div
                  key={day.date}
                  className={`flex-shrink-0 w-32 glass rounded-2xl p-3 snap-start border transition-all ${
                    isToday ? 'border-gold-500/60 bg-gold-500/5' : 'border-night-700/30'
                  } ${hasError ? 'opacity-50' : ''}`}
                >
                  <div className="text-center">
                    <p className={`text-xs uppercase tracking-wider mb-1 ${isToday ? 'text-gold-400 font-semibold' : 'text-night-400'}`}>
                      {isToday ? "Aujourd'hui" : day.weekday}
                    </p>
                    <p className={`text-xl font-bold mb-2 ${isToday ? 'text-gold-300' : 'text-cosmic-300'}`}>
                      {new Date(day.date).getDate()}
                    </p>
                    {summary ? (
                      <>
                        <div className="flex justify-center gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <span key={n} className={n <= energie ? 'text-gold-400 text-xs' : 'text-night-700 text-xs'}>●</span>
                          ))}
                        </div>
                        <p className="text-night-300 text-[11px] leading-snug line-clamp-3">
                          {summary.general}
                        </p>
                        <p className="text-night-500 text-[10px] mt-2 italic">
                          {summary.mood}
                        </p>
                      </>
                    ) : (
                      <p className="text-night-600 text-[10px] italic">Chargement...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-night-500 text-xs text-center mt-6 italic">
        Contenu proposé à titre de divertissement et de réflexion personnelle.
      </p>

      <ShareCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        data={shareOpen ? {
          date: todayFr,
          general: horoscope?.general || '',
          energy: horoscope?.energy,
          mood: horoscope?.mood,
          luckyNumber: horoscope?.luckyNumber,
          luckyColor: horoscope?.luckyColor,
        } : null}
      />
    </div>
  );
}
