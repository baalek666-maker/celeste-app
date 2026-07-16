import { useState, useEffect, lazy, Suspense } from 'react';
import { Auth } from './screens/Auth';
import { Landing } from './screens/Landing';
import { Home } from './screens/Home';
import CelesteLogo from './components/CelesteLogo';
import { BottomNav } from './components/BottomNav';
import { getToken, clearToken, api } from './lib/api';
import { getUser, saveUser, getFreeScans, incrementFreeScans, getFreeCompat, incrementFreeCompat } from './lib/storage';
import { identifyUser, track, resetUser } from './lib/monitoring';
import { calculateNatalChart } from './lib/astrology';
import type { User } from './types';

// Code splitting : les screens secondaires sont lazy-loaded pour réduire le bundle initial.
// Onboarding charge lib/astrology.ts (~500KB astronomy-engine) — on ne le bundle que si besoin.
const ChartView = lazy(() => import('./screens/ChartView').then(m => ({ default: m.ChartView })));
const Horoscope = lazy(() => import('./screens/Horoscope').then(m => ({ default: m.Horoscope })));
const Compatibility = lazy(() => import('./screens/Compatibility').then(m => ({ default: m.Compatibility })));
const Journal = lazy(() => import('./screens/Journal').then(m => ({ default: m.Journal })));
const Paywall = lazy(() => import('./screens/Paywall').then(m => ({ default: m.Paywall })));
const Settings = lazy(() => import('./screens/Settings').then(m => ({ default: m.Settings })));
const Explorer = lazy(() => import('./screens/Explorer').then(m => ({ default: m.Explorer })));
const Onboarding = lazy(() => import('./screens/Onboarding').then(m => ({ default: m.Onboarding })));

export type Screen = 'landing' | 'auth' | 'onboarding' | 'home' | 'chart' | 'horoscope' | 'compatibility' | 'journal' | 'explorer' | 'paywall' | 'settings';

// Detect network-level failures (API unreachable) vs. auth failures.
function isNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('networkerror')
  );
}

// ─── Splash / loading screen — premium with animated logo ──
function Splash({ stuckHint }: { stuckHint?: string }) {
  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 flex items-center justify-center relative">
      <div className="fixed inset-0 aurora-bg pointer-events-none" />
      <div className="flex flex-col items-center relative z-10 animate-fade-in-scale">
        <div className="relative mb-8 animate-breathe">
          <div className="absolute inset-0 -m-6 rounded-full ripple-gold opacity-30" />
          <CelesteLogo size={96} animated />
        </div>
        <h1 className="text-3xl font-bold text-gold-gradient font-display tracking-[0.2em] mb-2">Céleste</h1>
        <p className="text-night-500 text-[10px] uppercase tracking-[0.3em] mb-6 font-body">Astrologie Intuitive</p>
        {stuckHint ? (
          <p className="text-night-400 text-xs leading-relaxed max-w-xs text-center font-body mb-4 px-4">
            {stuckHint}
          </p>
        ) : null}
        <div className="flex gap-1.5">
          <span className="splash-dot" style={{ animationDelay: '0s' }} />
          <span className="splash-dot" style={{ animationDelay: '0.16s' }} />
          <span className="splash-dot" style={{ animationDelay: '0.32s' }} />
        </div>
      </div>
    </div>
  );
}

