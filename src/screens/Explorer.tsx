import { useState } from 'react';
import type { User } from '../types';
import type { Screen } from '../App';
import { ChartView } from './ChartView';
import { Compatibility } from './Compatibility';
import PersonalTransits from '../components/PersonalTransits';
import DailyRituals from '../components/DailyRituals';
import ActivatedHouses from '../components/ActivatedHouses';
import AsteroidWisdom from '../components/AsteroidWisdom';
import LunarNodes from '../components/LunarNodes';
import WeeklyChallenge from '../components/WeeklyChallenge';
import ChineseAstrology from '../components/ChineseAstrology';
import BadgeGrid from '../components/BadgeGrid';
import XpBar from '../components/XpBar';
import DailyTarot from '../components/DailyTarot';
import DailyQuests from '../components/DailyQuests';
import AstroPortrait from '../screens/AstroPortrait';

type Pilier = 'sky' | 'links' | 'daily';

interface Module {
  key: string;
  label: string;
  emoji: string;
  desc: string;
}

const PILIERS: { key: Pilier; label: string; emoji: string; desc: string }[] = [
  { key: 'sky',   label: 'Ton Ciel',      emoji: '🔭', desc: 'Thème natal, portrait, maisons, aspects' },
  { key: 'links', label: 'Tes Liens',     emoji: '💞', desc: 'Compatibilité et astrologie chinoise' },
  { key: 'daily', label: 'Ton Quotidien', emoji: '🎮', desc: 'Tarot, quêtes, défis et badges' },
];

const SKY_MODULES: Module[] = [
  { key: 'portrait',  label: 'Portrait astral',  emoji: '📜', desc: 'Ton portrait profond de 1500 mots' },
  { key: 'chart',     label: 'Thème natal',      emoji: '☀️', desc: 'Toutes tes planètes et maisons' },
  { key: 'houses',    label: 'Maisons activées', emoji: '🏠', desc: 'Quels domaines de ta vie sont illuminés aujourd\'hui' },
  { key: 'aspects',   label: 'Transits du jour', emoji: '🌌', desc: 'Comment le ciel d\'aujourd\'hui touche TON thème' },
  { key: 'nodes',     label: 'Nœuds lunaires',   emoji: '☊',  desc: 'Ta mission karmique' },
  { key: 'asteroids', label: 'Blessures & Pouvoirs', emoji: '🌑', desc: 'Chiron, Lilith — tes archétypes intérieurs' },
  { key: 'rituals',   label: 'Rituels du jour',  emoji: '🕯️', desc: 'Un geste à poser aujourd\'hui' },
];

const LINKS_MODULES: Module[] = [
  { key: 'compatibility', label: 'Compatibilité',     emoji: '💞', desc: 'Affinités avec un proche' },
  { key: 'chinese',       label: 'Astrologie chinoise', emoji: '🐉', desc: 'Ton signe, élément et affinités' },
];

const DAILY_MODULES: Module[] = [
  { key: 'xp',        label: 'Progression',       emoji: '📊', desc: 'Ton niveau et ton XP' },
  { key: 'tarot',     label: 'Tarot quotidien',   emoji: '🃏', desc: 'Une carte pour ta journée' },
  { key: 'quests',    label: 'Quêtes',            emoji: '⚔️', desc: 'Tes missions du jour' },
  { key: 'challenge', label: 'Défi hebdomadaire', emoji: '🎯', desc: 'Un objectif sur la semaine' },
  { key: 'badges',    label: 'Badges',            emoji: '🏆', desc: 'Tes récompenses débloquées' },
];

function PilierHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="px-5 pt-12 pb-3 flex items-center gap-3">
      <button onClick={onBack} className="text-gold-400 text-sm">‹ Retour</button>
      <h1 className="text-xl font-bold text-gold-gradient">{label}</h1>
    </div>
  );
}

