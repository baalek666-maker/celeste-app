import { useState, useEffect } from 'react';
import { Onboarding } from './screens/Onboarding';
import { Auth } from './screens/Auth';
import { Home } from './screens/Home';
import { ChartView } from './screens/ChartView';
import { Horoscope } from './screens/Horoscope';
import { Compatibility } from './screens/Compatibility';
import { Journal } from './screens/Journal';
import { Paywall } from './screens/Paywall';
import { Settings } from './screens/Settings';
import { BottomNav } from './components/BottomNav';
import { getToken, clearToken, api } from './lib/api';
import { getUser, saveUser } from './lib/storage';
import type { User } from './types';

export type Screen = 'onboarding' | 'home' | 'chart' | 'horoscope' | 'compatibility' | 'journal' | 'paywall' | 'settings';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User>(getUser());
  const [isAuthed, setIsAuthed] = useState<boolean>(!!getToken());

  // On mount: if we have a token, fetch the real profile from backend
  useEffect(() => {
    if (getToken()) {
      api.getProfile().then(profile => {
        const updated: User = {
          ...user,
          email: profile.email,
          isPremium: profile.isPremium,
          scansRemaining: profile.scansRemaining,
          premiumUntil: profile.premiumUntil ?? null,
        };
        // If birth data is on the server, sync it
        if (profile.birthData) {
          updated.birthData = profile.birthData;
        }
        setUser(updated);
        saveUser(updated);
        setIsAuthed(true);
      }).catch(() => {
        // Token expired/invalid
        clearToken();
        setIsAuthed(false);
      });
    }
  }, []);

  // Route to onboarding if no birth data
  useEffect(() => {
    if (isAuthed && !user.birthData) {
      setScreen('onboarding');
    }
  }, [isAuthed, user.birthData]);

  const handleNavigate = (s: Screen) => {
    if (!user.isPremium && (s === 'horoscope' || s === 'compatibility' || s === 'journal')) {
      setScreen('paywall');
      return;
    }
    setScreen(s);
  };

  // ─── NOT AUTHED: show Auth screen ───
  if (!isAuthed) {
    return (
      <Auth onSuccess={(serverUser) => {
        const updated: User = {
          ...user,
          email: serverUser.email,
          isPremium: serverUser.isPremium,
          scansRemaining: serverUser.scansRemaining,
        };
        if (serverUser.birthData) {
          updated.birthData = serverUser.birthData;
        }
        setUser(updated);
        saveUser(updated);
        setIsAuthed(true);
      }} />
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
        <div className="pb-24">
          {screen === 'home' && <Home user={user} onNavigate={handleNavigate} />}
          {screen === 'chart' && <ChartView user={user} />}
          {screen === 'horoscope' && <Horoscope user={user} />}
          {screen === 'compatibility' && <Compatibility user={user} />}
          {screen === 'journal' && <Journal user={user} />}
          {screen === 'settings' && <Settings user={user} onUpdate={(u) => { setUser(u); saveUser(u); }} />}
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
