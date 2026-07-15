// Elder Futhark (Futhark ancien) - 24 runes pour la runomancie
// Chaque rune a: symbole Unicode, nom, traduction, poésie runique, signification divinatoire, élément astro

export interface RuneData {
  id: number;
  symbol: string;
  name: string;
  transliteration: string;
  meaning: string;
  poetry: string;
  upright: string;
  reversed: string;
  element: string;
  planet: string;
  zodiac: string;
  keyword: string;
  color: string;
}

export const ELDER_FUTHARK: RuneData[] = [
  {
    id: 1,
    symbol: "\u16A0",
    name: "Fehu",
    transliteration: "F",
    meaning: "Richesse, bétail",
    poetry: "La richesse est une consolation pour tous les hommes, mais beaucoup doit partager celui qui veut jeter les dés de la gloire.",
    upright: "Abondance matérielle et spirituelle. Succès financier, gain inattendu. Énergie créatrice qui circule librement.",
    reversed: "Perte matérielle, frustration, avarice. L'énergie est bloquée, la richesse se transforme en fardeau.",
    element: "Feu",
    planet: "Vénus",
    zodiac: "Taureau",
    keyword: "Abondance",
    color: "gold-400"
  },
  {
    id: 2,
    symbol: "\u16A2",
    name: "Uruz",
    transliteration: "U",
    meaning: "Auroch, force brute",
    poetry: "L'auroch est féroce et défie ses ennemis, une bête sauvage aux cornes immenses, un combattant redoutable.",
    upright: "Force vitale, santé, énergie brute. Le pouvoir de modeler ton destin par la volonté et l'endurance.",
    reversed: "Faiblesse, maladie, manque de volonté. Opportunités ratées par insécurité ou peur.",
    element: "Terre",
    planet: "Mars",
    zodiac: "Bélier",
    keyword: "Force",
    color: "red-400"
  },
  {
    id: 3,
    symbol: "\u16A6",
    name: "Thurisaz",
    transliteration: "Th",
    meaning: "Thorn, géant",
    poetry: "L'épine est très pointue pour tout homme qui la touche, cruelle pour ceux qui s'y reposent.",
    upright: "Protection, défense réactive. Une force cathartique qui détruit les obstacles. Le pouvoir du tonnerre.",
    reversed: "Trahison, danger caché, conflits inutiles. La force protectrice devient destructrice sans contrôle.",
    element: "Feu",
    planet: "Mars",
    zodiac: "Scorpion",
    keyword: "Protection",
    color: "orange-400"
  },
  {
    id: 4,
    symbol: "\u16A8",
    name: "Ansuz",
    transliteration: "A",
    meaning: "Dieu, message, souffle",
    poetry: "La bouche est la source de tout langage, pilier de la sagesse, consolation des sages.",
    upright: "Communication divine, révélation, messages des dieux. Inspiration, créativité, conseils sages.",
    reversed: "Malentendus, tromperie, mauvais conseils. L'information est déformée, la communication bloquée.",
    element: "Air",
    planet: "Mercure",
    zodiac: "Gémeaux",
    keyword: "Message",
    color: "blue-400"
  },
  {
    id: 5,
    symbol: "\u16B1",
    name: "Raidho",
    transliteration: "R",
    meaning: "Voyage, char",
    poetry: "Monter est pour tous un confort dans la selle, plus dur assis sur un fort cheval sur la route miliaire.",
    upright: "Voyage, mouvement, quête spirituelle. Tu es sur le bon chemin, le voyage est aussi important que la destination.",
    reversed: "Retards, plans déraillés, mauvaise direction. Le voyage physique ou spirituel rencontre des obstacles.",
    element: "Air",
    planet: "Mercure",
    zodiac: "Sagittaire",
    keyword: "Voyage",
    color: "green-400"
  },
  {
    id: 6,
    symbol: "\u16B2",
    name: "Kenaz",
    transliteration: "K",
    meaning: "Torche, savoir",
    poetry: "La torche est vivante pour chaque fils d'homme, claire et brillante, brûle le plus souvent quand les nobles se reposent.",
    upright: "Illumination, connaissance, création artistique. La lumière qui guide et transforme, feu contrôlé et maîtrisé.",
    reversed: "Ignorance, obscurité, perte d'espoir. Une relation s'éteint, une idée échoue faute de vision.",
    element: "Feu",
    planet: "Soleil",
    zodiac: "Lion",
    keyword: "Illumination",
    color: "yellow-400"
  },
  {
    id: 7,
    symbol: "\u16B7",
    name: "Gebo",
    transliteration: "G",
    meaning: "Don, partenariat",
    poetry: "La générosité apporte honneur et gloire à un homme, et le dote de vertus qui lui permettent de prospérer.",
    upright: "Don, échange équilibré, partenariat. Union sacrée, amitié profonde, don mutuel sans attente.",
    reversed: "Pas de rune inverse — Gebo est symétrique. Cependant, peut indiquer un don qui crée une dette ou un déséquilibre.",
    element: "Air",
    planet: "Vénus",
    zodiac: "Balance",
    keyword: "Don",
    color: "purple-400"
  },
  {
    id: 8,
    symbol: "\u16B9",
    name: "Wunjo",
    transliteration: "W",
    meaning: "Joie, bonheur",
    poetry: "La joie est pour celui qui connaît peu de chagrins, de douleurs et de troubles, et possède pour lui-même prospérité et bonheur.",
    upright: "Joie, harmonie, bien-être. Réalisation de souhaits, amitié, plaisir simple. La comédie après la tragédie.",
    reversed: "Tristesse, isolement, aliénation. Les désirs ne se réalisent pas, conflits dans les relations.",
    element: "Terre",
    planet: "Jupiter",
    zodiac: "Poissons",
    keyword: "Joie",
    color: "pink-400"
  },
  {
    id: 9,
    symbol: "\u16BA",
    name: "Hagalaz",
    transliteration: "H",
    meaning: "Grêle, destruction",
    poetry: "La grêle est le grain le plus froid des créations de Dieu, il vint avec la pluie, puis se transforma en eau.",
    upright: "Destruction nécessaire, forces élémentaires incontrôlables. Une crise qui nettoie le chemin pour le renouveau. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Hagalaz est une force primordiale. La destruction peut être évitée si on accepte le changement.",
    element: "Eau",
    planet: "Saturne",
    zodiac: "Capricorne",
    keyword: "Tempête",
    color: "cyan-400"
  },
  {
    id: 10,
    symbol: "\u16BE",
    name: "Nauthiz",
    transliteration: "N",
    meaning: "Besoin, contrainte",
    poetry: "Le besoin est un nœud coulant sur le nez, mais aide souvent à éviter le mal et à obtenir le salut.",
    upright: "Besoin, retard, friction. Les obstacles sont des maîtres. La frustration révèle ce qui doit changer.",
    reversed: "Détresse, oppression, mauvaise gestion de l'énergie. Résiste à la détresse en acceptant tes limites.",
    element: "Feu",
    planet: "Saturne",
    zodiac: "Verseau",
    keyword: "Besoin",
    color: "amber-500"
  },
  {
    id: 11,
    symbol: "\u16C1",
    name: "Isa",
    transliteration: "I",
    meaning: "Glace, stase",
    poetry: "La glace est très belle à voir, brillante et claire, un sol glissant que peu de gens peuvent gravir.",
    upright: "Stase, gel, pause nécessaire. Un temps d'arrêt pour réfléchir. La surface cache des profondeurs. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Isa est immobile par nature. La glace prolongée peut devenir stagnation permanente.",
    element: "Eau",
    planet: "Lune",
    zodiac: "Cancer",
    keyword: "Glace",
    color: "sky-300"
  },
  {
    id: 12,
    symbol: "\u16C3",
    name: "Jera",
    transliteration: "J",
    meaning: "Année, récolte",
    poetry: "L'année est joyeuse pour tous les hommes, quand le Dieu, roi du ciel, apporte la terre à la fructification.",
    upright: "Récolte, cycles, récompense après l'effort. La patience porte ses fruits. Un cycle naturel se complète. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Les cycles ne se pressent pas. Un retard dans la récolte, un cycle qui prend plus de temps.",
    element: "Terre",
    planet: "Jupiter",
    zodiac: "Vierge",
    keyword: "Récolte",
    color: "lime-400"
  },
  {
    id: 13,
    symbol: "\u16C7",
    name: "Eihwaz",
    transliteration: "Ei",
    meaning: "If, axe du monde",
    poetry: "L'if a une apparence extérieure rude, un arbre dur et ferme sur la terre, gardien des flammes.",
    upright: "Endurance, transformation, axe Yggdrasil. La mort et la renaissance comme processus naturel. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Eihwaz est l'arbre-monde. Confusion face au changement inévitable, résistance à la transformation.",
    element: "Tous",
    planet: "Pluton",
    zodiac: "Scorpion",
    keyword: "Endurance",
    color: "emerald-500"
  },
  {
    id: 14,
    symbol: "\u16C8",
    name: "Perthro",
    transliteration: "P",
    meaning: "Sort, coupe runique",
    poetry: "Le jeu de dés est toujours source de rire et de joie pour les hommes orgueilleux, assis ensemble dans la salle.",
    upright: "Mystère, sorts, révélation des secrets cachés. La coupe de Wyrd, la toile du destin. Chance inattendue.",
    reversed: "Stagnation, malaise, secrets indésirables. La connaissance du destin apporte la mélancolie plutôt que la joie.",
    element: "Eau",
    planet: "Neptune",
    zodiac: "Poissons",
    keyword: "Destin",
    color: "violet-400"
  },
  {
    id: 15,
    symbol: "\u16C9",
    name: "Algiz",
    transliteration: "Z",
    meaning: "Élan, protection",
    poetry: "Le roseau est l'herbe la plus haute, dans les marais elle croît et humide, elle brûle sang et blesse, et teint de rouge.",
    upright: "Protection divine, bouclier, connexion avec les dieux. Le canal entre le conscient et le superconscient. Guérison spirituelle.",
    reversed: "Vulnérabilité, danger caché, mauvaise influence. La protection disparaît, les énergies négatives pénètrent.",
    element: "Air",
    planet: "Uranus",
    zodiac: "Verseau",
    keyword: "Bouclier",
    color: "indigo-400"
  },
  {
    id: 16,
    symbol: "\u16CA",
    name: "Sowilo",
    transliteration: "S",
    meaning: "Soleil, victoire",
    poetry: "Le soleil est toujours une joie pour les marins dans leur voyage sur les vagues de la mer salée.",
    upright: "Succès, vitalité, victoire. La lumière du soleil qui éclaire tout. Réalisation du Soi, énergie illimitée. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Cependant, un soleil trop puissant brûle et aveugle. Succès qui conduit à l'orgueil.",
    element: "Feu",
    planet: "Soleil",
    zodiac: "Lion",
    keyword: "Soleil",
    color: "gold-300"
  },
  {
    id: 17,
    symbol: "\u16CF",
    name: "Tiwaz",
    transliteration: "T",
    meaning: "Tyr, justice, guerrier",
    poetry: "Tyr est une étoile qui garde la confiance des nobles, toujours sur son chemin, jamais dans la nuit.",
    upright: "Justice, sacrifice, courage. La voie du guerrier spirituel. Leadership droit, honneur, victoire par le sacrifice juste.",
    reversed: "Injustice, lâcheté, énergie gaspillée. Le guerrier perd sa cause, l'ego remplace le devoir.",
    element: "Air",
    planet: "Mars",
    zodiac: "Bélier",
    keyword: "Justice",
    color: "red-500"
  },
  {
    id: 18,
    symbol: "\u16D2",
    name: "Berkano",
    transliteration: "B",
    meaning: "Bouleau, déesse-mère",
    poetry: "Le bouleau n'a pas de fruit, pourtant porte des pousses sans pollinisation, il est beau par ses branches, chargé de feuillage.",
    upright: "Naissance, fertilité, nouveau départ. La Grande Mère. Croissance, régénération, protection familiale.",
    reversed: "Problèmes familiaux, stagnation, blocage créatif. La croissance est entravée, des conflits dans le foyer.",
    element: "Terre",
    planet: "Lune",
    zodiac: "Cancer",
    keyword: "Naissance",
    color: "green-300"
  },
  {
    id: 19,
    symbol: "\u16D6",
    name: "Ehwaz",
    transliteration: "E",
    meaning: "Cheval, partenariat",
    poetry: "Le cheval est pour les seigneurs une joie, fier dans sa force et là où les riches sur leurs chars vantent.",
    upright: "Partenariat, mouvement, progrès harmonieux. La confiance entre deux êtres. Voyage et transition en douceur.",
    reversed: "Méfiance, blocage, stagnation dans les relations. Le partenariat est déséquilibré, un partenaire tiraillé.",
    element: "Terre",
    planet: "Mercure",
    zodiac: "Gémeaux",
    keyword: "Union",
    color: "teal-400"
  },
  {
    id: 20,
    symbol: "\u16D7",
    name: "Mannaz",
    transliteration: "M",
    meaning: "Homme, humanité",
    poetry: "L'homme est la joie de l'homme, et doit être sage, mais cher homme, chacun peut te trahir.",
    upright: "Humanité, conscience de soi, interdépendance. La nature humaine dans toute sa complexité. Relations, communauté, identité.",
    reversed: "Isolation, égoïsme, trahison. L'humanité se tourne contre elle-même. Ego qui coupe les liens essentiels.",
    element: "Air",
    planet: "Mercure",
    zodiac: "Gémeaux",
    keyword: "Humanité",
    color: "slate-300"
  },
  {
    id: 21,
    symbol: "\u16DA",
    name: "Laguz",
    transliteration: "L",
    meaning: "Eau, intuition",
    poetry: "L'eau semble éternelle pour les hommes, s'ils doivent expédier les vaisseaux et décorer les bijoux de poissons.",
    upright: "Intuition, flux émotionnel, subconscient. L'eau primordiale. Sagesse instinctive, adaptabilité, fertilité spirituelle.",
    reversed: "Confusion, instabilité émotionnelle, illusions. L'eau stagne ou déborde. Perte de contact avec l'intuition.",
    element: "Eau",
    planet: "Lune",
    zodiac: "Cancer",
    keyword: "Intuition",
    color: "blue-300"
  },
  {
    id: 22,
    symbol: "\u16DC",
    name: "Ingwaz",
    transliteration: "Ng",
    meaning: "Ing, dieu de la fertilité",
    poetry: "Ing fut d'abord vu parmi les Danois de l'est, puis il repartit vers l'est sur les vagues, le chariot derrière lui.",
    upright: "Achèvement, libération, nouvelle phase. La graine qui attend sous terre. Gestation, potentiel prêt à éclore. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Cependant, énergie bloquée, affaires inachevées. Un cycle qui n'arrive pas à se clore.",
    element: "Terre",
    planet: "Vénus",
    zodiac: "Taureau",
    keyword: "Gestation",
    color: "emerald-400"
  },
  {
    id: 23,
    symbol: "\u16DE",
    name: "Dagaz",
    transliteration: "D",
    meaning: "Aube, jour",
    poetry: "Le jour est le messager du Dieu, lumière chère aux hommes, source de joie et de bonheur.",
    upright: "Aube, illumination, transformation radicale. Le point de bascule entre l'obscurité et la lumière. Éveil, espérance. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Cependant, un changement trop brusque peut déstabiliser. La lumière révèle des choses difficiles à voir.",
    element: "Feu",
    planet: "Soleil",
    zodiac: "Lion",
    keyword: "Aube",
    color: "amber-300"
  },
  {
    id: 24,
    symbol: "\u16DF",
    name: "Othala",
    transliteration: "O",
    meaning: "Héritage, patrie",
    poetry: "L'héritage est cher à chaque homme, s'il peut jouir de sa maison en paix, dans la prospérité.",
    upright: "Héritage, ancestral, racines. Le domaine spirituel et matériel hérité. Loyauté envers les siens, connexion aux ancêtres.",
    reversed: "Perte d'héritage, aliénation, dette ancestrale. La rigidité des traditions freine l'évolution.",
    element: "Terre",
    planet: "Saturne",
    zodiac: "Capricorne",
    keyword: "Héritage",
    color: "stone-400"
  }
];

