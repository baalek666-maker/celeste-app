// Astrologie chinoise - 12 animaux, 5 éléments, Yin/Yang
// Calcule le signe chinois à partir de l'année de naissance

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
    strengths: "Intelligence vive, opportunisme, sociabilité. Le Rat voit des opportunités où d'autres voient des obstacles.",
    weaknesses: "Peut être manipulateur, anxieux, trop matérialiste.",
    compatibility: [3, 7, 4],
    incompatible: [5, 2],
    element: "Eau",
    planet: "Mercure",
    western: "Sagittaire",
    description: "Le Rat ouvre le cycle du zodiaque chinois. Vif d'esprit et débrouillard, il est le stratège né.",
  },
  {
    id: 1,
    name: "Bœuf",
    chinese: "\u725B",
    emoji: "\u{1F402}",
    years: [1949, 1961, 1973, 1985, 1997, 2009, 2021, 2033],
    traits: ["Persévérant", "Fiable", "Patient", "Fort"],
    strengths: "Endurance, loyauté, sens du devoir. Le Bœuf construit sur du solide.",
    weaknesses: "Têtu, rigide, parfois lent à s'adapter.",
    compatibility: [4, 9, 8],
    incompatible: [7, 6],
    element: "Terre",
    planet: "Saturne",
    western: "Capricorne",
    description: "Le Bœuf incarne la force tranquille et la persévérance méthodique.",
  },
  {
    id: 2,
    name: "Tigre",
    chinese: "\u864E",
    emoji: "\u{1F405}",
    years: [1950, 1962, 1974, 1986, 1998, 2010, 2022, 2034],
    traits: ["Audacieux", "Passionné", "Rebelle", "Charismatique"],
    strengths: "Courage, leadership naturel, magnétisme. Le Tigre ne craint aucun défi.",
    weaknesses: "Impulsif, autoritaire, parfois égoïste.",
    compatibility: [5, 7, 6],
    incompatible: [0, 8],
    element: "Bois",
    planet: "Mars",
    western: "Bélier",
    description: "Le Tigre est la flamme sauvage du zodiaque, un rebelle au cœur noble.",
  },
  {
    id: 3,
    name: "Lièvre",
    chinese: "\u5154",
    emoji: "\u{1F407}",
    years: [1951, 1963, 1975, 1987, 1999, 2011, 2023, 2035],
    traits: ["Doux", "Diplomate", "Artiste", "Intuitif"],
    strengths: "Grâce, empathie, sens esthétique. Le Lièvre apaise les tensions.",
    weaknesses: "Indécis, trop évite les conflits, nervosité.",
    compatibility: [0, 7, 4],
    incompatible: [6, 10],
    element: "Bois",
    planet: "Vénus",
    western: "Balance",
    description: "Le Lièvre cultive l'harmonie, la beauté et la diplomatie.",
  },
  {
    id: 4,
    name: "Dragon",
    chinese: "\u9F99",
    emoji: "\u{1F409}",
    years: [1952, 1964, 1976, 1988, 2000, 2012, 2024, 2036],
    traits: ["Majestueux", "Visionnaire", "Puissant", "Chanceux"],
    strengths: "Ambition, créativité, aura. Le Dragon ne passe jamais inaperçu.",
    weaknesses: "Arrogant, exigeant, parfois mégalomane.",
    compatibility: [0, 8, 1],
    incompatible: [5, 7],
    element: "Terre",
    planet: "Jupiter",
    western: "Lion",
    description: "Le Dragon est l'être mythique suprême, symbole de chance et de pouvoir.",
  },
  {
    id: 5,
    name: "Serpent",
    chinese: "\u86C7",
    emoji: "\u{1F40D}",
    years: [1953, 1965, 1977, 1989, 2001, 2013, 2025, 2037],
    traits: ["Sage", "Mystérieux", "Stratège", "Fascinant"],
    strengths: "Profondeur d'esprit, intuition, charisme hypnotique.",
    weaknesses: "Secretif, jaloux, parfois manipulateur.",
    compatibility: [8, 2, 4],
    incompatible: [6, 10, 9],
    element: "Feu",
    planet: "Pluton",
    western: "Scorpion",
    description: "Le Serpent est le gardien des secrets, sage et séduisant.",
  },
  {
    id: 6,
    name: "Cheval",
    chinese: "\u9A6C",
    emoji: "\u{1F40E}",
    years: [1954, 1966, 1978, 1990, 2002, 2014, 2026, 2038],
    traits: ["Libre", "Énergique", "Sociable", "Aventurier"],
    strengths: "Vitalité, indépendance, éloquence.",
    weaknesses: "Impatient, fuyant, parfois superficiel.",
    compatibility: [2, 7, 11],
    incompatible: [5, 1, 10],
    element: "Feu",
    planet: "Soleil",
    western: "Gémeaux",
    description: "Le Cheval incarne la liberté, le mouvement et la passion de vivre.",
  },
  {
    id: 7,
    name: "Chèvre",
    chinese: "\u7F8A",
    emoji: "\u{1F410}",
    years: [1955, 1967, 1979, 1991, 2003, 2015, 2027, 2039],
    traits: ["Créatif", "Bienveillant", "Rêveur", "Calme"],
    strengths: "Sensibilité artistique, compassion, douceur.",
    weaknesses: "Trop sensible, pessimiste, dépendant.",
    compatibility: [10, 2, 11],
    incompatible: [0, 4],
    element: "Terre",
    planet: "Lune",
    western: "Poissons",
    description: "La Chèvre est l'âme artiste du zodiaque, douce et compatissante.",
  },
  {
    id: 8,
    name: "Singe",
    chinese: "\u7334",
    emoji: "\u{1F412}",
    years: [1956, 1968, 1980, 1992, 2004, 2016, 2028, 2040],
    traits: ["Malin", "Joueur", "Innovant", "Curieux"],
    strengths: "Intelligence rapide, humour, créativité.",
    weaknesses: "Trompeur, agité, insolent.",
    compatibility: [4, 1, 0],
    incompatible: [5, 7],
    element: "Metal",
    planet: "Mercure",
    western: "Verseau",
    description: "Le Singe est le génie facétieux du zodiaque, inventif et plein de malice.",
  },
  {
    id: 9,
    name: "Coq",
    chinese: "\u9E21",
    emoji: "\u{1F413}",
    years: [1957, 1969, 1981, 1993, 2005, 2017, 2029, 2041],
    traits: ["Précis", "Orgueilleux", "Franc", "Travailleur"],
    strengths: "Rigueur, honnêteté, sens du détail.",
    weaknesses: "Critique, vaniteux, rigide.",
    compatibility: [4, 8, 1],
    incompatible: [5, 7],
    element: "Metal",
    planet: "Uranus",
    western: "Vierge",
    description: "Le Coq est le perfectionniste du zodiaque, fier et méticuleux.",
  },
  {
    id: 10,
    name: "Chien",
    chinese: "\u72D7",
    emoji: "\u{1F415}",
    years: [1958, 1970, 1982, 1994, 2006, 2018, 2030, 2042],
    traits: ["Loyal", "Juste", "Protecteur", "Honnête"],
    strengths: "Fidélité, intégrité, sens de la justice.",
    weaknesses: "Cynique, anxieux, critique.",
    compatibility: [2, 7, 11],
    incompatible: [5, 1],
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
    traits: ["Généereux", "Gourmand", "Sincère", "Bon vivant"],
    strengths: "Bon cœur, générosité, appétit pour la vie.",
    weaknesses: "Naïf, trop crédule, matérialiste.",
    compatibility: [2, 7, 10],
    incompatible: [1, 5],
    element: "Eau",
    planet: "Jupiter",
    western: "Taureau",
    description: "Le Cochon clôt le cycle avec chaleur, générosité et amour de la vie.",
  },
];

