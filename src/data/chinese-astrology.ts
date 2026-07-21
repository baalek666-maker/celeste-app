// Astrologie chinoise — Données enrichies
// 12 animaux, 5 éléments, Yin/Yang, Nouvel An lunaire, prévisions 2025,
// Bazi simplifié, numérologie, compatibilités détaillées.

export interface ChineseAnimal {
  id: number;
  name: string;
  chinese: string;
  emoji: string;
  years: number[];
  traits: string[];
  strengths: string;
  weaknesses: string;
  compatibility: number[];
  incompatible: number[];
  element: string;
  planet: string;
  western: string;
  description: string;
  luckyNumber: number;
  luckyColor: string;
  luckyDirection: string;
  bestCareer: string;
  // Prévision 2025 (année du Serpent de Bois)
  forecast2025: string;
}

export interface ChineseElement {
  name: string;
  chinese: string;
  emoji: string;
  qualities: string;
  color: string;
  planet: string;
  nourishes: string;
  controls: string;
}

// Dates approximatives du Nouvel An chinois (lunar new year).
// Source : calendrier astronomique. Sert à corriger le calcul pour
// les naissances en janvier/février.
const LUNAR_NEW_YEAR: Record<number, string> = {
  1948: '1948-02-10', 1949: '1949-01-29', 1950: '1950-02-17', 1951: '1951-02-06',
  1952: '1952-01-27', 1953: '1953-02-14', 1954: '1954-02-03', 1955: '1955-01-24',
  1956: '1956-02-12', 1957: '1957-01-31', 1958: '1958-02-18', 1959: '1959-02-08',
  1960: '1960-01-28', 1961: '1961-02-15', 1962: '1962-02-05', 1963: '1963-01-25',
  1964: '1964-02-13', 1965: '1965-02-02', 1966: '1966-01-21', 1967: '1967-02-09',
  1968: '1968-01-30', 1969: '1969-02-17', 1970: '1970-02-06', 1971: '1971-01-27',
  1972: '1972-02-15', 1973: '1973-02-03', 1974: '1974-01-23', 1975: '1975-02-11',
  1976: '1976-01-31', 1977: '1977-02-18', 1978: '1978-02-07', 1979: '1979-01-28',
  1980: '1980-02-16', 1981: '1981-02-05', 1982: '1982-01-25', 1983: '1983-02-13',
  1984: '1984-02-02', 1985: '1985-02-20', 1986: '1986-02-09', 1987: '1987-01-29',
  1988: '1988-02-17', 1989: '1989-02-06', 1990: '1990-01-27', 1991: '1991-02-15',
  1992: '1992-02-04', 1993: '1993-01-23', 1994: '1994-02-10', 1995: '1995-01-31',
  1996: '1996-02-19', 1997: '1997-02-07', 1998: '1998-01-28', 1999: '1999-02-16',
  2000: '2000-02-05', 2001: '2001-01-24', 2002: '2002-02-12', 2003: '2003-02-01',
  2004: '2004-01-22', 2005: '2005-02-09', 2006: '2006-01-29', 2007: '2007-02-18',
  2008: '2008-02-07', 2009: '2009-01-26', 2010: '2010-02-14', 2011: '2011-02-03',
  2012: '2012-01-23', 2013: '2013-02-10', 2014: '2014-01-31', 2015: '2015-02-19',
  2016: '2016-02-08', 2017: '2017-01-28', 2018: '2018-02-16', 2019: '2019-02-05',
  2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01', 2023: '2023-01-22',
  2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
};

export function getCorrectedChineseYear(birthDate: string): number {
  // birthDate au format 'YYYY-MM-DD'
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y) return 1995;

  // Si né en janvier ou février, vérifier si avant le Nouvel An chinois
  if (m <= 2) {
    const lunarNY = LUNAR_NEW_YEAR[y];
    if (lunarNY) {
      const [lny, lnm, lnd] = lunarNY.split('-').map(Number);
      const birthBeforeLunarNY = (m < lnm) || (m === lnm && d < lnd);
      if (birthBeforeLunarNY) return y - 1; // Année zodiacale précédente
    }
  }
  return y;
}

