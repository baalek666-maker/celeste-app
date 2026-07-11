// Astrologie chinoise - 12 animaux, 5 elements, Yin/Yang
// Calcule le signe chinois a partir de l annee de naissance

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

export const CHINESE_ANIMALS: ChineseAnimal[] = [
  {
    id: 0,
    name: "Rat",
    chinese: "\u9F20",
    emoji: "\u{1F400}",
    years: [1948, 1960, 1972, 1984, 1996, 2008, 2020, 2032],
    traits: ["Malin", "Adaptable", "Charmeur", "Ambitieux"],
    strengths: "Intelligence vive, opportunisme, sociabilite. Le Rat voit des opportunites ou d autres voient des obstacles.",
    weaknesses: "Peut etre manipulateur, anxieux, trop materialiste.",
    compatibility: [3, 7, 4],
    incompatible: [5, 2],
    element: "Eau",
    planet: "Mercure",
    western: "Sagittaire",
    description: "Le Rat ouvre le cycle du zodiaque chinois. Vif d esprit et resourceful, il est le strategiste ne.",
  },
  {
    id: 1,
    name: "Boeuf",
    chinese: "\u725B",
    emoji: "\u{1F402}",
    years: [1949, 1961, 1973, 1985, 1997, 2009, 2021, 2033],
    traits: ["Perseverant", "Fiable", "Patient", "Fort"],
    strengths: "Endurance, loyaute, sens du devoir. Le Boeuf construit sur du solide.",
    weaknesses: "Tetiu, rigide, parfois lent a s adapter.",
    compatibility: [4, 9, 8],
    incompatible: [7, 6],
    element: "Terre",
    planet: "Saturne",
    western: "Capricorne",
    description: "Le Boeuf incarne la force tranquille et la perseeverance methodique.",
  },
  {
    id: 2,
    name: "Tigre",
    chinese: "\u864E",
    emoji: "\u{1F405}",
    years: [1950, 1962, 1974, 1986, 1998, 2010, 2022, 2034],
    traits: ["Audacieux", "Passione", "Rebelle", "Charismatique"],
    strengths: "Courage, leadership naturel, magnetisme. Le Tigre ne craint aucun defi.",
    weaknesses: "Impulsif, autoritaire, parfois egoiste.",
    compatibility: [5, 7, 6],
    incompatible: [0, 8],
    element: "Bois",
    planet: "Mars",
    western: "Belier",
    description: "Le Tigre est la flamme sauvage du zodiaque, un rebelle au coeur noble.",
  },
  {
    id: 3,
    name: "Lievre",
    chinese: "\u5154",
    emoji: "\u{1F407}",
    years: [1951, 1963, 1975, 1987, 1999, 2011, 2023, 2035],
    traits: ["Doux", "Diplomate", "Artiste", "Intuitif"],
    strengths: "Grace, empathie, sens esthetique. Le Lievre apaise les tensions.",
    weaknesses: "Indecis, trop evite les conflits, nervosite.",
    compatibility: [0, 7, 4],
    incompatible: [3, 10],
    element: "Bois",
    planet: "Venus",
    western: "Balance",
    description: "Le Lievre cultive l harmonie, la beaute et la diplomatie.",
  },
  {
    id: 4,
    name: "Dragon",
    chinese: "\u9F99",
    emoji: "\u{1F409}",
    years: [1952, 1964, 1976, 1988, 2000, 2012, 2024, 2036],
    traits: ["Majestueux", "Visionnaire", "Puissant", "Chanceux"],
    strengths: "Ambition, creativite, aura. Le Dragon ne passe jamais inapercu.",
    weaknesses: "Arrogant, exigeant, parfois megalomane.",
    compatibility: [0, 8, 1],
    incompatible: [5, 7],
    element: "Terre",
    planet: "Jupiter",
    western: "Lion",
    description: "Le Dragon est l etre mythique supreme, symbole de chance et de pouvoir.",
  },
  {
    id: 5,
    name: "Serpent",
    chinese: "\u86C7",
    emoji: "\u{1F40D}",
    years: [1953, 1965, 1977, 1989, 2001, 2013, 2025, 2037],
    traits: ["Sage", "Mysterieux", "Stratege", "Fascinant"],
    strengths: "Profondeur d esprit, intuition, charisme hypnotique.",
    weaknesses: "Secretif, jaloux, parfois manipulateur.",
    compatibility: [7, 8, 2],
    incompatible: [4, 10, 5],
    element: "Feu",
    planet: "Pluton",
    western: "Scorpion",
    description: "Le Serpent est le gardien des secrets, sage et seduisant.",
  },
  {
    id: 6,
    name: "Cheval",
    chinese: "\u9A6C",
    emoji: "\u{1F40E}",
    years: [1954, 1966, 1978, 1990, 2002, 2014, 2026, 2038],
    traits: ["Libre", "Energique", "Sociable", "Aventurier"],
    strengths: "Vitalite, independance, eloquence.",
    weaknesses: "Impatient, fuyant, parfois superficiel.",
    compatibility: [2, 7, 11],
    incompatible: [5, 11, 10],
    element: "Feu",
    planet: "Soleil",
    western: "Gemeaux",
    description: "Le Cheval incarne la liberte, le mouvement et la passion de vivre.",
  },
  {
    id: 7,
    name: "Chevre",
    chinese: "\u7F8A",
    emoji: "\u{1F410}",
    years: [1955, 1967, 1979, 1991, 2003, 2015, 2027, 2039],
    traits: ["Creatif", "Bienveillant", "Reveur", "Calme"],
    strengths: "Sensibilite artistique, compassion, douceur.",
    weaknesses: "Trop sensible, pessimiste, dependant.",
    compatibility: [7, 10, 2],
    incompatible: [0, 4],
    element: "Terre",
    planet: "Lune",
    western: "Poissons",
    description: "La Chevre est l ame artiste du zodiaque, douce et compatissante.",
  },
  {
    id: 8,
    name: "Singe",
    chinese: "\u7334",
    emoji: "\u{1F412}",
    years: [1956, 1968, 1980, 1992, 2004, 2016, 2028, 2040],
    traits: ["Malin", "Joueur", "Innovant", "Curieux"],
    strengths: "Intelligence rapide, humour, creativite.",
    weaknesses: "Trompeur, agite, insolent.",
    compatibility: [4, 8, 0],
    incompatible: [5, 1],
    element: "Metal",
    planet: "Mercure",
    western: "Verseau",
    description: "Le Singe est le genie facétieux du zodiaque, inventif et plein de malice.",
  },
  {
    id: 9,
    name: "Coq",
    chinese: "\u9E21",
    emoji: "\u{1F413}",
    years: [1957, 1969, 1981, 1993, 2005, 2017, 2029, 2041],
    traits: ["Precis", "Orgueilleux", "Franc", "Travailleur"],
    strengths: "Rigueur, honnetete, sens du detail.",
    weaknesses: "Critique, vaniteux, rigide.",
    compatibility: [4, 8, 1],
    incompatible: [5, 7],
    element: "Metal",
    planet: "Uranus",
    western: "Vierge",
    description: "Le Coq est le perfectionniste du zodiaque, fier et meticuleux.",
  },
  {
    id: 10,
    name: "Chien",
    chinese: "\u72D7",
    emoji: "\u{1F415}",
    years: [1958, 1970, 1982, 1994, 2006, 2018, 2030, 2042],
    traits: ["Loyal", "Juste", "Protecteur", "Honnete"],
    strengths: "Fidelite, integrite, sens de la justice.",
    weaknesses: "Cynique, anxieux, critique.",
    compatibility: [2, 7, 10],
    incompatible: [5, 7],
    element: "Terre",
    planet: "Saturne",
    western: "Balance",
    description: "Le Chien est le gardien loyal, justicier du zodiaque chinois.",
  },
  {
    id: 11,
    name: "Cochon",
    chinese: "\u732A",
    emoji: "\u{1F437}",
    years: [1959, 1971, 1983, 1995, 2007, 2019, 2031, 2043],
    traits: ["Genereux", "Gourmand", "Sincere", "Bon vivant"],
    strengths: "Bonheart, generosite, appetit pour la vie.",
    weaknesses: "Niaf, trop credule, materialiste.",
    compatibility: [2, 7, 10],
    incompatible: [5, 7],
    element: "Eau",
    planet: "Jupiter",
    western: "Taureau",
    description: "Le Cochon clot le cycle avec chaleur, generosite et amour de la vie.",
  },
];