// ─── API unreachable screen ─────────────────────────────
function ApiDown({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 flex items-center justify-center px-8 relative">
      <div className="text-center max-w-sm relative z-10 animate-fade-in-scale">
        <div className="w-20 h-20 mx-auto rounded-full glass-gold flex items-center justify-center mb-6 animate-glow border border-gold-500/30">
          {/* Silver crescent moon glyph */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round">
            <path d="M24 6a13 13 0 1 0 0 24A10.5 10.5 0 0 1 24 6z" fill="#c0c0c033" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gold-gradient font-display mb-3">Les étoiles sont hors de portée</h2>
        <p className="text-night-400 text-sm leading-relaxed mb-8 font-body">
          Céleste n'arrive pas à joindre son serveur. Vérifie ta connexion internet puis réessayez.
        </p>
        <button
          onClick={onRetry}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-night-950 font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] font-display tracking-wide"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User>(getUser());
  const [isAuthed, setIsAuthed] = useState<boolean>(!!getToken());
  const [booting, setBooting] = useState<boolean>(!!getToken());
  const [apiDown, setApiDown] = useState<boolean>(false);
  const [bootStuck, setBootStuck] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  // v9 — Listener global pour navigation depuis CTA contextuel
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent<Screen>).detail;
      if (typeof target === 'string') setScreen(target);
    };
    window.addEventListener('celeste:navigate', handler);
    return () => window.removeEventListener('celeste:navigate', handler);
  }, []);

  const retryBoot = () => {
    setApiDown(false);
    setBooting(true);
    // Trigger a fresh token check
    if (getToken()) {
      api.getProfile().then(profile => {
        const updated: User = {
          ...user,
          email: profile.email,
          isPremium: profile.isPremium,
          scansRemaining: profile.scansRemaining,
          premiumUntil: profile.premiumUntil ?? null,
        };
        if (profile.birthData) {
          updated.birthData = profile.birthData;
          if (!updated.natalChart) {
            updated.natalChart = calculateNatalChart(profile.birthData);
          }
        }
        setUser(updated);
        saveUser(updated);
        setIsAuthed(true);
        setBooting(false);
      }).catch((err) => {
        if (isNetworkError(err)) {
          setApiDown(true);
        } else {
          clearToken();
          resetUser();
          setIsAuthed(false);
        }
        setBooting(false);
      });
    } else {
      setBooting(false);
    }
  };

  // On mount: if we have a token, fetch the real profile from backend
  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }

    let cancelled = false;
    const clearCancelled = () => { cancelled = true; };

    // Hard timeout: if profile fetch takes too long (proxy hang, network slow),
    // show a hint instead of letting the splash spin forever. The cached localStorage
    // user keeps the app usable offline / behind flaky proxies.
    const stuckTimer = window.setTimeout(() => {
      // After 6s with no response, fall back to cached localStorage user so the
      // app is still usable. setBootStuck(true) shows a hint on the splash.
      if (cancelled) return;
      // 1. Use cached profile (don't force logout — user might just be on flaky proxy)
      setIsAuthed(true);
      setBooting(false);
      setBootStuck(true);
    }, 6000);

    // Retry profile fetch up to 3 times on transient network errors.
    // - Network error / timeout → retry with exponential backoff (500ms, 1s, 2s)
    // - Auth error (401 / token) → clearToken ONCE, never retry
    // - Other error → treat as API down after retries exhausted
    const fetchProfile = async () => {
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        if (cancelled) return;
        try {
          const profile = await api.getProfile();
          if (cancelled) return;
          window.clearTimeout(stuckTimer);
          const updated: User = {
            ...user,
            email: profile.email,
            isPremium: profile.isPremium,
            scansRemaining: profile.scansRemaining,
            premiumUntil: profile.premiumUntil ?? null,
            streak: profile.streak ?? user.streak ?? 0,
          };
          // If birth data is on the server, sync it
          if (profile.birthData) {
            updated.birthData = profile.birthData;
            // Recompute natalChart if missing (e.g. fresh browser, cleared localStorage)
            if (!updated.natalChart) {
              updated.natalChart = calculateNatalChart(profile.birthData);
            }
          }
          setUser(updated);
          saveUser(updated);
          setIsAuthed(true);
          setBooting(false);
          return;
        } catch (err) {
          if (cancelled) return;
          const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          const isNet = isNetworkError(err);
          // Auth failure: invalid/expired token OR deleted account → clearToken ONCE, no retry
          const isAuthFail =
            msg.includes('401') ||
            msg.includes('404') ||
            msg.includes('not found') ||
            msg.includes('unauthorized') ||
            msg.includes('token') ||
            msg.includes('forbidden');
          if (isAuthFail) {
            window.clearTimeout(stuckTimer);
            clearToken();
            resetUser();
            setIsAuthed(false);
            setBooting(false);
            return;
          }
          // Last attempt: surface ApiDown
          if (i === attempts - 1) {
            window.clearTimeout(stuckTimer);
            if (isNet) setApiDown(true);
            setBooting(false);
            return;
          }
          // Otherwise: backoff and retry
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
        }
      }
    };

    void fetchProfile();
    return () => {
      clearCancelled();
      window.clearTimeout(stuckTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route to onboarding if no birth data
  useEffect(() => {
    if (isAuthed && !user.birthData) {
      setScreen('onboarding');
    }
  }, [isAuthed, user.birthData]);

  // Safety net: if we have birthData but no natalChart (or the cached chart
  // is stale relative to a change in city/timezone without changing date+time),
  // recompute it. Persisted via saveUser() so subsequent mounts skip the work.
  const [chartError, setChartError] = useState<string | null>(null);

  const chartKey = user.birthData
    ? `${user.birthData.date}|${user.birthData.time}|${user.birthData.city}|${user.birthData.timezone}|${user.birthData.latitude.toFixed(3)}|${user.birthData.longitude.toFixed(3)}`
    : null;

  useEffect(() => {
    if (!user.birthData || !chartKey) return;
    if (user.natalChart && (user as User & { _chartKey?: string })._chartKey === chartKey) return;
    try {
      const chart = calculateNatalChart(user.birthData);
      const patched = { ...user, natalChart: chart, _chartKey: chartKey } as User;
      setUser(patched);
      saveUser(patched);
      setChartError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[App] Failed to compute natalChart:', msg);
      setChartError(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey]);

  const handleNavigate = (s: Screen) => {
    // P1.3 — Guest mode: horoscope/chart/compatibility require birth data → onboarding
    if (isGuest && !user.birthData) {
      if (s === 'horoscope' || s === 'chart' || s === 'compatibility') {
        setScreen('onboarding');
        return;
      }
    }
    if (!user.isPremium) {
      // Horoscope: 3 free consultations, then paywall
      if (s === 'horoscope') {
        if (getFreeScans() >= 3) {
          setScreen('paywall');
          return;
        }
        incrementFreeScans();
      }
      // Compatibility: 1 free analysis, then paywall
      if (s === 'compatibility') {
        if (getFreeCompat() >= 1) {
          setScreen('paywall');
          return;
        }
        incrementFreeCompat();
      }
      // Journal: always allowed (read & write)
    }
    setScreen(s);
  };

  // Fix #3 — Listener postMessage du Service Worker.
  // Quand l'user clique une notification push (sw.js envoie
  // { type: 'NAVIGATE', screen }), on dispatch vers l'écran demandé.
  // Whitelist stricte des écrans connus pour éviter du state poisoning.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const VALID: ReadonlyArray<Screen> = [
      'landing', 'auth', 'onboarding', 'home', 'chart', 'horoscope',
      'compatibility', 'journal', 'explorer', 'paywall', 'settings',
    ];
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'NAVIGATE') return;
      const target = data.screen;
      if (typeof target !== 'string' || !VALID.includes(target as Screen)) return;
      // Si l'user n'est pas auth, envoyer vers landing ou auth plutôt que l'écran direct
      if (!isAuthed && target !== 'landing' && target !== 'auth') return;
      handleNavigate(target as Screen);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [isAuthed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Splash while verifying token ───
  if (booting) {
    return <Splash stuckHint={bootStuck ? "Connexion lente… on affiche quand même ton profil (mis en cache local)." : undefined} />;
  }

  // ─── API unreachable: clear message instead of blank page ───
  if (apiDown) {
    return <ApiDown onRetry={retryBoot} />;
  }

  // ─── NOT AUTHED: Landing first visit, Auth for returning users ───
  if (!isAuthed && !isGuest) {
    if (screen === 'onboarding' && getToken()) {
      // Token exists after onboarding-stage signup — wait for effect
      return <Splash />;
    }
    // Show Auth screen if user clicked "Connexion" or set screen to a non-landing state
    if (screen === 'auth') {
      return (
        <Auth onSuccess={(serverUser) => {
          identifyUser(serverUser.id, { email: serverUser.email, isPremium: serverUser.isPremium });
          track('user_logged_in');
          const updated: User = {
            ...user,
            email: serverUser.email,
            isPremium: serverUser.isPremium,
            scansRemaining: serverUser.scansRemaining,
            streak: serverUser.streak ?? 0,
          };
          if (serverUser.birthData) {
            updated.birthData = serverUser.birthData;
            if (!updated.natalChart) {
              updated.natalChart = calculateNatalChart(serverUser.birthData);
            }
          }
          setUser(updated);
          saveUser(updated);
          setIsAuthed(true);
          // CRITICAL: route to home after successful login.
          // Without this, screen stays at 'auth' and the main content
          // area renders an empty div (only cosmic-bg visible = black screen).
          setScreen('home');
        }} />
      );
    }
    return (
      <Landing
        onStart={() => setScreen('auth')}
        onLogin={() => setScreen('auth')}
        onGuest={() => { setIsGuest(true); setScreen('home'); }}
      />
    );
  }

  // ─── AUTHED but no birth data: Onboarding ───
  // Also reached in guest mode when user tries horoscope/chart or taps the guest banner
  if (screen === 'onboarding' || ((!user.birthData && screen !== 'home') && (isAuthed || isGuest))) {
    if (!user.birthData) {
      return (
        <Suspense fallback={<Splash />}>
          <Onboarding onComplete={(u) => {
            setUser(u);
            saveUser(u);
            if (isGuest) {
              // Guest completed birth data → now create account to persist
              setIsGuest(false);
              setScreen('auth');
            } else {
              setScreen('home');
            }
          }} />
        </Suspense>
      );
    }
  }

  // P0 #8 — Mémoriser l'écran d'origine avant le paywall pour pouvoir y revenir.
  if (screen === 'paywall') {
    return (
      <Suspense fallback={<Splash />}>
        <Paywall
          onClose={() => setScreen((prev) => prev === 'paywall' ? 'home' : prev)}
          onSubscribe={(u) => { setUser(u); saveUser(u); setScreen('horoscope'); }}
        />
      </Suspense>
    );
  }

  const navItems: Screen[] = ['home', 'horoscope', 'journal', 'explorer', 'settings'];
  const navLabels: Record<string, string> = {
    home: 'Accueil', horoscope: 'Horoscope',
    journal: 'Journal', explorer: 'Explorer', settings: 'Profil',
  };
  const showNav = navItems.includes(screen);

  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100">
      <div className="max-w-md mx-auto min-h-screen relative">
        {/* Contenu principal (main landmark déjà dans index.html pour SPA) */}
        <div className="pb-24">
          <div key={screen} className="page-enter">
            <Suspense fallback={<Splash />}>
              {screen === 'home' && <Home user={user} onNavigate={handleNavigate} isGuest={isGuest} />}
              {screen === 'chart' && <ChartView user={user} />}
              {screen === 'horoscope' && <Horoscope user={user} onNavigate={setScreen} />}
              {screen === 'compatibility' && <Compatibility user={user} />}
              {screen === 'journal' && <Journal user={user} />}
              {screen === 'explorer' && <Explorer user={user} onNavigate={handleNavigate} />}
              {screen === 'settings' && <Settings user={user} onUpdate={(u) => { setUser(u); saveUser(u); }} onPaywall={() => setScreen('paywall')} />}
            </Suspense>
          </div>
        </div>
        {showNav && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
            <BottomNav items={navItems} labels={navLabels} active={screen} onNavigate={(s) => handleNavigate(s as Screen)} />
          </div>
        )}
      </div>
    </div>
  );
}