// Pilier horaire (Bazi simplifié) — l'animal associé à l'heure de naissance.
// 12 tronçons de 2 heures, chacun correspond à un animal.
const HOUR_ANIMALS = ['Rat', 'Bœuf', 'Tigre', 'Lièvre', 'Dragon', 'Serpent', 'Cheval', 'Chèvre', 'Singe', 'Coq', 'Chien', 'Cochon'];
const HOUR_EMOJIS = ['🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐', '🐒', '🐓', '🐕', '🐖'];

export function getHourPillar(time: string): { animal: string; emoji: string } | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h] = time.split(':').map(Number);
  // 23h-1h = Rat (index 0), 1h-3h = Bœuf (1), etc.
  const idx = Math.floor(((h + 1) % 24) / 2);
  return { animal: HOUR_ANIMALS[idx], emoji: HOUR_EMOJIS[idx] };
}

export const CHINESE_ANIMALS: ChineseAnimal[] = [
  {
    id: 0, name: "Rat", chinese: "\u9F20", emoji: "\u{1F400}",
    years: [1948, 1960, 1972, 1984, 1996, 2008, 2020, 2032],
    traits: ["Malin", "Adaptable", "Charmeur", "Ambitieux"],
    strengths: "Intelligence vive, opportunisme, sociabilité. Le Rat voit des opportunités là où d'autres voient des obstacles. Il sait retourner les situations à son avantage.",
    weaknesses: "Peut être manipulateur, anxieux, trop matérialiste. Son mental bouillonnant peut le mener à l'épuisement.",
    compatibility: [3, 7, 4], incompatible: [5, 2],
    element: "Eau", planet: "Mercure", western: "Sagittaire",
    description: "Le Rat ouvre le cycle du zodiaque chinois. Vif d'esprit et débrouillard, il est le stratège né qui transforme chaque contrainte en opportunité.",
    luckyNumber: 2, luckyColor: "Bleu", luckyDirection: "Nord", bestCareer: "Stratégie, commerce, écriture",
    forecast2025: "Le Serpent de Bois 2025 te demande de ralentir et d'écouter ton intuition. C'est une année de réflexion stratégique, pas d'action précipitée. Les opportunités viendront en automne. Évite les investissements impulsifs au printemps.",
  },
  {
    id: 1, name: "Bœuf", chinese: "\u725B", emoji: "\u{1F402}",
    years: [1949, 1961, 1973, 1985, 1997, 2009, 2021, 2033],
    traits: ["Persévérant", "Fiable", "Patient", "Fort"],
    strengths: "Endurance, loyauté, sens du devoir. Le Bœuf construit sur du solide et ne lâche jamais. Quand il s'engage, c'est pour la vie.",
    weaknesses: "Têtu, rigide, parfois lent à s'adapter. Sa force peut devenir sa prison s'il refuse le changement.",
    compatibility: [4, 9, 8], incompatible: [7, 6],
    element: "Terre", planet: "Saturne", western: "Capricorne",
    description: "Le Bœuf incarne la force tranquille et la persévérance méthodique. Il est le pilier sur lequel les autres s'appuient.",
    luckyNumber: 9, luckyColor: "Jaune", luckyDirection: "Sud-Est", bestCareer: "Architecture, finance, agriculture",
    forecast2025: "Le Serpent t'apporte une stabilité bienvenue après les turbulences du Dragon. Tes efforts passés commencent à porter leurs fruits. Le milieu de l'année sera particulièrement favorable pour tes projets à long terme. Reste fidèle à ta méthode.",
  },
  {
    id: 2, name: "Tigre", chinese: "\u864E", emoji: "\u{1F405}",
    years: [1950, 1962, 1974, 1986, 1998, 2010, 2022, 2034],
    traits: ["Audacieux", "Passionné", "Rebelle", "Charismatique"],
    strengths: "Courage, leadership naturel, magnétisme. Le Tigre ne craint aucun défi et entraîne les autres par sa fougue.",
    weaknesses: "Impulsif, autoritaire, parfois égoïste. Son feu peut brûler ceux qui l'entourent s'il ne le maîtrise pas.",
    compatibility: [5, 7, 6], incompatible: [0, 8],
    element: "Bois", planet: "Mars", western: "Bélier",
    description: "Le Tigre est la flamme sauvage du zodiaque, un rebelle au cœur noble qui défend les faibles et brave l'impossible.",
    luckyNumber: 1, luckyColor: "Orange", luckyDirection: "Est", bestCareer: "Entrepreneuriat, militaire, leadership",
    forecast2025: "Le Serpent te demande de canaliser ton énergie. Ce n'est pas une année pour foncer tête baissée, mais pour stratégiser. Ta patience sera récompensée en fin d'année. Une rencontre importante est probable en été.",
  },
  {
    id: 3, name: "Lièvre", chinese: "\u5154", emoji: "\u{1F407}",
    years: [1951, 1963, 1975, 1987, 1999, 2011, 2023, 2035],
    traits: ["Doux", "Diplomate", "Artiste", "Intuitif"],
    strengths: "Grâce, empathie, sens esthétique. Le Lièvre apaise les tensions et crée l'harmonie autour de lui.",
    weaknesses: "Indécis, fuit les conflits, parfois nerveux. Sa douceur peut le rendre passif face aux situations qui exigent fermeté.",
    compatibility: [0, 7, 4], incompatible: [6, 10],
    element: "Bois", planet: "Vénus", western: "Balance",
    description: "Le Lièvre cultive l'harmonie, la beauté et la diplomatie. Il est l'artiste du zodiaque, sensible aux nuances et aux atmosphères.",
    luckyNumber: 3, luckyColor: "Rose", luckyDirection: "Sud", bestCareer: "Art, diplomatie, psychologie, design",
    forecast2025: "Le Serpent est ton allié en 2025. C'est une année de créativité et de croissance intérieure. Ton intuition sera particulièrement forte — fais-lui confiance. Une opportunité artistique ou relationnelle se présentera au printemps.",
  },
  {
    id: 4, name: "Dragon", chinese: "\u9F99", emoji: "\u{1F409}",
    years: [1952, 1964, 1976, 1988, 2000, 2012, 2024, 2036],
    traits: ["Majestueux", "Visionnaire", "Puissant", "Chanceux"],
    strengths: "Ambition, créativité, aura. Le Dragon ne passe jamais inaperçu. Il inspire le respect et l'admiration.",
    weaknesses: "Arrogant, exigeant, parfois mégalomane. Sa puissance peut l'écraser s'il ne l'utilise pas avec sagesse.",
    compatibility: [0, 8, 1], incompatible: [5, 7],
    element: "Terre", planet: "Jupiter", western: "Lion",
    description: "Le Dragon est l'être mythique suprême, symbole de chance, de pouvoir et de transformation. Il est le seul animal légendaire du zodiaque.",
    luckyNumber: 6, luckyColor: "Or", luckyDirection: "Nord-Ouest", bestCareer: "CEO, innovation, politique",
    forecast2025: "Après ton année (Dragon 2024), le Serpent t'invite à consolider. C'est le moment de transformer tes visions en réalités concrètes. Une collaboration importante se profile. Attention aux excès de confiance au printemps.",
  },
  {
    id: 5, name: "Serpent", chinese: "\u86C7", emoji: "\u{1F40D}",
    years: [1953, 1965, 1977, 1989, 2001, 2013, 2025, 2037],
    traits: ["Sage", "Mystérieux", "Stratège", "Fascinant"],
    strengths: "Profondeur d'esprit, intuition, charisme hypnotique. Le Serpent voit ce que les autres ne voient pas.",
    weaknesses: "Secretif, jaloux, parfois manipulateur. Son ombre peut le consumer s'il ne la regarde pas en face.",
    compatibility: [8, 2, 4], incompatible: [6, 10, 9],
    element: "Feu", planet: "Pluton", western: "Scorpion",
    description: "Le Serpent est le gardien des secrets, sage et séduisant. Il représente la transformation, la guérison et la connaissance cachée.",
    luckyNumber: 8, luckyColor: "Rouge", luckyDirection: "Sud", bestCareer: "Recherche, psychologie, spiritualité, finance",
    forecast2025: "C'est TON année. Le Serpent de Bois te donne la parole. C'est une année de transformation profonde — une mue. Tout ce que tu entreprends maintenant a un potentiel de long terme. Écoute ton intuition, elle ne te trompera pas.",
  },
  {
    id: 6, name: "Cheval", chinese: "\u9A6C", emoji: "\u{1F40E}",
    years: [1954, 1966, 1978, 1990, 2002, 2014, 2026, 2038],
    traits: ["Libre", "Énergique", "Sociable", "Aventurier"],
    strengths: "Vitalité, indépendance, éloquence. Le Cheval vit intensément et entraîne les autres dans son sillage.",
    weaknesses: "Impatient, fuyant, parfois superficiel. Sa soif de liberté peut le couper de ses engagements.",
    compatibility: [2, 7, 11], incompatible: [5, 1, 10],
    element: "Feu", planet: "Soleil", western: "Gémeaux",
    description: "Le Cheval incarne la liberté, le mouvement et la passion de vivre. Il galope vers l'horizon sans regarder en arrière.",
    luckyNumber: 7, luckyColor: "Pourpre", luckyDirection: "Sud-Ouest", bestCareer: "Voyage, communication, sport, commerce",
    forecast2025: "Le Serpent te demande de ralentir, ce qui n'est pas naturel pour toi. C'est une année de repos stratégique. Prépare tes projets en douceur — l'année du Cheval (2026) sera ton grand bond. Sois patient, ta viendra.",
  },
  {
    id: 7, name: "Chèvre", chinese: "\u7F8A", emoji: "\u{1F410}",
    years: [1955, 1967, 1979, 1991, 2003, 2015, 2027, 2039],
    traits: ["Créatif", "Bienveillant", "Rêveur", "Calme"],
    strengths: "Sensibilité artistique, compassion, douceur. La Chèvre crée la beauté et apaise les coeurs.",
    weaknesses: "Trop sensible, pessimiste, dépendant. Sa fragilité peut le rendre dépendant des autres.",
    compatibility: [10, 2, 11], incompatible: [0, 4],
    element: "Terre", planet: "Lune", western: "Poissons",
    description: "La Chèvre est l'âme artiste du zodiaque, douce et compatissante. Elle voit le monde en couleurs que les autres ne perçoivent pas.",
    luckyNumber: 5, luckyColor: "Vert", luckyDirection: "Nord", bestCareer: "Art, mode, soin, musique, cuisine",
    forecast2025: "Le Serpent t'apporte une inspiration profonde en 2025. Ta créativité sera au sommet. C'est l'année pour lancer ce projet artistique qui te tient à coeur. Une aide inattendue viendra d'une personne plus âgée ou plus sage.",
  },
  {
    id: 8, name: "Singe", chinese: "\u7334", emoji: "\u{1F412}",
    years: [1956, 1968, 1980, 1992, 2004, 2016, 2028, 2040],
    traits: ["Malin", "Joueur", "Innovant", "Curieux"],
    strengths: "Intelligence rapide, humour, créativité. Le Singe trouve des solutions que personne n'imagine.",
    weaknesses: "Trompeur, agité, insolent. Sa malice peut se retourner contre lui s'il ne fait pas confiance.",
    compatibility: [4, 1, 0], incompatible: [5, 7],
    element: "Metal", planet: "Mercure", western: "Verseau",
    description: "Le Singe est le génie facétieux du zodiaque, inventif et plein de malice. Il bouscule les conventions avec un sourire.",
    luckyNumber: 4, luckyColor: "Blanc", luckyDirection: "Ouest", bestCareer: "Tech, innovation, humour, négociation",
    forecast2025: "Le Serpent t'invite à la profondeur. Ton esprit vif sera mis à contribution pour résoudre un problème complexe. Une opportunité financière astucieuse se présente en été. Attention aux querelles inutiles en automne.",
  },
  {
    id: 9, name: "Coq", chinese: "\u9E21", emoji: "\u{1F413}",
    years: [1957, 1969, 1981, 1993, 2005, 2017, 2029, 2041],
    traits: ["Précis", "Orgueilleux", "Franc", "Travailleur"],
    strengths: "Rigueur, honnêteté, sens du détail. Le Coq voit tout, remarque tout, et ne laisse rien au hasard.",
    weaknesses: "Critique, vaniteux, rigide. Son perfectionnisme peut l'isoler des autres.",
    compatibility: [4, 8, 1], incompatible: [5, 7],
    element: "Metal", planet: "Uranus", western: "Vierge",
    description: "Le Coq est le perfectionniste du zodiaque, fier et méticuleux. Il est le gardien de l'ordre et de la précision.",
    luckyNumber: 10, luckyColor: "Bronze", luckyDirection: "Ouest", bestCareer: "Comptabilité, droit, journalisme, design",
    forecast2025: "Le Serpent te demande de lâcher ton perfectionnisme. En 2025, le 'assez bien' vaut mieux que le 'parfait'. Une réorganisation professionnelle est possible. Surveille ta santé au printemps — le stress pourrait te jouer des tours.",
  },
  {
    id: 10, name: "Chien", chinese: "\u72D7", emoji: "\u{1F415}",
    years: [1958, 1970, 1982, 1994, 2006, 2018, 2030, 2042],
    traits: ["Loyal", "Juste", "Protecteur", "Honnête"],
    strengths: "Fidélité, intégrité, sens de la justice. Le Chien défend ceux qu'il aime sans compter.",
    weaknesses: "Cynique, anxieux, critique. Sa méfiance peut le couper des opportunités.",
    compatibility: [2, 7, 11], incompatible: [5, 1],
    element: "Terre", planet: "Saturne", western: "Balance",
    description: "Le Chien est le gardien loyal, justicier du zodiaque chinois. Il représente la justice, la loyauté et le dévouement.",
    luckyNumber: 11, luckyColor: "Marron", luckyDirection: "Est", bestCareer: "Justice, sécurité, enseignement, association",
    forecast2025: "Le Serpent t'apporte clarté et discernement. En 2025, tes intuitions sur les gens se révéleront justes. Une amitié profonde peut évoluer vers quelque chose de plus grand. Attention aux disputes familiales en été — garde ton calme.",
  },
  {
    id: 11, name: "Cochon", chinese: "\u732A", emoji: "\u{1F437}",
    years: [1959, 1971, 1983, 1995, 2007, 2019, 2031, 2043],
    traits: ["Généreux", "Gourmand", "Sincère", "Bon vivant"],
    strengths: "Bon cœur, générosité, appétit pour la vie. Le Cochon savoure chaque instant et partage sa joie.",
    weaknesses: "Naïf, trop crédule, matérialiste. Sa générosité peut être exploitée.",
    compatibility: [2, 7, 10], incompatible: [1, 5],
    element: "Eau", planet: "Jupiter", western: "Taureau",
    description: "Le Cochon clôt le cycle avec chaleur, générosité et amour de la vie. Il représente l'abondance, la sincérité et le bonheur simple.",
    luckyNumber: 12, luckyColor: "Doré", luckyDirection: "Nord-Ouest", bestCareer: "Gastronomie, hôtellerie, charité, arts",
    forecast2025: "Le Serpent t'apporte une année de récolte. Ce que tu as semé en patience commence à porter ses fruits. Une opportunité financière est probable en automne. Veille à ton énergie — le Serpent peut te rendre introspectif, ce n'est pas naturel pour toi.",
  },
];

