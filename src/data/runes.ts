// Elder Futhark (Futhark ancien) - 24 runes pour la runomancie
// Chaque rune a: symbole Unicode, nom, traduction, poesie runique, signification divinatoire, element astro

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
    meaning: "Richesse, betail",
    poetry: "La richesse est une consolation pour tous les hommes, mais beaucoup doit partager celui qui veut jetter les des de la gloire.",
    upright: "Abondance materielle et spirituelle. Succes financier, gain inattendu. Energie creatrice qui circule librement.",
    reversed: "Perte materielle, frustration, avarice. L energie est bloquee, la richesse se transforme en fardeau.",
    element: "Feu",
    planet: "Venus",
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
    poetry: "L auroch est feroce et defie ses ennemis, une bete sauvage aux cornes immenses, un combattant redoutable.",
    upright: "Force vitale, sante, energie brute. Le pouvoir de modeler votre destinee par la volonte et l endurance.",
    reversed: "Faiblesse, maladie, manque de volonte. Opportunites ratees par insecurite ou peur.",
    element: "Terre",
    planet: "Mars",
    zodiac: "Belier",
    keyword: "Force",
    color: "red-400"
  },
  {
    id: 3,
    symbol: "\u16A6",
    name: "Thurisaz",
    transliteration: "Th",
    meaning: "Thorn, geant",
    poetry: "L epine est tres pointue pour tout homme qui la touche, cruelle pour ceux qui s y reposent.",
    upright: "Protection, defense reactive. Une force cathartique qui detruit les obstacles. Le pouvoir du tonnerre.",
    reversed: "Betrayal, danger cache, conflits inutiles. La force protective devient destructive sans controle.",
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
    upright: "Communication divine, revelation, messages des dieux. Inspiration, creativite, conseils sages.",
    reversed: "Malentendus, tromperie, mauvais conseils. L information est deformee, la communication bloquee.",
    element: "Air",
    planet: "Mercure",
    zodiac: "Gemeaux",
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
    upright: "Voyage, mouvement, quete spirituelle. Vous etes sur le bon chemin, le voyage est aussi important que la destination.",
    reversed: "Retards, plans derailles, mauvaise direction. Le voyage physique ou spirituel rencontre des obstacles.",
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
    poetry: "La torche est vivante pour chaque fils d homme, claire et brillante, brule le plus souvent quand les nobles se reposent.",
    upright: "Illumination, connaissance, creation artistique. La lumiere qui guide et transforme, feu controle et maitrise.",
    reversed: "Ignorance, obscurite, perte d espoir. Une relation s eteint, une idee echoue faute de vision.",
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
    poetry: "La generosite apporte honneur et gloire a un homme, et le dote de vertus qui lui permettent de prosperer.",
    upright: "Don, echange equilibre, partenariat. Union sacree, amitie profonde, don mutuel sans attente.",
    reversed: "Pas de rune inverse - Gebo est symetrique. Cependant, peut indiquer un don qui cree une dette ou un desequilibre.",
    element: "Air",
    planet: "Venus",
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
    poetry: "La joie est pour celui qui connait peu de chagrins, de douleurs et de troubles, et possede pour lui-meme prosperite et bonheur.",
    upright: "Joie, harmonie, bien-etre. Realisation de souhaits, amitie, plaisir simple. La comedie apres la tragedie.",
    reversed: "Tristesse, isolement, alienation. Les desirs ne se realisent pas, conflits dans les relations.",
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
    meaning: "Grele, destruction",
    poetry: "La grele est le grain le plus froid des creations de Dieu, il vint avec la pluie, puis se transforma en eau.",
    upright: "Destruction necessaire, forces elementaires incontrollables. Une crise qui nettoie le chemin pour le renouveau. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Hagalaz est une force primordiale. La destruction peut etre evitee si on accepte le changement.",
    element: "Eau",
    planet: "Saturne",
    zodiac: "Capricorne",
    keyword: "Tempete",
    color: "cyan-400"
  },
  {
    id: 10,
    symbol: "\u16BE",
    name: "Nauthiz",
    transliteration: "N",
    meaning: "Besoin, contrainte",
    poetry: "Le besoin est une noeud coulant sur le nez, mais aide souvent a eviter le mal et a obtenir le salut.",
    upright: "Besoin, retard, friction. Les obstacles sont des maitres. La frustration revele ce qui doit changer.",
    reversed: "Detresse, oppression, mauvaise gestion de l energie. Resistez a la detresse en acceptant vos limites.",
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
    poetry: "La glace est tres belle a voir, brillante et claire, un sol glissant que peu de gens peuvent gravir.",
    upright: "Stase, gel, pause necessaire. Un temps d arret pour reflechir. La surface cache des profondeurs. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Isa est immobile par nature. La glace prolongee peut devenir stagnation permanente.",
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
    meaning: "Annee, recolte",
    poetry: "L annee est joyeuse pour tous les hommes, quand le Dieu, roi du ciel, apporte la terre a la fruite.",
    upright: "Recolte, cycles, recompense apres l effort. La patience porte ses fruits. Un cycle naturel se complete. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Les cycles ne se pressent pas. Un retard dans la recolte, un cycle qui prend plus de temps.",
    element: "Terre",
    planet: "Jupiter",
    zodiac: "Vierge",
    keyword: "Recolte",
    color: "lime-400"
  },
  {
    id: 13,
    symbol: "\u16C7",
    name: "Eihwaz",
    transliteration: "Ei",
    meaning: "If, axe du monde",
    poetry: "L if a une apparence exterieure rude, un arbre dur et ferme sur la terre, gardien des flammes.",
    upright: "Endurance, transformation, axe cosmique Yggdrasil. La mort et la renaissance comme processus naturel. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Eihwaz est l arbre-monde. Confusion face au changement inevitable, resistance a la transformation.",
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
    poetry: "Le jeu de des est toujours source de rire et de joie pour les hommes orgueilleux, assis ensemble dans la salle.",
    upright: "Mystere, sorts, revelation des secrets cachees. La coupe de Wyrd, la toile du destin. Chance inattendue.",
    reversed: "Stagnation, malaise, secrets indesirables. La connaissance du destin apporte la melancolie plutot que la joie.",
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
    meaning: "Elan, protection",
    poetry: "Le roseau est l herbe la plus haute, dans les marais elle croit ethumide, elle brule sang et blesse, et teint de rouge.",
    upright: "Protection divine, bouclier, connexion avec les dieux. Le canal entre le conscient et le superconscient. Guerison spirituelle.",
    reversed: "Vulnerabilite, danger cache, mauvaise influence. La protection disparait, les energies negatives penetrent.",
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
    poetry: "Le soleil est toujours une joie pour les marins dans leur voyage sur les vagues de la mer salee.",
    upright: "Succes, vitalite, victoire. La lumiere du soleil qui eclaire tout. Realisation du Soi, energie illimitee. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Cependant, un soleil trop puissant brule et aveugle. Succes qui conduit a l orgueil.",
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
    poetry: "Tyr est une etoile qui garde la confiance des nobles, toujours sur son chemin, jamais dans la nuit.",
    upright: "Justice, sacrifice, courage. La voie du guerrier spirituel. Leadership droit, honneur, victory par le sacrifice juste.",
    reversed: "Injustice, lachete, energie gaspillee. Le guerrier perd sa cause, l ego remplace le devoir.",
    element: "Air",
    planet: "Mars",
    zodiac: "Belier",
    keyword: "Justice",
    color: "red-500"
  },
  {
    id: 18,
    symbol: "\u16D2",
    name: "Berkano",
    transliteration: "B",
    meaning: "Bouleau, deesse-mere",
    poetry: "Le bouleau n a pas de fruit, pourtant porte des pousses sans POLLINISATION, elle est belle par ses branches, chargee de feuillage.",
    upright: "Naissance, fertilite, nouveau depart. La Grande Mere. Croissance, regeneration, protection familiale.",
    reversed: "Problemes familiaux, stagnation, blocage creatif. La croissance est entravee, des conflits dans le foyer.",
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
    poetry: "Le cheval est pour les seigneurs une joie, fier dans sa force et la ou les riches sur leurs chars vantent.",
    upright: "Partenariat, mouvement, progres harmonieux. La confiance entre deux etres. Voyage et transition en douceur.",
    reversed: "Mefiance, blocage, stagnation dans les relations. Le partenariat est desequilibre, un partenaire tiraille.",
    element: "Terre",
    planet: "Mercure",
    zodiac: "Gemeaux",
    keyword: "Union",
    color: "teal-400"
  },
  {
    id: 20,
    symbol: "\u16D7",
    name: "Mannaz",
    transliteration: "M",
    meaning: "Homme, humanite",
    poetry: "L homme est la joie de l homme, et doit etre sage, mais cher homme, chacun peut te trahir.",
    upright: "Humanite, conscience de soi, interdependance. La nature humaine dans toute sa complexite. Relations, communaute, identite.",
    reversed: "Isolation, egoisme, trahison. L humanite se tourne contre elle-meme. Ego qui coupe les liens essentiels.",
    element: "Air",
    planet: "Mercure",
    zodiac: "Gemeaux",
    keyword: "Humanite",
    color: "slate-300"
  },
  {
    id: 21,
    symbol: "\u16DA",
    name: "Laguz",
    transliteration: "L",
    meaning: "Eau, intuition",
    poetry: "L eau semble eternelle pour les hommes, s ils doivent expedier les vaisseaux et decorer les bijoux de poissons.",
    upright: "Intuition, flux emocionnel, subconscient. L eau primordiale. Sagesse instinctive, adaptabilite, fertilité spirituelle.",
    reversed: "Confusion, instabilite emotionnelle, illusions. L eau stagne ou deborde. Perte de contact avec l intuition.",
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
    meaning: "Ing, dieu de la fertilite",
    poetry: "Ing fut d abord vu parmi les Danois de l est, puis il repartit vers l est sur les vagues, le chariot derriere lui.",
    upright: "Achèvement, liberation, nouvelle phase. La graine qui attend sous terre. Gestation, potentiel pret a eclore. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Cependant, energie bloquee, unfinished business. Un cycle qui n arrive pas a se clore.",
    element: "Terre",
    planet: "Venus",
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
    poetry: "Le jour est le messager du Dieu, lumiere chere des hommes, source de joie et de bonheur.",
    upright: "Aube, illumination, transformation radicale. Le point de bascule entre l obscurite et la lumiere. Eveil, esperance. Pas de rune inverse.",
    reversed: "Pas de rune inverse. Cependant, un changement trop brusque peut destabiliser. La lumiere revele des choses difficiles a voir.",
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
    meaning: "Heritage, patrie",
    poetry: "L heritage est cher a chaque homme, s il peut jouir de sa maison en paix, dans la prosperite.",
    upright: "Heritage, ancestral, racines. Le domaine spirituel et materiel herite. Loyauté envers les siens, connection aux ancetres.",
    reversed: "Perte d heritage, aliénation, dette ancestrale. La rigidite des traditions freine l evolution.",
    element: "Terre",
    planet: "Saturne",
    zodiac: "Capricorne",
    keyword: "Heritage",
    color: "stone-400"
  }
];

// Les 3 Aettir (families de 8 runes)
export const AETTIR = [
  { name: "Premier Aett", deity: "Freya / Freyr", theme: "Creation et ordre mat\u00e9riel", start: 1, end: 8 },
  { name: "Deuxieme Aett", deity: "Heimdall / Mimir", theme: "Forces destructrices et renaissance", start: 9, end: 16 },
  { name: "Troisieme Aett", deity: "Tyr", theme: "Realisation et societe humaine", start: 17, end: 24 }
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

// Rune du jour (deterministe par date)
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
    description: "Une reponse claire a une question precise",
    positions: ["La situation actuelle"]
  },
  {
    name: "Tirage Nornes",
    count: 3,
    description: "Le passe, le present et le futur",
    positions: ["Urd - Ce qui fut", "Verdandi - Ce qui est", "Skuld - Ce qui sera"]
  },
  {
    name: "Croix d Odhin",
    count: 5,
    description: "Le tirage complet a 5 runes",
    positions: [
      "Le present",
      "Le defi",
      "Le passe",
      "La cause profonde",
      "L issue probable"
    ]
  }
];