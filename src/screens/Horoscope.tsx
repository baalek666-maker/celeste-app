import { useState, useEffect, useRef } from 'react';
import type { User, JournalEntry } from '../types';
import { api } from '../lib/api';
import { getCachedHoroscope, cacheHoroscope, localISODate, getJournal } from '../lib/storage';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { useFavorites } from '../lib/useFavorites';
import ShareCard from '../components/ShareCard';
import SkyMap from '../components/SkyMap';
import { toast } from '../components/Toast';
import type { Screen } from '../App';
import HoroscopeFeedback from '../components/HoroscopeFeedback';
import { api as apiLib } from '../lib/api';
import { pushService } from '../lib/pushNotifications';
import { localISODate as localDate, markHoroscopeRead } from '../lib/storage';
import EmptyState from '../components/EmptyState';
import WeeklyContentCard from '../components/WeeklyContentCard';

const LOADING_MESSAGES = [
  'Alignement des planètes...',
  'Lecture des transits...',
  'Interprétation du ciel...',
  'Calcul des aspects...',
  'Consultation des étoiles...',
];

export function Horoscope({ user, onNavigate }: { user: User; onNavigate: (s: Screen) => void }) {
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState<number>(user.streak ?? 0);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [isFallback, setIsFallback] = useState(false);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  // Week strip state (Feature 2 v13.1 — history feed)
  const [week, setWeek] = useState<any[] | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekError, setWeekError] = useState('');
  const [weekStreak, setWeekStreak] = useState(0);
  const [consultedCount, setConsultedCount] = useState(0);
  // État local : quels jours ont leur texte déplié
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const toggleExpand = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };
  const [activeSection, setActiveSection] = useState<'general' | 'love' | 'career'>('general');
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const today = localISODate();
  const todayFr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const isToday = true; // Horoscope est générée pour today — toujours "actuel"
  const msgIdx = useRef(0);
  const touchStartX = useRef<number | null>(null);

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

  // v13 — Le Rituel Quotidien : dès que l'horoscope est rendu (≥ 6s d'attention),
  // on marque la quête "horoscope" comme faite côté serveur + on révèle une bannière
  // d'opt-in push (zéro culpabilité : la valeur a été prouvée d'abord).
  const readAt = useRef<number | null>(null);
  const readMarked = useRef(false);
  const [showPushOptin, setShowPushOptin] = useState(false);
  const [pushDismissedToday, setPushDismissedToday] = useState(() => {
    try { return localStorage.getItem('celeste_push_dismissed') === localDate(); }
    catch { return false; }
  });

  useEffect(() => {
    if (loading || !horoscope || readMarked.current) return;
    if (readAt.current === null) readAt.current = Date.now();
    const elapsed = Date.now() - readAt.current;
    const delay = Math.max(0, 6000 - elapsed); // ≥ 6 secondes de lecture
    const t = setTimeout(async () => {
      if (readMarked.current) return;
      readMarked.current = true;
      markHoroscopeRead();
      try {
        const res = await apiLib.completeQuest('horoscope');
        if (res?.xpAwarded > 0) {
          toast.success(`✦ Rituel matinal +${res.xpAwarded} XP`);
        }
      } catch { /* silent — quest failure not blocking */ }
      // push opt-in : seulement si push pas déjà activé + pas dismissed aujourd'hui
      const enabled = pushService.isEnabled();
      if (!enabled && !pushDismissedToday) {
        setShowPushOptin(true);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [loading, horoscope, pushDismissedToday]);

  const handleAcceptPush = async () => {
    const ok = await pushService.requestPermission();
    setShowPushOptin(false);
    if (ok) toast.success('✦ Rappels Céleste activés — à demain');
  };
  const handleDismissPush = () => {
    setShowPushOptin(false);
    try { localStorage.setItem('celeste_push_dismissed', localDate()); } catch {}
    setPushDismissedToday(true);
  };

  // Feature 2 v13.1: load history feed after main horoscope is shown
  useEffect(() => {
    if (loading || !horoscope) return;
    let cancelled = false;
    setLoadingWeek(true);
    setWeekError('');
    api.getWeekHoroscope()
      .then(data => {
        if (cancelled) return;
        setWeek(data.days);
        setWeekStreak(data.streak ?? 0);
        setConsultedCount(data.consultedCount ?? 0);
      })
      .catch(err => { if (!cancelled) setWeekError(err?.message || 'Erreur chargement historique'); })
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

  // P1.2 — Load recent journal entries for the Horoscope↔Journal loop
  useEffect(() => {
    const loadEntries = () => {
      const all = getJournal();
      setRecentEntries(all.slice(0, 2));
    };
    loadEntries();
    // Re-load when the page becomes visible again (e.g. returning from Journal)
    const onVis = () => { if (!document.hidden) loadEntries(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

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
      <div className="px-5 pt-12 min-h-[60vh] relative z-10">
        <EmptyState
          icon="🌌"
          title="Les étoiles se dissimulent"
          subtitle={error}
          ctaLabel="Réessayer"
          onCta={() => { setLoading(true); setError(''); fetchHoroscope(true); }}
          secondaryCtaLabel="Revenir à l'accueil"
          onSecondaryCta={() => window.location.hash = '#home'}
        />
      </div>
    );
  }

  if (!horoscope) return null;
  const safeEnergy = Math.max(0, Math.min(5, horoscope.energie ?? horoscope.energy ?? 3));
  const energyBars = '◆'.repeat(safeEnergy) + '◇'.repeat(5 - safeEnergy);

  return (
    <div className="px-5 pt-12 pb-4 relative z-10">
      {/* P2#19 — Contenu hebdomadaire curated (silencieux si vide) */}
      <WeeklyContentCard />

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
                {streak >= 7 ? 'Tu brilles avec constance.' : streak >= 2 ? 'Continue, l\'univers remarque.' : 'Reviens demain pour allonger la série.'}
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
          <span className="text-[10px] text-night-400">✦ Version simplifiée du jour</span>
        </div>
      )}

      {/* v13 — Bannière opt-in push (après 1er horoscope, valeur prouvée d'abord) */}
      {showPushOptin && (
        <div className="glass-gold rounded-2xl p-4 mb-5 border border-gold-500/40 animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-gold-300 text-sm font-semibold mb-1">
                Et si on faisait de ça un rituel ?
              </p>
              <p className="text-night-300 text-xs leading-relaxed mb-3">
                Un rappel Céleste le matin — 30 secondes, juste assez pour t'aligner avant que la journée t'avale. Tu peux changer l'heure ou couper en un tap.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAcceptPush}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-gold-500/30"
                >
                  Activer
                </button>
                <button
                  onClick={handleDismissPush}
                  className="px-3 py-2 text-night-400 text-xs hover:text-night-200 transition-colors"
                >
                  Pas maintenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          {/* P1 — Date en gold + check quand aujourd'hui (signal premium) */}
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gold-400 text-sm capitalize font-medium">{todayFr}</p>
            {isToday && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gold-300 border border-gold-500/40 rounded-full px-2 py-0.5 bg-gold-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
                Aujourd'hui
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gold-gradient leading-tight">Ton horoscope</h1>
          {/* P1 — Phrase accroche émotionnelle selon le mood du jour (vs The Pattern) */}
          {horoscope.mood && (
            <p className="text-night-200 text-sm mt-2 italic leading-relaxed border-l-2 border-gold-500/40 pl-3">
              {horoscope.mood.length > 80
                ? `« ${horoscope.mood.slice(0, 80).trim().replace(/[.,;:]$/, '')}… »`
                : `« ${horoscope.mood} »`}
            </p>
          )}
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

      {/* Sky map (Feature 6) — moved to hero position, right after Énergie/Humeur */}
      <div className="mb-5">
        <SkyMap />
      </div>

      {/* Section Tabs */}
      <div className="mb-5">
        {/* Tab bar — iOS segmented control style, color-coded per section */}
        <div className="flex gap-1 glass rounded-2xl p-1.5 mb-4">
          {([
            { key: 'general', label: 'Général', icon: '✦', active: 'text-gold-300', idle: 'text-night-400', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.18)]' },
            { key: 'love', label: 'Amour', icon: '♥', active: 'text-rose-300', idle: 'text-night-400', glow: 'shadow-[0_0_20px_rgba(244,114,182,0.20)]' },
            { key: 'career', label: 'Carrière', icon: '★', active: 'text-blue-300', idle: 'text-night-400', glow: 'shadow-[0_0_20px_rgba(147,197,253,0.18)]' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeSection === tab.key
                  ? `glass-dark ${tab.active} ${tab.glow}`
                  : `${tab.idle} hover:text-night-200`
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* P2.1 — Swipeable content area */}
        <div
          className="relative overflow-hidden"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            const THRESHOLD = 50;
            const sections: typeof activeSection[] = ['general', 'love', 'career'];
            const idx = sections.indexOf(activeSection);
            if (delta > THRESHOLD && idx > 0) {
              setActiveSection(sections[idx - 1]);
            } else if (delta < -THRESHOLD && idx < sections.length - 1) {
              setActiveSection(sections[idx + 1]);
            }
            touchStartX.current = null;
          }}
        >
        {activeSection === 'general' && (
          <div className="relative rounded-3xl overflow-hidden animate-fade-in card-glow" key="general">
            {/* Gradient thématique Général — or/cosmique */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold-500/15 via-cosmic-500/8 to-transparent pointer-events-none" />
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gold-500/20 blur-2xl pointer-events-none" />
            {/* SVG décoratif — étoile filante */}
            <svg className="absolute top-3 right-3 opacity-20 pointer-events-none" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
              <circle cx="45" cy="15" r="3" fill="#fbbf24" />
              <path d="M42 18 L15 45" stroke="#fbbf24" strokeWidth="0.8" opacity="0.5" strokeDasharray="2 3" />
              <circle cx="15" cy="45" r="1.5" fill="#fbbf24" opacity="0.6" />
            </svg>
            <div className="relative glass border border-gold-500/20 rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gold-500/15 flex items-center justify-center">
                    <span className="text-base">✦</span>
                  </div>
                  <div>
                    <p className="text-gold-400 text-xs uppercase tracking-widest font-semibold">Général</p>
                    <p className="text-night-500 text-[10px]">L'énergie du jour</p>
                  </div>
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
          </div>
        )}

        {activeSection === 'love' && (
          <div className="relative rounded-3xl overflow-hidden animate-fade-in card-glow" key="love" style={{ animationDelay: '0.05s' }}>
            {/* Gradient thématique Amour — rose/cosmique */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-pink-500/8 to-transparent pointer-events-none" />
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-rose-500/20 blur-2xl pointer-events-none" />
            {/* SVG décoratif — Vénus */}
            <svg className="absolute top-3 right-3 opacity-20 pointer-events-none" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
              <circle cx="30" cy="22" r="12" fill="none" stroke="#f472b6" strokeWidth="0.8" />
              <line x1="30" y1="34" x2="30" y2="52" stroke="#f472b6" strokeWidth="0.8" />
              <line x1="22" y1="44" x2="38" y2="44" stroke="#f472b6" strokeWidth="0.8" />
            </svg>
            <div className="relative glass border border-rose-500/20 rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center">
                    <span className="text-base">♥</span>
                  </div>
                  <div>
                    <p className="text-rose-300 text-xs uppercase tracking-widest font-semibold">Amour</p>
                    <p className="text-night-500 text-[10px]">Les liens du cœur</p>
                  </div>
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
          </div>
        )}

        {activeSection === 'career' && (
          <div className="relative rounded-3xl overflow-hidden animate-fade-in card-glow" key="career" style={{ animationDelay: '0.05s' }}>
            {/* Gradient thématique Carrière — bleu/cosmique */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-cyan-500/8 to-transparent pointer-events-none" />
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
            {/* SVG décoratif — Saturne */}
            <svg className="absolute top-3 right-3 opacity-20 pointer-events-none" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
              <ellipse cx="30" cy="30" rx="18" ry="6" fill="none" stroke="#93c5fd" strokeWidth="0.8" transform="rotate(-20 30 30)" />
              <circle cx="30" cy="30" r="10" fill="none" stroke="#93c5fd" strokeWidth="0.8" />
            </svg>
            <div className="relative glass border border-blue-500/20 rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <span className="text-base">★</span>
                  </div>
                  <div>
                    <p className="text-blue-300 text-xs uppercase tracking-widest font-semibold">Carrière</p>
                    <p className="text-night-500 text-[10px]">Ton élan professionnel</p>
                  </div>
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
          </div>
        )}
        </div>
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

      {/* Feature 2 v13.1: History feed — J-7 → J, lues réelles uniquement.
          Pas de prédiction future. Chaque carte = un jour effectivement consulté.
          État vide rituel pour les jours non consultés (pas culpabilisant). */}
      <div className="mt-8 mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-gold-300 text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
            <span className="text-base">📖</span> Tes dernières lectures
          </h3>
          {!loadingWeek && week && week.length > 0 && (
            <div className="flex items-center gap-3">
              {weekStreak >= 2 && (
                <span className="text-cosmic-300 text-xs flex items-center gap-1" title={`${weekStreak} jours d'affilée`}>
                  🔥 {weekStreak}j
                </span>
              )}
              <span className="text-night-500 text-xs">
                {consultedCount}/{week.length} jour{week.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {loadingWeek && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass rounded-2xl p-4 animate-pulse h-24" />
            ))}
          </div>
        )}

        {weekError && !loadingWeek && (
          <div className="text-night-500 text-xs italic px-2">{weekError}</div>
        )}

        {week && week.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-night-300 text-sm mb-1">Pas encore d'historique.</p>
            <p className="text-night-500 text-xs italic">Demain, ton premier jour sera ici.</p>
          </div>
        )}

        {week && week.length > 0 && (
          <div className="space-y-3">
            {week.map((day) => {
              const isToday = day.offset === 0;
              const summary = day.summary;
              const energie = summary?.energie ?? 0;
              const mood = summary?.mood ?? '';
              const dateObj = new Date(day.date);
              const dayNum = dateObj.getDate();
              const monthShort = dateObj.toLocaleDateString('fr-FR', { month: 'short' });

              return (
                <div
                  key={day.date}
                  className={`glass rounded-2xl p-4 border transition-all ${
                    isToday
                      ? 'border-gold-500/60 bg-gold-500/5 shadow-lg shadow-gold-500/10'
                      : 'border-night-700/30'
                  }`}
                >
                  {/* Header : date + état */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-baseline gap-2">
                      <p className={`text-xs uppercase tracking-wider ${isToday ? 'text-gold-400 font-semibold' : 'text-night-400'}`}>
                        {isToday ? "Aujourd'hui" : day.weekdayLong || day.weekday}
                      </p>
                      <p className={`text-base font-bold ${isToday ? 'text-gold-300' : 'text-cosmic-300'}`}>
                        {dayNum} {monthShort}
                      </p>
                    </div>
                    {day.consulted ? (
                      <span className="text-cosmic-400 text-[10px] uppercase tracking-wider">Consulté</span>
                    ) : (
                      <span className="text-night-600 text-[10px] uppercase tracking-wider italic">Non ouvert</span>
                    )}
                  </div>

                  {summary ? (
                    <>
                      {/* Barre énergie 1-5 */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <span key={n} className={n <= energie ? 'text-gold-400 text-[10px]' : 'text-night-700 text-[10px]'}>●</span>
                          ))}
                        </div>
                        {mood && <span className="text-night-500 text-[10px] italic">{mood}</span>}
                      </div>

                      {/* Texte : PAS de troncature. line-clamp-2 replié, expand-on-tap */}
                      <p className={`text-night-300 text-sm leading-relaxed ${expandedDays.has(day.date) ? '' : 'line-clamp-2'}`}>
                        {summary.general}
                      </p>

                      {summary.general && summary.general.length > 100 && (
                        <button
                          onClick={() => toggleExpand(day.date)}
                          className="text-cosmic-300 text-xs mt-1 hover:text-cosmic-200 transition-colors"
                        >
                          {expandedDays.has(day.date) ? '↴ Réduire' : '↳ Lire la suite'}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-night-600 text-xs italic">
                      {isToday
                        ? 'Ouvre ton horoscope aujourd\'hui pour commencer ton journal.'
                        : 'Ce jour-là n\'a pas été consulté.'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* P1.2 — Journal ↔ Horoscope loop */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-gold-300 text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
            <span className="text-base">📔</span> Ton journal
          </h3>
          <button
            onClick={() => onNavigate('journal')}
            className="text-cosmic-300 text-xs hover:text-cosmic-200 transition-colors"
          >
            Tout voir →
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <button
            onClick={() => onNavigate('journal')}
            className="w-full glass rounded-2xl p-4 text-left border border-cosmic-500/20 hover:border-cosmic-500/40 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✍️</span>
              <div>
                <p className="text-night-100 text-sm font-medium">Note ton ressenti du jour</p>
                <p className="text-night-400 text-xs">Comment cet horoscope résonne-t-il avec toi ?</p>
              </div>
            </div>
          </button>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onNavigate('journal')}
                className="w-full glass rounded-2xl p-4 text-left border border-night-700/40 hover:border-gold-500/30 transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="text-night-300 text-xs capitalize">
                    {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {entry.userRating > 0 && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} className={n <= entry.userRating ? 'text-gold-400 text-[10px]' : 'text-night-700 text-[10px]'}>●</span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-night-100 text-sm leading-snug line-clamp-2">{entry.userNote}</p>
              </button>
            ))}
            <button
              onClick={() => onNavigate('journal')}
              className="w-full py-2.5 rounded-xl text-sm text-cosmic-300 hover:text-cosmic-200 transition-colors"
            >
              + Nouvelle entrée
            </button>
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