export const CHINESE_ELEMENTS: ChineseElement[] = [
  {
    name: "Bois",
    chinese: "\u6728",
    emoji: "\u{1F33F}",
    qualities: "Croissance, créativité, bienveillance",
    color: "Vert",
    planet: "Jupiter",
    nourishes: "Feu",
    controls: "Terre",
  },
  {
    name: "Feu",
    chinese: "\u706B",
    emoji: "\u{1F525}",
    qualities: "Passion, transformation, opportunité",
    color: "Rouge",
    planet: "Mars",
    nourishes: "Terre",
    controls: "Metal",
  },
  {
    name: "Terre",
    chinese: "\u571F",
    emoji: "\u{1F30F}",
    qualities: "Stabilité, nourriture, foi",
    color: "Jaune",
    planet: "Saturne",
    nourishes: "Metal",
    controls: "Eau",
  },
  {
    name: "Metal",
    chinese: "\u91D1",
    emoji: "\u2728",
    qualities: "Rigueur, justice, intégrité",
    color: "Blanc",
    planet: "Vénus",
    nourishes: "Eau",
    controls: "Bois",
  },
  {
    name: "Eau",
    chinese: "\u6C34",
    emoji: "\u{1F30A}",
    qualities: "Sagesse, fluidité, communication",
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
