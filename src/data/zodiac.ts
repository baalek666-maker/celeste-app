import type { ZodiacSign, Element, Modality } from '../types';

export const ZODIAC_SIGNS: Record<ZodiacSign, {
  name: string;
  symbol: string;
  emoji: string;
  dates: string;
  element: Element;
  modality: Modality;
  ruler: string;
  traits: string[];
  color: string;
  description: string;
}> = {
  aries: {
    name: 'Bélier', symbol: '♈', emoji: '🔥', dates: '21 mars - 19 avril',
    element: 'fire', modality: 'cardinal', ruler: 'Mars',
    traits: ['Audacieux', 'Pionnier', 'Énergique', 'Impulsif'],
    color: '#ef4444',
    description: 'Le Bélier est un feu créateur. Premier signe du zodiaque, il incarne le début, l\'action et le courage.'
  },
  taurus: {
    name: 'Taureau', symbol: '♉', emoji: '🌱', dates: '20 avril - 20 mai',
    element: 'earth', modality: 'fixed', ruler: 'Vénus',
    traits: ['Constant', 'Sensuel', 'Déterminé', 'Fidèle'],
    color: '#22c55e',
    description: 'Le Taureau cherche la stabilité et la beauté. Signe de terre, il apprécie les plaisirs simples et durables.'
  },
  gemini: {
    name: 'Gémeaux', symbol: '♊', emoji: '💨', dates: '21 mai - 20 juin',
    element: 'air', modality: 'mutable', ruler: 'Mercure',
    traits: ['Curieux', 'Adaptable', 'Communicatif', 'Vif'],
    color: '#fbbf24',
    description: 'Les Gémeaux sont l\'esprit en mouvement. Signe d\'air, ils connectent les idées et les personnes.'
  },
  cancer: {
    name: 'Cancer', symbol: '♋', emoji: '🌙', dates: '21 juin - 22 juillet',
    element: 'water', modality: 'cardinal', ruler: 'Lune',
    traits: ['Intuitif', 'Nourricier', 'Émotif', 'Protecteur'],
    color: '#94a3b8',
    description: 'Le Cancer porte le monde émotionnel. Signe d\'eau, il ressent profondément et protège les siens.'
  },
  leo: {
    name: 'Lion', symbol: '♌', emoji: '☀️', dates: '23 juillet - 22 août',
    element: 'fire', modality: 'fixed', ruler: 'Soleil',
    traits: ['Charismatique', 'Généreux', 'Créatif', 'Fier'],
    color: '#f59e0b',
    description: 'Le Lion rayonne. Signe de feu gouverné par le Soleil, il incarne la créativité et la confiance.'
  },
  virgo: {
    name: 'Vierge', symbol: '♍', emoji: '🌾', dates: '23 août - 22 septembre',
    element: 'earth', modality: 'mutable', ruler: 'Mercure',
    traits: ['Analytique', 'Minutieux', 'Serviable', 'Raisonnable'],
    color: '#10b981',
    description: 'La Vierge raffine et organise. Signe de terre, elle cherche l\'excellence par le détail et le service.'
  },
  libra: {
    name: 'Balance', symbol: '♎', emoji: '⚖️', dates: '23 septembre - 22 octobre',
    element: 'air', modality: 'cardinal', ruler: 'Vénus',
    traits: ['Diplomate', 'Esthète', 'Équilibré', 'Sociable'],
    color: '#ec4899',
    description: 'La Balance cherche l\'harmonie. Signe d\'air, elle pèse, ajuste et relie par la beauté et la justice.'
  },
  scorpio: {
    name: 'Scorpion', symbol: '♏', emoji: '🦂', dates: '23 octobre - 21 novembre',
    element: 'water', modality: 'fixed', ruler: 'Pluton',
    traits: ['Intense', 'Profond', 'Stratégique', 'Transformateur'],
    color: '#7c3aed',
    description: 'Le Scorpion plonge dans les profondeurs. Signe d\'eau, il transforme par la passion et la vérité nue.'
  },
  sagittarius: {
    name: 'Sagittaire', symbol: '♐', emoji: '🏹', dates: '22 novembre - 21 décembre',
    element: 'fire', modality: 'mutable', ruler: 'Jupiter',
    traits: ['Aventurier', 'Philosophe', 'Optimiste', 'Libre'],
    color: '#8b5cf6',
    description: 'Le Sagittaire vise loin. Signe de feu, il cherche le sens, l\'aventure et l\'expansion des horizons.'
  },
  capricorn: {
    name: 'Capricorne', symbol: '♑', emoji: '⛰️', dates: '22 décembre - 19 janvier',
    element: 'earth', modality: 'cardinal', ruler: 'Saturne',
    traits: ['Ambitieux', 'Discipliné', 'Patient', 'Résilient'],
    color: '#475569',
    description: 'Le Capricorne gravit la montagne. Signe de terre, il bâtit durablement avec discipline et stratégie.'
  },
  aquarius: {
    name: 'Verseau', symbol: '♒', emoji: '⚡', dates: '20 janvier - 18 février',
    element: 'air', modality: 'fixed', ruler: 'Uranus',
    traits: ['Innovant', 'Indépendant', 'Humaniste', 'Original'],
    color: '#06b6d4',
    description: 'Le Verseau imagine le futur. Signe d\'air, il défie les conventions et pense collectivement.'
  },
  pisces: {
    name: 'Poissons', symbol: '♓', emoji: '🐟', dates: '19 février - 20 mars',
    element: 'water', modality: 'mutable', ruler: 'Neptune',
    traits: ['Empathique', 'Rêveur', 'Spirituel', 'Artistique'],
    color: '#6366f1',
    description: 'Les Poissons fusionnent avec le monde. Signe d\'eau, ils ressentent l\'invisible et imaginent l\'impossible.'
  }
};