export const CHINESE_ELEMENTS: ChineseElement[] = [
  { name: "Bois", chinese: "\u6728", emoji: "\u{1F33F}", qualities: "Croissance, créativité, bienveillance. L'énergie du printemps et du renouveau.", color: "Vert", planet: "Jupiter", nourishes: "Feu", controls: "Terre" },
  { name: "Feu", chinese: "\u706B", emoji: "\u{1F525}", qualities: "Passion, transformation, opportunité. L'énergie de l'été et de l'illumination.", color: "Rouge", planet: "Mars", nourishes: "Terre", controls: "Metal" },
  { name: "Terre", chinese: "\u571F", emoji: "\u{1F30F}", qualities: "Stabilité, nourriture, foi. L'énergie du centre et de l'ancrage.", color: "Jaune", planet: "Saturne", nourishes: "Metal", controls: "Eau" },
  { name: "Metal", chinese: "\u91D1", emoji: "\u2728", qualities: "Rigueur, justice, intégrité. L'énergie de l'automne et de la précision.", color: "Blanc", planet: "Vénus", nourishes: "Eau", controls: "Bois" },
  { name: "Eau", chinese: "\u6C34", emoji: "\u{1F30A}", qualities: "Sagesse, fluidité, communication. L'énergie de l'hiver et de la profondeur.", color: "Noir", planet: "Mercure", nourishes: "Bois", controls: "Feu" },
];

