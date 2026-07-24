import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TransitComments from './TransitComments';
import TransitFeed from './TransitFeed';
import TransitShare from './TransitShare';

type Aspect = {
  transitPlanet: string;
  natalPlanet: string;
  transitPlanetFr: string;
  natalPlanetFr: string;
  transitGlyph: string;
  natalGlyph: string;
  aspect: string;
  aspectFr: string;
  aspectGlyph: string;
  nature: 'tension' | 'harmonique' | 'neutre';
  orb: number;
  exact: boolean;
  transitRetrograde: boolean;
  interpretation: string;
  conseil: string;
};

type HouseData = {
  num: number;
  theme: string;
  icon: string;
  short: string;
  sign: string;
  activated: boolean;
  natalPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean }>;
  transitPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean }>;
  insight: string;
  action: string;
};

type TransitsData = {
  date: string;
  headline: string;
  flowScore: number;
  challengeScore: number;
  aspects: Aspect[];
};

type HousesData = {
  date: string;
  headline: string;
  houses: HouseData[];
};

const NATURE_STYLE: Record<string, { bg: string; border: string; text: string; label: string; emoji: string; heroGradient: string }> = {
  tension:    { bg: 'from-rose-500/15 to-orange-500/10',    border: 'border-rose-500/30',    text: 'text-rose-300',    label: 'Défi',      emoji: '⚡', heroGradient: 'from-rose-500/30 via-rose-700/20 to-cosmic-500/10' },
  harmonique: { bg: 'from-emerald-500/15 to-teal-500/10',   border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Flow',      emoji: '✨', heroGradient: 'from-emerald-500/30 via-teal-700/20 to-cosmic-500/10' },
  neutre:     { bg: 'from-violet-500/15 to-indigo-500/10',   border: 'border-violet-500/30',  text: 'text-violet-300',  label: 'Activation',emoji: '🌑', heroGradient: 'from-violet-500/30 via-indigo-700/20 to-cosmic-500/10' },
};

/** Extrait 3-4 mots pour le titre hero depuis la 1ère phrase de l'interprétation. */
function makeHeroTitle(interpretation: string): string {
  if (!interpretation) return 'Le ciel t\'écoute';
  // Coupe à la 1ère virgule ou 1er point
  const firstSentence = interpretation.split(/[,.!?]/)[0]?.trim() || interpretation;
  const words = firstSentence.split(/\s+/);
  if (words.length <= 5) return firstSentence;
  // Prend les 3-4 premiers mots significatifs
  return words.slice(0, 4).join(' ') + '…';
}

/** Extrait 1 phrase courte (12-18 mots) pour le sous-titre hero. */
function makeHeroSubtitle(interpretation: string): string {
  if (!interpretation) return '';
  const sentences = interpretation.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 0) return interpretation.slice(0, 100);
  // Retourne la 1ère ou 2ème phrase la plus courte
  return sentences.sort((a, b) => a.length - b.length)[0] || sentences[0];
}

/** Trouve la maison activée qui correspond à un aspect (par planète natale touchée). */
function findMatchingHouse(aspect: Aspect, houses: HouseData[]): HouseData | null {
  if (!houses || houses.length === 0) return null;
  // Map planète FR -> nom
  const planetToHouse: Record<string, string> = {
    'Soleil': 'Soleil', 'Lune': 'Lune', 'Mercure': 'Mercure', 'Vénus': 'Vénus',
    'Mars': 'Mars', 'Jupiter': 'Jupiter', 'Saturne': 'Saturne', 'Uranus': 'Uranus',
    'Neptune': 'Neptune', 'Pluton': 'Pluton',
  };
  // Cherche une maison où transitPlanets inclut la planète en transit OU natalPlanets inclut la planète natale
  const transitKey = planetToHouse[aspect.transitPlanet] || aspect.transitPlanet;
  const natalKey = planetToHouse[aspect.natalPlanet] || aspect.natalPlanet;
  return houses.find(h =>
    h.transitPlanets.some(p => p.name === transitKey) ||
    h.natalPlanets.some(p => p.name === natalKey)
  ) || null;
}

