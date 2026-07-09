import type { NatalChart, HoroscopeEntry, ZodiacSign, CompatibilityResult } from '../types';
import { ZODIAC_SIGNS, ZODIAC_ORDER, PLANET_DATA } from '../data/zodiac';
import { signCompatibility } from '../data/zodiac';

/**
 * CÉLESTE — Générateur d'horoscope personnalisé
 * 
 * En production, chaque horoscope serait généré par un LLM (Claude/GPT)
 * avec le prompt système documenté dans /docs/ai-prompt.md
 * 
 * Pour le MVP offline, on génère un contenu varié et personnalisé
 * basé sur le thème natal réel de l'utilisateur.
 */

const MOODS = [
  "Contemplatif", "Énergique", "Inspiré", "Serein", "Déterminé",
  "Rêveur", "Focalisé", "Audacieux", "Empathique", "Lucide",
];

const COLORS = [
  "Or", "Indigo", "Émeraude", "Rubis", "Ambré",
  "Argent", "Violet", "Turquoise", "Corail", "Nuit étoilée",
];

function seedRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function dateSeed(dateStr: string, sunSign: string): number {
  let h = 0;
  const str = dateStr + sunSign;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export async function generateHoroscope(chart: NatalChart, date: string): Promise<HoroscopeEntry> {
  const sunData = ZODIAC_SIGNS[chart.sun];
  const moonData = ZODIAC_SIGNS[chart.moon];
  const rng = seedRandom(dateSeed(date, chart.sun));
  
  const energy = 2 + Math.floor(rng() * 4);
  const mood = MOODS[Math.floor(rng() * MOODS.length)];
  const luckyNumber = Math.floor(rng() * 99) + 1;
  const luckyColor = COLORS[Math.floor(rng() * COLORS.length)];

  const general = buildGeneral(chart, sunData, moonData, rng);
  const love = buildLove(chart, rng);
  const career = buildCareer(chart, sunData, rng);

  return { date, energy, mood, general, love, career, luckyNumber, luckyColor };
}

function buildGeneral(chart: NatalChart, sunData: any, moonData: any, rng: () => number): string {
  const el = chart.elements;
  const intro = rng() > 0.5
    ? "Avec votre Soleil en " + sunData.name
    : "Votre essence solaire " + sunData.name.toLowerCase();

  let body: string;
  if (el.fire > 2) {
    body = " vous donne aujourd'hui un carburant créatif exceptionnel. C'est le moment d'initier, d'oser, de proposer. Votre feu intérieur demande à s'exprimer.";
  } else if (el.water > 2) {
    body = " vous rend particulièrement réceptif aux nuances émotionnelles. Faites confiance à votre intuition, elle capte des informations que la raison n'a pas encore intégrées.";
  } else if (el.air > 2) {
    body = " stimulate votre besoin d'échanges et d'idées nouvelles. Connectez-vous, écrivez, partagez votre vision. Votre agilité mentale est un atout aujourd'hui.";
  } else {
    body = " vous invite à ancrer vos projets dans le concret. La patience et la méthode portent leurs fruits. Construisez solidement, pierre après pierre.";
  }

  const moonNote = " Avec votre Lune en " + moonData.name + ", votre monde intérieur " +
    (moonData.element === 'water' ? "est profond et sensible." :
     moonData.element === 'fire' ? "vibre d'une ardeur communicative." :
     moonData.element === 'air' ? "cherche la légèreté et la connexion." :
     "aspire à la stabilité et à la sécurité.");

  return intro + body + moonNote;
}

function buildLove(chart: NatalChart, rng: () => number): string {
  const sunData = ZODIAC_SIGNS[chart.sun];
  const venus = chart.positions.find(p => p.planet === 'venus');
  const venusSign = venus ? ZODIAC_SIGNS[venus.sign].name : sunData.name;

  const messages = [
    "Vénus en " + venusSign + " illumine votre vie amoureuse d'une teinte particulière. Vous cherchez la beauté là où d'autres ne voient que banalité.",
    "Votre façon d'aimer est teintée par " + venusSign + ". Aujourd'hui, exprimez vos sentiments avec authenticité plutôt qu'avec perfection.",
    "En amour, votre Vénus " + venusSign + " vous pousse à créer des liens authentiques. Une conversation sincère pourrait transformer une relation.",
    "Votre cœur " + venusSign + " bat pour l'harmonie. Offrez votre attention à ceux qui comptent, sans rien attendre en retour.",
  ];

  return messages[Math.floor(rng() * messages.length)];
}

function buildCareer(chart: NatalChart, sunData: any, rng: () => number): string {
  const mars = chart.positions.find(p => p.planet === 'mars');
  const marsSign = mars ? ZODIAC_SIGNS[mars.sign].name : sunData.name;

  const messages = [
    "Votre énergie d'action, portée par Mars en " + marsSign + ", vous pousse à avancer. Identifiez UNE priorité et concentrez-vous dessus.",
    "Mars en " + marsSign + " dynamise vos ambitions professionnelles. Un projet stagnation pourrait enfin débloquer si vous osez frapper à la bonne porte.",
    "Votre drive professionnel s'exprime à travers Mars " + marsSign + ". Aujourd'hui, l'action directe est plus efficace que la planification.",
    "L'énergie martiale " + marsSign + " vous donne du culot. Utilisez-le pour défendre une idée ou prendre une initiative qui sort du cadre.",
  ];

  return messages[Math.floor(rng() * messages.length)];
}

/**
 * Compatibilité entre deux thèmes
 */
export async function generateCompatibility(
  chart: NatalChart,
  theirSunSign: ZodiacSign,
  _theirMoonSign: ZodiacSign
): Promise<CompatibilityResult> {
  const yourSun = chart.sun;
  const yourSunData = ZODIAC_SIGNS[yourSun];
  const theirSunData = ZODIAC_SIGNS[theirSunSign];

  const compat = signCompatibility(yourSun, theirSunSign);

  let title: string;
  if (compat >= 80) title = "Une alchimie rare";
  else if (compat >= 65) title = "Une belle résonance";
  else if (compat >= 50) title = "Complémentaires";
  else if (compat >= 35) title = "Un défi stimulant";
  else title = "Miroirs opposés";

  const descriptions: Record<number, string> = {};
  descriptions[80] = yourSunData.element === theirSunData.element
    ? "Vous partagez le même élément — " + yourSunData.element + ". Cette résonance crée une compréhension instinctive, comme si vous parliez la même langue intérieure."
    : "Vos éléments se renforcent mutuellement. Là où l'un apporte la profondeur, l'autre offre la légèreté.";

  descriptions[65] = "Il y a entre vous une dynamique naturelle qui demande peu d'efforts pour se mettre en place. Vos énergies se reconnaissent.";

  descriptions[50] = "Vous êtes suffisamment différents pour vous fasciner, suffisamment proches pour vous comprendre. C'est le duo classique du complémentaire.";

  descriptions[35] = "Cette relation n'est pas de tout repos, mais elle est formatrice. Vous ferez progresser l'un l'autre si vous acceptez vos différences.";

  const desc = descriptions[Math.round(compat / 20) * 20] || descriptions[50]!;

  const strengths = buildStrengths(yourSunData, theirSunData);
  const challenges = buildChallenges(yourSunData, theirSunData);

  return {
    yourSun,
    theirSun: theirSunSign,
    yourMoon: yourSun,
    theirMoon: theirSunSign,
    score: compat,
    title,
    description: desc,
    strengths,
    challenges,
  };
}

function buildStrengths(your: any, their: any): string[] {
  if (your.element === their.element) {
    return [
      "Compréhension instinctive de vos motivations profondes",
      "Même rythme émotionnel et même façon de traiter le monde",
      "Communication fluide, peu de malentendus",
    ];
  }
  const complementary = (your.element === 'fire' && their.element === 'air') ||
    (your.element === 'earth' && their.element === 'water') ||
    (your.element === 'air' && their.element === 'fire') ||
    (your.element === 'water' && their.element === 'earth');

  if (complementary) {
    return [
      "Vos énergies se nourrissent mutuellement",
      "L'un stimule là où l'autre ancre",
      "Créativité de couple exceptionnelle",
    ];
  }
  return [
    "Différences qui forcent l'évolution personnelle",
    "Chacun apporte ce qui manque à l'autre",
    "Équilibre par la complémentarité des temperaments",
  ];
}

function buildChallenges(your: any, their: any): string[] {
  if (your.element === their.element) {
    return [
      "Risque d'amplifier les mêmes excès ensemble",
      "Manque de recul sur vos aveuglements communs",
    ];
  }
  const opposite = (your.element === 'fire' && their.element === 'water') ||
    (your.element === 'earth' && their.element === 'air');

  if (opposite) {
    return [
      "Risque de vous éteindre mutuellement si vous ne communiquez pas",
      "Vos rhythms sont opposés — trouver le juste milieu demande un effort conscient",
    ];
  }
  return [
    "Vos priorités ne sont pas les mêmes — clarifiez vos attentes",
    "L'un veut avancer pendant que l'autre veut consolider",
  ];
}
