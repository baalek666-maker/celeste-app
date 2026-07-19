// Shared zodiac data between server modules (Pure JS, no TS).
// Mirrors src/data/zodiac.ts structure used by portrait-pdf.js.

export const ZODIAC_SIGNS = {
  aries:       { name: 'Bélier',         emoji: '♈', element: 'fire',  polarity: 'masculine' },
  taurus:      { name: 'Taureau',        emoji: '♉', element: 'earth', polarity: 'feminine' },
  gemini:      { name: 'Gémeaux',        emoji: '♊', element: 'air',   polarity: 'masculine' },
  cancer:      { name: 'Cancer',         emoji: '♋', element: 'water', polarity: 'feminine' },
  leo:         { name: 'Lion',           emoji: '♌', element: 'fire',  polarity: 'masculine' },
  virgo:       { name: 'Vierge',         emoji: '♍', element: 'earth', polarity: 'feminine' },
  libra:        { name: 'Balance',       emoji: '♎', element: 'air',   polarity: 'masculine' },
  scorpio:     { name: 'Scorpion',       emoji: '♏', element: 'water', polarity: 'feminine' },
  sagittarius: { name: 'Sagittaire',     emoji: '♐', element: 'fire',  polarity: 'masculine' },
  capricorn:   { name: 'Capricorne',     emoji: '♑', element: 'earth', polarity: 'feminine' },
  aquarius:    { name: 'Verseau',        emoji: '♒', element: 'air',   polarity: 'masculine' },
  pisces:      { name: 'Poissons',       emoji: '♓', element: 'water', polarity: 'feminine' },
};