export default function TransitHero() {
  const [transits, setTransits] = useState<TransitsData | null>(null);
  const [houses, setHouses] = useState<HouseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getPersonalTransits().catch(() => null),
      api.getActivatedHouses().catch(() => null),
    ])
      .then(([t, h]) => {
        if (cancelled) return;
        if (t) setTransits(t);
        if (h?.houses) setHouses(h.houses);
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Erreur'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="celeste-card mb-6 animate-pulse">
        <div className="flex items-center justify-center h-64">
          <div className="w-16 h-16 rounded-full bg-cosmic-500/20 animate-glow" />
        </div>
      </div>
    );
  }

  if (error || !transits || transits.aspects.length === 0) {
    return (
      <div className="celeste-card mb-6 text-sm text-celeste-text/60 text-center py-8">
        {error ? `Transits indisponibles (${error})` : '🌙 Journée calme — le ciel se repose.'}
      </div>
    );
  }

  // Tri : EXACT d'abord, puis tension (défi), puis harmonique, puis par orb
  const sortedAspects = [...transits.aspects].sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    const order = { tension: 0, neutre: 1, harmonique: 2 };
    if (order[a.nature] !== order[b.nature]) return order[a.nature] - order[b.nature];
    return a.orb - b.orb;
  });

  const hero = sortedAspects[0];
  const style = NATURE_STYLE[hero.nature] || NATURE_STYLE.neutre;
  const heroHouse = findMatchingHouse(hero, houses);

  const totalItems = transits.aspects.length + (houses || []).filter(h => h.activated && !transits.aspects.some(a => findMatchingHouse(a, [h]))).length;
  const dateFormatted = new Date(transits.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      <div className="celeste-card mb-6 overflow-hidden relative animate-fade-in">
        {/* Background gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${style.heroGradient} pointer-events-none`} />
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-cosmic-500/10 animate-glow blur-2xl" />
          <div className="absolute bottom-10 left-10 w-24 h-24 rounded-full bg-cosmic-500/10 animate-glow blur-2xl" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative z-10">
          {/* Top row: glyphs + date + EXACT */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-2xl">
              <span title={hero.transitPlanetFr} className="animate-glow">{hero.transitGlyph}</span>
              {hero.transitRetrograde && <span className="text-[10px] text-amber-400 font-mono self-start">℞</span>}
              <span className={`text-xl ${style.text}`}>{hero.aspectGlyph}</span>
              <span title={hero.natalPlanetFr}>{hero.natalGlyph}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {hero.exact && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/30 text-gold-200 font-bold border border-gold-500/40">
                  EXACT
                </span>
              )}
              <span className="text-[10px] text-celeste-text/50 capitalize">{dateFormatted}</span>
            </div>
          </div>

          {/* Hero emoji (giant, animated) */}
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full glass-gold flex items-center justify-center animate-glow">
              <span className="text-5xl">{style.emoji}</span>
            </div>
          </div>

          {/* Nature badge */}
          <div className="flex justify-center mb-3">
            <span className={`text-xs px-3 py-1 rounded-full bg-celeste-bg/40 ${style.text} font-semibold uppercase tracking-wider border ${style.border}`}>
              {style.emoji} {style.label}
            </span>
          </div>

          {/* Hero title (3-4 mots) */}
          <h2 className="text-3xl font-bold text-center mb-3 text-cosmic-gradient leading-tight">
            {makeHeroTitle(hero.interpretation)}
          </h2>

          {/* Subtitle (1 phrase) */}
          <p className="text-base text-celeste-text/85 text-center mb-6 leading-relaxed px-2">
            {makeHeroSubtitle(hero.interpretation)}
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/30 to-transparent" />
            <span className="text-cosmic-400 text-xs">★</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/30 to-transparent" />
          </div>

          {/* Conseil */}
          {hero.conseil && (
            <div className="rounded-xl bg-cosmic-500/10 border border-cosmic-500/25 p-3 mb-4">
              <p className="text-sm text-celeste-text/85 flex items-start gap-2">
                <span className="not-italic text-lg flex-shrink-0">💡</span>
                <span className="italic">{hero.conseil}</span>
              </p>
            </div>
          )}

          {/* Maison activée (si match) */}
          {heroHouse && (
            <div className="rounded-xl bg-celeste-bg/30 border border-celeste-primary/15 p-3 mb-4">
              <p className="text-xs text-celeste-text/60 flex items-center gap-2">
                <span className="text-lg">{heroHouse.icon}</span>
                <span className="font-semibold text-celeste-text/80">Maison {heroHouse.num}</span>
                <span className="text-celeste-text/50">— {heroHouse.theme}</span>
              </p>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFeedOpen(true)}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-sm shadow-lg shadow-cosmic-900/50 hover:shadow-cosmic-700/50 transition-all active:scale-[0.98]"
            >
              Voir tout le ciel ({totalItems}) →
            </button>
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Partager sur Instagram"
              className="px-4 py-3 rounded-2xl glass border border-cosmic-500/30 hover:border-cosmic-500/60 transition-all active:scale-[0.98]"
            >
              <span className="text-lg">📤</span>
            </button>
          </div>
        </div>
      </div>

      {/* TransitComments reste ici, sous la hero */}
      {transits.date && (
        <TransitComments date={transits.date} transitKey={`personal-${transits.date}`} />
      )}

      {/* Feed modal */}
      {feedOpen && (
        <TransitFeed
          transits={transits}
          houses={houses}
          onClose={() => setFeedOpen(false)}
        />
      )}

      {/* Share modal */}
      {shareOpen && (
        <TransitShare
          aspect={hero}
          house={heroHouse}
          dateFormatted={dateFormatted}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
