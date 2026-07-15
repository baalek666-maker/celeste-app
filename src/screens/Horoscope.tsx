import { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { api } from '../lib/api';
import { getCachedHoroscope, cacheHoroscope, localISODate } from '../lib/storage';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { useFavorites } from '../lib/useFavorites';
import ShareCard from '../components/ShareCard';
import SkyMap from '../components/SkyMap';
import { toast } from '../components/Toast';
import HoroscopeFeedback from '../components/HoroscopeFeedback';

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
  const [isFallback, setIsFallback] = useState(false);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  // Week strip state (Feature 2)
  const [week, setWeek] = useState<any[] | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekError, setWeekError] = useState('');
  const [activeSection, setActiveSection] = useState<'general' | 'love' | 'career'>('general');
  const today = localISODate();
  const todayFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const msgIdx = useRef(0);

  // 30s — laisse le temps au LLM + retry backoff (3 essais × ~7s max)
  const HOROSCOPE_TIMEOUT_MS = 30000;

  // P9: Get last cached horoscope of ANY date (offline fallback)
  const getLastCachedHoroscope = (): { entry: any; date: string } | null => {
    try {
      const raw = localStorage.getItem('celeste_horo_cache');
      if (!raw) return null;
      const cache = JSON.parse(raw);
      if (!cache || typeof cache !== 'object') return null;
      const dates = Object.keys(cache).sort().reverse(); // most recent first
      for (const d of dates) {
        if (cache[d]) return { entry: cache[d], date: d };
      }
    } catch { /* ignore */ }
    return null;
  };

  const buildEntry = (h: any) => ({
    date: today,
    general: h.general,
    love: h.amour,
    career: h.carriere,
    energy: h.energie,
    mood: h.mood,
    luckyNumber: h.luckyNumber,
    luckyColor: h.luckyColor,
    isFallback: !!h.isFallback,
  });

  const fetchHoroscope = (force: boolean, cancelledRef: { value: boolean } = { value: false }) => {
    if (!force) {
      const cached = getCachedHoroscope(today);
      if (cached) {
        if (cancelledRef.value) return;
        setHoroscope(cached);
        setIsFallback(false);
        setIsOfflineCache(false);
        setLoading(false);
        return;
      }
    }
    if (cancelledRef.value) return;
    setLoading(true);
    setError('');
    setIsOfflineCache(false);

    // Timeout guard: si le backend hang (LLM lent), on surface une erreur claire après 30s.
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("L'horoscope met trop de temps à arriver. Réessaie dans un instant.")),
        HOROSCOPE_TIMEOUT_MS,
      );
    });

    Promise.race([api.getHoroscope(), timeoutPromise])
      .then(h => {
        if (cancelledRef.value) return;
        const entry = buildEntry(h);
        setHoroscope(entry);
        setIsFallback(!!h.isFallback);
        cacheHoroscope(today, entry);
        setLoading(false);
      })
      .catch(err => {
        if (cancelledRef.value) return;
        console.error('[DEBUG HOROSCOPE] Error:', err?.message, err?.status, JSON.stringify(err));
        const raw = (err?.message || '').toLowerCase();
        let msg = err.message || 'Erreur';
        if (raw.includes('429') || raw.includes('rate limit') || raw.includes('limite')) {
          msg = "Les étoiles sont momentanément surchargées. Réessaie dans 1 minute ✦";
        } else if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('load failed')) {
          msg = 'Connexion aux étoiles interrompue. Vérifie ton réseau.';
        }
        // P9: Offline fallback — try to show last cached horoscope
        const lastCached = getLastCachedHoroscope();
        if (lastCached) {
          console.warn('[horoscope] Network failed, showing offline cache from', lastCached.date);
          setHoroscope(lastCached.entry);
          setIsOfflineCache(true);
          setIsFallback(false);
          setLoading(false);
          return;
        }
        setError(msg);
        setLoading(false);
      });
  };

  useEffect(() => {
    const cancelledRef = { value: false };
    fetchHoroscope(false, cancelledRef);
    return () => { cancelledRef.value = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // Feature 2: load week strip after main horoscope is shown
  useEffect(() => {
    if (loading || !horoscope) return;
    let cancelled = false;
    setLoadingWeek(true);
    setWeekError('');
    api.getWeekHoroscope()
      .then(data => { if (!cancelled) setWeek(data.days); })
      .catch(err => { if (!cancelled) setWeekError(err?.message || 'Erreur chargement semaine'); })
      .finally(() => { if (!cancelled) setLoadingWeek(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, horoscope]);

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
        const entry = buildEntry(h);
        setHoroscope(entry);
        setIsFallback(!!h.isFallback);
        setIsOfflineCache(false);
        if (typeof h.streak === 'number') setStreak(h.streak);
        cacheHoroscope(today, entry);
        toast.success('Horoscope rafraîchi');
      })
      .catch(err => {
        setError(err.message || 'Erreur');
        toast.error('Impossible de rafraîchir');
      })
      .finally(() => setRefreshing(false));
  };

  const [shareOpen, setShareOpen] = useState(false);
  const { isFavorited, toggle: toggleFav } = useFavorites();

  const handleToggleFav = async (section: 'general' | 'love' | 'career', content: string) => {
    try {
      await toggleFav(today, section, content);
    } catch (err) {
      console.warn('toggle fav failed', err);
    }
  };

  const handleShare = async () => {
    // Ouvre la carte visuelle à partager (Feature 4)
    if (!horoscope) return;
    setShareOpen(true);
  };

  if (loading) {
    return (
      <div className="px-5 pt-12 pb-4 relative z-10" role="status" aria-label="Chargement de l'horoscope">
        {/* Header placeholder */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        {/* Animated cosmic SVG + rotating message */}
        <div className="flex flex-col items-center mb-8">
          <svg width="64" height="64" viewBox="0 0 80 80" className="animate-spin-slow mb-4">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#383964" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="24" fill="none" stroke="#56589c" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="14" fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.5" />
            <circle cx="40" cy="6" r="2" fill="#fbbf24" />
            <circle cx="40" cy="40" r="3" fill="#fcd34d" opacity="0.6" />
            <circle cx="74" cy="40" r="1.5" fill="#c084fc" />
            <circle cx="40" cy="74" r="1.5" fill="#a855f7" />
            <circle cx="6" cy="40" r="1.5" fill="#757bc4" />
          </svg>
          <p key={loadingMsg} className="text-night-400 text-xs animate-fade-in">{loadingMsg}</p>
        </div>
        {/* Skeleton cards preview */}
        <SkeletonCard lines={4} className="mb-4" />
        <SkeletonCard lines={3} className="mb-4" />
        <SkeletonCard lines={2} className="mb-4" />
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
  const safeEnergy = Math.max(0, Math.min(5, horoscope.energie ?? horoscope.energy ?? 3));
  const energyBars = '◆'.repeat(safeEnergy) + '◇'.repeat(5 - safeEnergy);

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

      {/* P9 — Offline cache badge */}
      {isOfflineCache && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex items-center gap-2 animate-fade-in">
          <span className="text-base">📡</span>
          <p className="text-amber-200 text-xs">
            Hors ligne — dernier horoscope consulté. Reconnecte-toi pour celui d'aujourd'hui.
          </p>
        </div>
      )}

      {/* P3 — Fallback LLM badge (discret) */}
      {isFallback && !isOfflineCache && (
        <div className="mb-4 px-3 py-1.5 rounded-xl border border-night-600/50 bg-night-800/40 inline-flex items-center gap-1.5 animate-fade-in">
          <span className="text-[10px] text-night-400">✦ Contenu de référence — cosmique simplifié</span>
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
          <p className="text-night-300 text-sm mt-1">{safeEnergy}/5</p>
        </div>
        <div className="glass rounded-2xl p-4 card-glow animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌙</span>
            <p className="text-night-400 text-xs uppercase tracking-widest">Humeur</p>
          </div>
          <p className="text-cosmic-300 text-lg font-medium">{horoscope.mood || '—'}</p>
        </div>
      </div>

      {/* Sky map (Feature 6) */}
      <SkyMap />

      {/* Section Tabs */}
      <div className="mb-5">
        {/* Tab bar — iOS segmented control style */}
        <div className="flex gap-1 glass rounded-2xl p-1.5 mb-4">
          {([
            { key: 'general', label: 'Général', icon: '✦' },
            { key: 'love', label: 'Amour', icon: '♥' },
            { key: 'career', label: 'Carrière', icon: '★' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeSection === tab.key
                  ? 'glass-dark text-gold-400 shadow-lg'
                  : 'text-night-400 hover:text-night-200'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active content */}
        {activeSection === 'general' && (
          <div className="glass rounded-3xl p-5 animate-fade-in card-glow" key="general">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✦</span>
                <p className="text-gold-400 text-xs uppercase tracking-widest">Général</p>
              </div>
              <button
                onClick={() => handleToggleFav('general', horoscope.general)}
                className="text-lg px-2 py-1 rounded-lg hover:bg-night-800/50 active:scale-90 transition-all"
                aria-label={isFavorited('general') ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                {isFavorited('general') ? '★' : '☆'}
              </button>
            </div>
            <p className="text-night-100 leading-relaxed">{horoscope.general || '—'}</p>
          </div>
        )}

        {activeSection === 'love' && (
          <div className="glass rounded-3xl p-5 animate-fade-in card-glow" key="love" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">♥</span>
                <p className="text-cosmic-300 text-xs uppercase tracking-widest">Amour</p>
              </div>
              <button
                onClick={() => handleToggleFav('love', horoscope.love)}
                className="text-lg px-2 py-1 rounded-lg hover:bg-night-800/50 active:scale-90 transition-all"
                aria-label={isFavorited('love') ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                {isFavorited('love') ? '★' : '☆'}
              </button>
            </div>
            <p className="text-night-100 leading-relaxed">{horoscope.love || '—'}</p>
          </div>
        )}

        {activeSection === 'career' && (
          <div className="glass rounded-3xl p-5 animate-fade-in card-glow" key="career" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">★</span>
                <p className="text-gold-400 text-xs uppercase tracking-widest">Carrière</p>
              </div>
              <button
                onClick={() => handleToggleFav('career', horoscope.career)}
                className="text-lg px-2 py-1 rounded-lg hover:bg-night-800/50 active:scale-90 transition-all"
                aria-label={isFavorited('career') ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                {isFavorited('career') ? '★' : '☆'}
              </button>
            </div>
            <p className="text-night-100 leading-relaxed">{horoscope.career || '—'}</p>
          </div>
        )}
      </div>

      {/* Lucky */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass rounded-2xl p-4 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="text-2xl mb-1">🎲</div>
          <p className="text-night-400 text-xs mb-1">Numéro chance</p>
          <p className="text-gold-400 text-2xl font-bold">{horoscope.luckyNumber || '—'}</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <div className="text-2xl mb-1">🎨</div>
          <p className="text-night-400 text-xs mb-1">Couleur du jour</p>
          <p className="text-cosmic-300 text-lg font-medium">{horoscope.luckyColor || '—'}</p>
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

      {/* Feedback widget — improves LLM quality over time */}
      <div className="mt-6">
        <HoroscopeFeedback />
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
