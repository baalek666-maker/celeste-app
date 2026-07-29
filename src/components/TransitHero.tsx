import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TransitComments from './TransitComments';
import TransitFeed from './TransitFeed';

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

  // Plus de hero d'intro : on affiche directement le feed swipe en mode inline,
  // avec toutes les cartes accessibles. TransitComments reste sous le feed.
  return (
    <>
      <div className="mb-4">
        <TransitFeed
          transits={transits}
          houses={houses}
          onClose={() => { /* en mode inline, fermeture = remontée de scroll */ }}
          inline
        />
      </div>

      {transits.date && (
        <TransitComments date={transits.date} transitKey={`personal-${transits.date}`} />
      )}
    </>
  );
}
