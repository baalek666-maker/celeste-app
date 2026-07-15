import { useState } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import { ChartView } from './ChartView';
import { Compatibility } from './Compatibility';
import DailyAspects from '../components/DailyAspects';
import DailyRituals from '../components/DailyRituals';
import OnboardingChecklist from '../components/OnboardingChecklist';
import HousesChart from '../components/HousesChart';
import AsteroidInsights from '../components/AsteroidInsights';
import LunarNodes from '../components/LunarNodes';
import WeeklyChallenge from '../components/WeeklyChallenge';
import ChineseAstrology from '../components/ChineseAstrology';
import BadgeGrid from '../components/BadgeGrid';
import AstroPortrait from '../screens/AstroPortrait';

type ExplorerSection = 'overview' | 'chart' | 'compatibility' | 'insights' | 'portrait' | 'chinese';

const SECTIONS: { key: ExplorerSection; label: string; emoji: string; desc: string }[] = [
  { key: 'portrait', label: 'Portrait astral', emoji: '📜', desc: 'Ton portrait profond de 1500 mots' },
  { key: 'chart', label: 'Thème natal', emoji: '☀', desc: 'Toutes tes planètes et maisons' },
  { key: 'compatibility', label: 'Compatibilité', emoji: '☽', desc: 'Affinités avec un proche' },
  { key: 'insights', label: 'Explorations', emoji: '◈', desc: 'Aspects, nœuds, astéroïdes, rituels' },
];

export function Explorer({ user, onNavigate }: { user: User; onNavigate: (s: Screen) => void }) {
  const [section, setSection] = useState<ExplorerSection>('overview');
  const [showAncient, setShowAncient] = useState(false);

  if (section === 'chart') {
    return (
      <div className="page-transition">
        <div className="px-5 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setSection('overview')} className="text-gold-400 text-sm">‹ Retour</button>
          <h1 className="text-xl font-bold text-gold-gradient">Thème natal</h1>
        </div>
        <ChartView user={user} />
      </div>
    );
  }
  if (section === 'compatibility') {
    return (
      <div className="page-transition">
        <div className="px-5 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setSection('overview')} className="text-gold-400 text-sm">‹ Retour</button>
          <h1 className="text-xl font-bold text-gold-gradient">Compatibilité</h1>
        </div>
        <Compatibility user={user} />
      </div>
    );
  }
  if (section === 'portrait') {
    return (
      <div className="page-transition">
        <AstroPortrait onBack={() => setSection('overview')} />
      </div>
    );
  }
  if (section === 'insights') {
    return (
      <div className="page-transition">
        <div className="px-5 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setSection('overview')} className="text-gold-400 text-sm">‹ Retour</button>
          <h1 className="text-xl font-bold text-gold-gradient">Explorations</h1>
        </div>
        <div className="px-5 pb-6">
          <DailyAspects />
          <HousesChart />
          <LunarNodes />
          <AsteroidInsights />
          <DailyRituals />
          <WeeklyChallenge />
          <OnboardingChecklist />
        </div>
      </div>
    );
  }
  if (section === 'chinese') {
    return (
      <div className="page-transition">
        <div className="px-5 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => setSection('overview')} className="text-gold-400 text-sm">‹ Retour</button>
          <h1 className="text-xl font-bold text-gold-gradient">Astrologie chinoise</h1>
        </div>
        <div className="px-5 pb-6">
          <ChineseAstrology user={user} />
        </div>
      </div>
    );
  }

  // Overview — minimalist menu
  return (
    <div className="px-5 pt-12 pb-6 page-transition">
      <div className="mb-6 animate-fade-in">
        <p className="text-night-400 text-xs uppercase tracking-widest mb-1">Approfondir</p>
        <h1 className="text-2xl font-bold text-gold-gradient mb-2">Explorer</h1>
        <p className="text-night-300 text-sm">
          Explore chaque planète de ton thème, en détail.
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              setSection(s.key);
              window.scrollTo(0, 0);
            }}
            className="w-full glass rounded-2xl p-5 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-2xl text-gold-400">{s.emoji}</span>
              </div>
              <div className="flex-1">
                <p className="text-night-100 font-semibold text-base">{s.label}</p>
                <p className="text-night-400 text-xs mt-0.5">{s.desc}</p>
              </div>
              <span className="text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Savoirs anciens — sous-menu replié */}
      <div className="mt-3">
        <button
          onClick={() => setShowAncient(!showAncient)}
          className="w-full glass rounded-2xl p-4 text-left hover:border-gold-500/30 border border-transparent transition-all flex items-center gap-3"
        >
          <span className="text-lg text-night-400">📜</span>
          <span className="flex-1 text-night-300 font-medium text-sm">Savoirs anciens</span>
          <span className={`text-night-500 text-xs transition-transform ${showAncient ? 'rotate-90' : ''}`}>→</span>
        </button>
        {showAncient && (
          <div className="mt-2 space-y-2 animate-fade-in">
            <button
              onClick={() => { setSection('chinese'); window.scrollTo(0, 0); }}
              className="w-full glass rounded-xl p-4 text-left hover:border-gold-500/30 border border-transparent transition-all flex items-center gap-3"
            >
              <span className="text-xl">🐉</span>
              <div className="flex-1">
                <p className="text-night-200 font-medium text-sm">Astrologie chinoise</p>
                <p className="text-night-500 text-xs">Ton signe chinois, élément et affinités</p>
              </div>
              <span className="text-night-500 text-xs">→</span>
            </button>
          </div>
        )}
      </div>

      {/* Badge Grid — trophy case */}
      <div className="mt-6">
        <BadgeGrid />
      </div>

      {/* Premium banner moved here — less in-your-face */}
      {!user.isPremium && (
        <button
          onClick={() => onNavigate('paywall')}
          className="w-full mt-6 glass-gold rounded-2xl p-5 text-left hover:border-gold-500/40 transition-all border border-gold-500/20"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">✦</span>
            <div className="flex-1">
              <p className="text-gold-300 font-semibold text-sm">Passe Premium</p>
              <p className="text-night-400 text-xs">Horoscope & compatibilité illimitées</p>
            </div>
            <span className="text-gold-400 text-xs">Découvrir →</span>
          </div>
        </button>
      )}
    </div>
  );
}