// Les 3 Aettir (familles de 8 runes)
export const AETTIR = [
  { name: "Premier Aett", deity: "Freya / Freyr", theme: "Création et ordre matériel", start: 1, end: 8 },
  { name: "Deuxième Aett", deity: "Heimdall / Mimir", theme: "Forces destructrices et renaissance", start: 9, end: 16 },
  { name: "Troisième Aett", deity: "Tyr", theme: "Réalisation et société humaine", start: 17, end: 24 }
];

// Tirage: Tire 1, 2, ou 3 runes au hasard
export function drawRunes(count: number = 1): { rune: RuneData; reversed: boolean }[] {
  const drawn: number[] = [];
  const results: { rune: RuneData; reversed: boolean }[] = [];
  while (drawn.length < count && drawn.length < 24) {
    const idx = Math.floor(Math.random() * 24);
    if (!drawn.includes(idx)) {
      drawn.push(idx);
      results.push({ rune: ELDER_FUTHARK[idx], reversed: Math.random() < 0.5 });
    }
  }
  return results;
}

// Rune du jour (déterministe par date)
export function getRuneOfDay(): { rune: RuneData; reversed: boolean } {
  const today = new Date();
  const dayNum = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
  const idx = dayNum % 24;
  const reversed = dayNum % 3 === 0; // inverse tous les 3 jours
  return { rune: ELDER_FUTHARK[idx], reversed };
}

// Spread interpretations
export const RUNE_SPREADS = [
  {
    name: "Rune Unique",
    count: 1,
    description: "Une réponse claire à une question précise",
    positions: ["La situation actuelle"]
  },
  {
    name: "Tirage Nornes",
    count: 3,
    description: "Le passé, le présent et le futur",
    positions: ["Urd - Ce qui fut", "Verdandi - Ce qui est", "Skuld - Ce qui sera"]
  },
  {
    name: "Croix d'Odhin",
    count: 5,
    description: "Le tirage complet à 5 runes",
    positions: [
      "Le présent",
      "Le défi",
      "Le passé",
      "La cause profonde",
      "L'issue probable"
    ]
  }
];
