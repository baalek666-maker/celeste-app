import { useState, useEffect } from 'react';
import { Onboarding } from './screens/Onboarding';
import { Auth } from './screens/Auth';
import { Landing } from './screens/Landing';
import { Home } from './screens/Home';
import { ChartView } from './screens/ChartView';
import { Horoscope } from './screens/Horoscope';
import { Compatibility } from './screens/Compatibility';
import { Journal } from './screens/Journal';
import { Paywall } from './screens/Paywall';
import { Settings } from './screens/Settings';
import { BottomNav } from './components/BottomNav';
import { getToken, clearToken, api } from './lib/api';
import { getUser, saveUser, getFreeScans, incrementFreeScans, getFreeCompat, incrementFreeCompat } from './lib/storage';
import { calculateNatalChart } from './lib/astrology';
import type { User } from './types';

export type Screen = 'landing' | 'auth' | 'onboarding' | 'home' | 'chart' | 'horoscope' | 'compatibility' | 'journal' | 'paywall' | 'settings';

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

// ─── Splash / loading screen ───────────────────────────
function Splash() {
  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 flex items-center justify-center relative">
      <div className="flex flex-col items-center relative z-10 animate-fade-in-scale">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full glass-gold border border-gold-500/30 mb-6 animate-float-slow">
          {/* Alchemical sigil — sun with orbiting bodies */}
          <svg width="48" height="48" viewBox="0 0 40 40" className="animate-spin-slow">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#c5a059" strokeWidth="0.5" opacity="0.5" />
            <circle cx="20" cy="20" r="10" fill="none" stroke="#c0c0c0" strokeWidth="0.5" opacity="0.35" />
            <circle cx="20" cy="3" r="1.5" fill="#e2c47c" />
            <circle cx="37" cy="20" r="1" fill="#c0c0c0" />
            <circle cx="20" cy="20" r="2.5" fill="#d4ae5f" opacity="0.8" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gold-gradient font-display tracking-wider mb-4">Céleste</h1>
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
          Céleste n'arrive pas à joindre son serveur. Vérifiez votre connexion internet puis réessayez.
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
    api.getProfile().then(profile => {
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
    }).catch((err) => {
      // Distinguish API unreachable from expired/invalid token
      if (isNetworkError(err)) {
        setApiDown(true);
      } else {
        clearToken();
        setIsAuthed(false);
      }
      setBooting(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route to onboarding if no birth data
  useEffect(() => {
    if (isAuthed && !user.birthData) {
      setScreen('onboarding');
    }
  }, [isAuthed, user.birthData]);

  const handleNavigate = (s: Screen) => {
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

  // ─── Splash while verifying token ───
  if (booting) {
    return <Splash />;
  }

  // ─── API unreachable: clear message instead of blank page ───
  if (apiDown) {
    return <ApiDown onRetry={retryBoot} />;
  }

  // ─── NOT AUTHED: Landing first visit, Auth for returning users ───
  if (!isAuthed) {
    if (screen === 'onboarding' && getToken()) {
      // Token exists after onboarding-stage signup — wait for effect
      return <Splash />;
    }
    // Show Auth screen if user clicked "Connexion" or set screen to a non-landing state
    if (screen === 'auth') {
      return (
        <Auth onSuccess={(serverUser) => {
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
        }} />
      );
    }
    return (
      <Landing
        onStart={() => setScreen('auth')}
        onLogin={() => setScreen('auth')}
      />
    );
  }

  // ─── AUTHED but no birth data: Onboarding ───
  if (screen === 'onboarding' || (!user.birthData && screen !== 'home')) {
    if (!user.birthData) {
      return <Onboarding onComplete={(u) => { setUser(u); saveUser(u); setScreen('home'); }} />;
    }
  }

  if (screen === 'paywall') {
    return <Paywall onClose={() => setScreen('home')} onSubscribe={(u) => { setUser(u); saveUser(u); setScreen('horoscope'); }} />;
  }

  const navItems: Screen[] = ['home', 'horoscope', 'compatibility', 'journal', 'settings'];
  const navLabels: Record<string, string> = {
    home: 'Accueil', horoscope: 'Horoscope', compatibility: 'Couple',
    journal: 'Journal', settings: 'Profil',
  };
  const showNav = navItems.includes(screen);

  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100">
      <div className="max-w-md mx-auto min-h-screen relative">
        {/* Contenu principal (main landmark déjà dans index.html pour SPA) */}
        <div className="pb-24">
          <div key={screen} className="page-transition">
            {screen === 'home' && <Home user={user} onNavigate={handleNavigate} />}
            {screen === 'chart' && <ChartView user={user} />}
            {screen === 'horoscope' && <Horoscope user={user} />}
            {screen === 'compatibility' && <Compatibility user={user} />}
            {screen === 'journal' && <Journal user={user} />}
            {screen === 'settings' && <Settings user={user} onUpdate={(u) => { setUser(u); saveUser(u); }} />}
          </div>
        </div>
        {showNav && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
            <BottomNav items={navItems} labels={navLabels} active={screen} onNavigate={handleNavigate} />
          </div>
        )}
      </div>
    </div>
  );
}
