import { useState, useEffect } from 'react';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { ChartView } from './screens/ChartView';
import { Horoscope } from './screens/Horoscope';
import { Compatibility } from './screens/Compatibility';
import { Journal } from './screens/Journal';
import { Paywall } from './screens/Paywall';
import { Settings } from './screens/Settings';
import { BottomNav } from './components/BottomNav';
import { hasOnboarded, getUser } from './lib/storage';
import type { User } from './types';

export type Screen = 'onboarding' | 'home' | 'chart' | 'horoscope' | 'compatibility' | 'journal' | 'paywall' | 'settings';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<User>(getUser());
  const [onboarded] = useState(hasOnboarded());

  useEffect(() => {
    if (!onboarded || !user.birthData) {
      setScreen('onboarding');
    }
  }, [onboarded, user.birthData]);

  const handleNavigate = (s: Screen) => {
    // Free users can access: home, chart (basic), paywall
    // Premium required: horoscope, compatibility, journal
    if (!user.isPremium && (s === 'horoscope' || s === 'compatibility' || s === 'journal')) {
      setScreen('paywall');
      return;
    }
    setScreen(s);
  };

  if (screen === 'onboarding') {
    return <Onboarding onComplete={(u) => { setUser(u); setScreen('home'); }} />;
  }

  if (screen === 'paywall') {
    return <Paywall onClose={() => setScreen('home')} onSubscribe={(u) => { setUser(u); setScreen('horoscope'); }} />;
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
          {screen === 'settings' && <Settings user={user} onUpdate={setUser} />}
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