// Score de compatibilité détaillé entre deux animaux (0-100)
const COMPATIBILITY_SCORES: Record<string, number> = {
  '0-3': 92, '0-7': 88, '0-4': 85, '0-5': 35, '0-2': 40,
  '1-4': 90, '1-9': 87, '1-8': 85, '1-7': 38, '1-6': 42,
  '2-5': 89, '2-7': 86, '2-6': 84, '2-0': 38, '2-8': 35,
  '3-0': 92, '3-7': 88, '3-4': 83, '3-6': 36, '3-10': 40,
  '4-0': 85, '4-8': 90, '4-1': 86, '4-5': 35, '4-7': 38,
  '5-8': 91, '5-2': 89, '5-4': 82, '5-6': 34, '5-10': 36,
  '6-2': 84, '6-7': 86, '6-11': 85, '6-5': 34, '6-1': 38,
  '7-10': 90, '7-2': 86, '7-11': 84, '7-0': 40, '7-4': 38,
  '8-4': 90, '8-1': 85, '8-0': 84, '8-5': 38, '8-7': 36,
  '9-4': 87, '9-8': 85, '9-1': 86, '9-5': 35, '9-7': 38,
  '10-2': 84, '10-7': 88, '10-11': 90, '10-5': 36, '10-1': 38,
  '11-2': 85, '11-7': 84, '11-10': 90, '11-1': 36, '11-5': 34,
};

export function getCompatibilityScore(id1: number, id2: number): number {
  const key1 = `${id1}-${id2}`;
  const key2 = `${id2}-${id1}`;
  return COMPATIBILITY_SCORES[key1] ?? COMPATIBILITY_SCORES[key2] ?? 60;
}

export function getChineseZodiac(year: number): ChineseAnimal {
  const idx = ((year - 4) % 12 + 12) % 12;
  return CHINESE_ANIMALS[idx];
}

export function getChineseElement(year: number): ChineseElement {
  const mod = ((year - 4) % 10 + 10) % 10;
  const elementIdx = Math.floor(mod / 2);
  return CHINESE_ELEMENTS[elementIdx];
}

export function getYinYang(year: number): "Yin" | "Yang" {
  return year % 2 === 0 ? "Yang" : "Yin";
}