export const CHINESE_ELEMENTS: ChineseElement[] = [
  {
    name: "Bois",
    chinese: "\u6728",
    emoji: "\u{1F33F}",
    qualities: "Croissance, creativite, benevolence",
    color: "Vert",
    planet: "Jupiter",
    nourishes: "Feu",
    controls: "Terre",
  },
  {
    name: "Feu",
    chinese: "\u706B",
    emoji: "\u{1F525}",
    qualities: "Passion, transformation, opportunite",
    color: "Rouge",
    planet: "Mars",
    nourishes: "Terre",
    controls: "Metal",
  },
  {
    name: "Terre",
    chinese: "\u571F",
    emoji: "\u{1F30F}",
    qualities: "Stabilite, nourriture, foi",
    color: "Jaune",
    planet: "Saturne",
    nourishes: "Metal",
    controls: "Eau",
  },
  {
    name: "Metal",
    chinese: "\u91D1",
    emoji: "\u2728",
    qualities: "Rigueur, justice, integrite",
    color: "Blanc",
    planet: "Venus",
    nourishes: "Eau",
    controls: "Bois",
  },
  {
    name: "Eau",
    chinese: "\u6C34",
    emoji: "\u{1F30A}",
    qualities: "Sagesse, fluidite, communication",
    color: "Noir",
    planet: "Mercure",
    nourishes: "Bois",
    controls: "Feu",
  },
];

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