function ModuleCard({ mod, index, onClick }: { mod: Module; index: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full glass rounded-2xl p-4 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card"
      style={{ animationDelay: `${0.05 * index}s` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <span className="text-xl text-gold-400">{mod.emoji}</span>
        </div>
        <div className="flex-1">
          <p className="text-night-100 font-semibold text-sm">{mod.label}</p>
          <p className="text-night-400 text-xs mt-0.5">{mod.desc}</p>
        </div>
        <span className="text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all text-sm">→</span>
      </div>
    </button>
  );
}

export function Explorer({ user, onNavigate }: { user: User; onNavigate: (s: Screen) => void }) {
  const [pilier, setPilier] = useState<Pilier | null>(null);
  const [modKey, setModKey] = useState<string | null>(null);

  const modules: Record<Pilier, Module[]> = {
    sky: SKY_MODULES,
    links: LINKS_MODULES,
    daily: DAILY_MODULES,
  };

  const pilierLabel = (p: Pilier) => PILIERS.find(p2 => p2.key === p)!.label;

  // ─── Module content ──────────────────────────────
  if (pilier && modKey) {
    const goBack = () => { setModKey(null); window.scrollTo(0, 0); };
    const modLabel = modules[pilier].find(m => m.key === modKey)!.label;

    // Special: AstroPortrait has its own layout
    if (modKey === 'portrait') {
      return <AstroPortrait onBack={goBack} />;
    }

    return (
      <div className="page-transition">
        <PilierHeader label={modLabel} onBack={goBack} />
        <div className="px-5 pb-6">
          {modKey === 'chart'        && <ChartView user={user} />}
          {modKey === 'houses'       && <ActivatedHouses />}
          {modKey === 'aspects'      && <PersonalTransits />}
          {modKey === 'nodes'        && <LunarNodes />}
          {modKey === 'asteroids'    && <AsteroidWisdom />}
          {modKey === 'rituals'      && <DailyRituals />}
          {modKey === 'compatibility'&& <Compatibility user={user} />}
          {modKey === 'chinese'      && <ChineseAstrology user={user} />}
          {modKey === 'xp'           && <XpBar />}
          {modKey === 'tarot'        && <DailyTarot />}
          {modKey === 'quests'       && <DailyQuests />}
          {modKey === 'challenge'    && <WeeklyChallenge />}
          {modKey === 'badges'       && <BadgeGrid />}
        </div>
      </div>
    );
  }

  // ─── Pilier menu (module list) ───────────────────
  if (pilier) {
    const goBack = () => { setPilier(null); window.scrollTo(0, 0); };
    return (
      <div className="page-transition px-5 pt-12 pb-6">
        <PilierHeader label={pilierLabel(pilier)} onBack={goBack} />
        <div className="space-y-3 mt-4">
          {modules[pilier].map((mod, i) => (
            <ModuleCard
              key={mod.key}
              mod={mod}
              index={i}
              onClick={() => { setModKey(mod.key); window.scrollTo(0, 0); }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Overview — 3 piliers ─────────────────────────
  return (
    <div className="px-5 pt-12 pb-6 page-transition">
      <div className="mb-6 animate-fade-in">
        <p className="text-night-400 text-xs uppercase tracking-widest mb-1">Approfondir</p>
        <h1 className="text-2xl font-bold text-gold-gradient mb-2">Explorer</h1>
        <p className="text-night-300 text-sm">
          Plonge plus profond dans ton ciel, tes liens et ton quotidien.
        </p>
      </div>

      <div className="space-y-3">
        {PILIERS.map((p, i) => (
          <button
            key={p.key}
            onClick={() => { setPilier(p.key); window.scrollTo(0, 0); }}
            className="w-full glass rounded-2xl p-5 text-left hover:border-gold-500/40 border border-transparent transition-all duration-300 group stagger-card"
            style={{ animationDelay: `${0.08 * i}s` }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl glass-gold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <span className="text-2xl">{p.emoji}</span>
              </div>
              <div className="flex-1">
                <p className="text-night-100 font-semibold text-base">{p.label}</p>
                <p className="text-night-400 text-xs mt-0.5">{p.desc}</p>
              </div>
              <span className="text-night-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all">→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Premium banner */}
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