export const ZODIAC_ORDER: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

export const PLANET_DATA: Record<string, { name: string; symbol: string; color: string; meaning: string }> = {
  sun:     { name: 'Soleil',    symbol: '☉', color: '#fbbf24', meaning: 'Identité, ego, vitalité' },
  moon:    { name: 'Lune',      symbol: '☽', color: '#94a3b8', meaning: 'Émotions, instincts, inconscient' },
  mercury: { name: 'Mercure',   symbol: '☿', color: '#3b82f6', meaning: 'Communication, pensée, apprentissage' },
  venus:   { name: 'Vénus',     symbol: '♀', color: '#ec4899', meaning: 'Amour, beauté, valeurs' },
  mars:    { name: 'Mars',      symbol: '♂', color: '#ef4444', meaning: 'Action, désir, courage' },
  jupiter: { name: 'Jupiter',   symbol: '♃', color: '#f97316', meaning: 'Expansion, chance, sagesse' },
  saturn:  { name: 'Saturne',   symbol: '♄', color: '#64748b', meaning: 'Structure, responsabilité, karma' },
  uranus:  { name: 'Uranus',    symbol: '♅', color: '#06b6d4', meaning: 'Changement, liberté, innovation' },
  neptune: { name: 'Neptune',   symbol: '♆', color: '#6366f1', meaning: 'Rêves, spiritualité, illusion' },
  pluto:   { name: 'Pluton',    symbol: '♇', color: '#7c3aed', meaning: 'Transformation, pouvoir, renaissance' },
};

export function signFromDegree(totalDegree: number): ZodiacSign {
  const signIndex = Math.floor(totalDegree / 30) % 12;
  return ZODIAC_ORDER[signIndex];
}

export function degreeInSign(totalDegree: number): number {
  return totalDegree % 30;
}

export function formatDegree(degree: number): string {
  const d = degree % 30;
  const sign = ZODIAC_ORDER[Math.floor(degree / 30) % 12];
  const symbol = ZODIAC_SIGNS[sign].symbol;
  const deg = Math.floor(d);
  const min = Math.floor((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, '0')}' ${symbol}`;
}

export function signCompatibility(a: ZodiacSign, b: ZodiacSign): number {
  const ELEMENTS: Record<ZodiacSign, Element> = {
    aries: 'fire', leo: 'fire', sagittarius: 'fire',
    taurus: 'earth', virgo: 'earth', capricorn: 'earth',
    gemini: 'air', libra: 'air', aquarius: 'air',
    cancer: 'water', scorpio: 'water', pisces: 'water',
  };
  const ea = ELEMENTS[a]; const eb = ELEMENTS[b];
  const compatible: Record<Element, Element[]> = {
    fire: ['fire', 'air'], air: ['air', 'fire'],
    earth: ['earth', 'water'], water: ['water', 'earth'],
  };
  const opposite: Record<Element, Element> = { fire: 'water', water: 'fire', earth: 'air', air: 'earth' };
  if (a === b) return 90;
  if (compatible[ea].includes(eb)) return 70 + Math.floor(Math.random() * 15);
  if (opposite[ea] === eb) return 30 + Math.floor(Math.random() * 15);
  return 45 + Math.floor(Math.random() * 15);
}
