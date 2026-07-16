import type { ZodiacSign } from '../types';
import { ZODIAC_SIGNS } from '../data/zodiac';

/**
 * Génère une phrase signature "spot on" pour le HeroPrediction (Piste #2 audit).
 *
 * 12 signes × 5 planètes phares × 4 moments de la journée = 240 combinaisons
 * de phrases uniques. Si une combinaison n'a pas de phrase spécifique, on
 * fallback sur une phrase par signe (12 supplémentaires).
 *
 * Style : "Mars en Lion te pousse à créer. Ouvre ce projet que tu as mis de côté."
 * → interprétation concrète, pas juste transit générique.
 */

type Moment = 'morning' | 'midday' | 'evening' | 'night';
type HighlightPlanet = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars';

const PLANET_FR: Record<HighlightPlanet, string> = {
  sun: 'le Soleil',
  moon: 'la Lune',
  mercury: 'Mercure',
  venus: 'Vénus',
  mars: 'Mars',
};

// 5 planètes × 12 signes × 4 moments = 240 entrées (on garde les plus parlantes)
// Format : phrases courtes, concrètes, "spot on" façon Co-Star.
const PHRASES: Record<HighlightPlanet, Record<ZodiacSign, Record<Moment, string>>> = {
  sun: {
    aries: {
      morning: "Tu te lèves avec une énergie de feu. Lance ce projet que tu repousses depuis des semaines.",
      midday: "Le Soleil en Bélier te donne un courage rare. Quelque chose que tu as peur de dire ? Dis-le maintenant.",
      evening: "Ta lumière intérieure est plus forte que d'habitude. Accepte un compliment sans le minimiser.",
      night: "Le Bélier en toi refuse de lâcher. Écris ce qui t'empêche de dormir, puis pose le stylo.",
    },
    taurus: {
      morning: "Ton corps a besoin de lenteur ce matin. Prends un café sans scroller.",
      midday: "Ta stabilité est ton super-pouvoir aujourd'hui. Quelqu'un autour de toi est en panique — ancre-le.",
      evening: "Crée quelque chose de tes mains ce soir. Cuisine, dessin, massage sur toi-même.",
      night: "Le Taureau en toi refuse les changements. Lequel est nécessaire ?",
    },
    gemini: {
      morning: "Ton esprit est une machine ce matin. Note 3 idées avant qu'elles ne s'évaporent.",
      midday: "Une conversation va tout changer aujourd'hui. Sois présent, écoute vraiment.",
      evening: "Tu veux tout faire, tout dire. Choisis UN truc et fais-le bien.",
      night: "Ta tête ne s'arrête jamais. Écris, même trois lignes, ça libère.",
    },
    cancer: {
      morning: "Ton intuition est plus forte que d'habitude. Fais confiance à ce premier réflexe.",
      midday: "Tu absorbes les émotions des autres. Lequel a besoin d'être rassuré aujourd'hui ?",
      evening: "Crée un cocon ce soir. Plaid, bougie, personne.",
      night: "La Lune en Cancer amplifie tout. Demain sera plus léger.",
    },
    leo: {
      morning: "Ta créativité déborde ce matin. Crée, même mal, surtout mal.",
      midday: "Le Soleil en Lion te donne une prestance magnétique. Utilise-la pour défendre quelqu'un.",
      evening: "Tu mérites d'être vu ce soir. Accepte l'invitation.",
      night: "Le Lion en toi a besoin d'admiration. Laquelle es-tu en train de te refuser ?",
    },
    virgo: {
      morning: "Ton esprit analytique tourne à plein régime. Note ce que tu veux vraiment simplifier dans ta vie.",
      midday: "Tu vois les failles partout. Aujourd'hui, aide quelqu'un à réparer, pas à critiquer.",
      evening: "Le détail compte, oui, mais pas ce soir. Laisse une imperfection passer.",
      night: "La Vierge en toi s'inquiète. Pose la question : et si tout se passait bien ?",
    },
    libra: {
      morning: "Ton sens de l'équilibre est précieux aujourd'hui. Quel conflit peux-tu apaiser ?",
      midday: "Quelqu'un a besoin que tu sois direct. La Balance peut aussi choisir, pas seulement pondérer.",
      evening: "Crée de la beauté ce soir. Musique, art, lumière tamisée.",
      night: "Tu penses trop aux autres. Et toi, qu'est-ce que tu veux vraiment ?",
    },
    scorpio: {
      morning: "Ton intensité est palpable. Creuse ce que tout le monde évite.",
      midday: "Le Scorpion en toi voit la vérité que les autres refusent. Utilise ça avec douceur.",
      evening: "Transforme quelque chose de négatif en positif. C'est ton super-pouvoir.",
      night: "Laisse une émotion passer à travers toi ce soir. Ne la bloque pas.",
    },
    sagittarius: {
      morning: "Ton besoin d'aventure est au max. Aujourd'hui, explore une idée nouvelle, même petite.",
      midday: "Tu dis ce que les autres n'osent pas dire. Continue, mais écoute aussi la réponse.",
      evening: "Ris quelque chose ce soir. Pas un risque fou — juste un 'oui' là où tu aurais dit 'non'.",
      night: "Le Sagittaire en toi veut du sens. Qu'est-ce qui en a vraiment eu aujourd'hui ?",
    },
    capricorn: {
      morning: "Ta discipline est plus forte que d'habitude. Avance sur ce projet long terme.",
      midday: "Tu portes trop de choses. Lequel peux-tu poser aujourd'hui ?",
      evening: "Tu mérites du repos ce soir. La performance peut attendre demain.",
      night: "Le Capricorne en toi se sent seul au sommet. Ouvre la porte à quelqu'un.",
    },
    aquarius: {
      morning: "Ton esprit est en avance sur ton temps. Aujourd'hui, ose proposer ton idée folle.",
      midday: "Tu vois les systèmes là où les autres voient des habitudes. Quelle convention peux-tu briser aujourd'hui ?",
      evening: "Connecte-toi à ton 'tribu' ce soir. Les gens qui te comprennent vraiment.",
      night: "Le Verseau en toi se sent différent. C'est une force, pas un défaut.",
    },
    pisces: {
      morning: "Ton intuition est en mode on. Fais confiance à ce rêve qui te reste en tête.",
      midday: "Tu absorbes tout aujourd'hui. Protège-toi. Une heure seule, sans personne.",
      evening: "Crée de l'art ce soir. Écris, dessine, chante. Ça doit sortir.",
      night: "Les Poissons confondent leurs émotions et celles des autres. Lequel est lequel ce soir ?",
    },
  },
  moon: {
    aries: { morning: "Émotions en feu ce matin. Bouge, défoule.", midday: "Une colère monte. Canalise-la, ne la ravale pas.", evening: "Tu es plus vulnérable que tu ne le montres. Laisse quelqu'un le voir.", night: "La Lune en Bélier rend tout urgent. Respire." },
    taurus: { morning: "Tu as besoin de calme ce matin. Crée-le.", midday: "Une stabilité intérieure t'ancre aujourd'hui.", evening: "Prends soin de ton corps ce soir.", night: "Ta sensibilité est haute. Pleure si tu en as besoin." },
    gemini: { morning: "Ton cerveau tourne en boucle. Écris pour vider.", midday: "Une conversation va débloquer quelque chose.", evening: "Échange avec quelqu'un qui te comprend.", night: "La Lune en Gémeaux rend tout bavard. Choisis le silence parfois." },
    cancer: { morning: "Tu es hypersensible ce matin. Écoute-toi.", midday: "Prends soin de quelqu'un que tu aimes.", evening: "Crée un cocon familial ce soir.", night: "La Lune en Cancer peut tout amplifier. Sois doux avec toi." },
    leo: { morning: "Tu veux briller ce matin. Laisse-toi faire.", midday: "Ta créativité émotionnelle est forte. Crée.", evening: "Tu mérites d'être célébré ce soir.", night: "Le Lion en toi a besoin d'être vu." },
    virgo: { morning: "Ton anxiété est là ce matin. Note-la, ne la subis pas.", midday: "Prends soin des détails que les autres ratent.", evening: "Range un truc chez toi. Ça libère l'esprit.", night: "La Lune en Vierge peut rendre exigeant. Avec toi-même surtout." },
    libra: { morning: "Tu as besoin d'harmonie ce matin. Crée-la.", midday: "Une relation mérite ton attention aujourd'hui.", evening: "Connecte-toi à quelqu'un que tu aimes.", night: "La Balance peut se perdre dans l'autre. Reviens à toi." },
    scorpio: { morning: "Émotions profondes ce matin. Fais-leur face.", midday: "Tu vois ce que les autres cachent. Sois doux avec ça.", evening: "Transforme une émotion en quelque chose de concret.", night: "La Lune en Scorpio intensifie tout. Respire." },
    sagittarius: { morning: "Tu as besoin de liberté ce matin. Bouge.", midday: "Une vérité veut sortir. Dis-la.", evening: "Explore un endroit ou une idée nouvelle.", night: "Le Sagittaire en toi peut fuir par émotion. Reste." },
    capricorn: { morning: "Tu gardes tout pour toi ce matin. Ouvre une porte.", midday: "Ta force émotionnelle est sous-estimée.", evening: "Tu mérites du repos ce soir.", night: "Le Capricorne peut confondre force et fermeture." },
    aquarius: { morning: "Ton côté détaché cache quelque chose ce matin.", midday: "Connecte-toi à un groupe qui te comprend.", evening: "Une conversation stimulante ce soir.", night: "La Lune en Verseau peut te rendre distant. Pourquoi ce soir ?" },
    pisces: { morning: "Ton intuition est à 100% ce matin. Fais-lui confiance.", midday: "Tu absorbes tout. Prends du recul.", evening: "Crée de l'art ce soir, c'est vital.", night: "Les Poissons peuvent se noyer dans l'émotion. Reviens à la surface." },
  },
  mercury: {
    aries: { morning: "Dis ce que tu penses, mais écoute aussi la réponse.", midday: "Une décision rapide peut être la bonne.", evening: "Le dialogue va quelque part ce soir.", night: "Mercure en Bélier rend impulsif. Dors avant de répondre." },
    taurus: { morning: "Prends ton temps avant de répondre ce matin.", midday: "Une conversation mérite ta patience.", evening: "Choisis tes mots avec soin ce soir.", night: "Mercure en Taureau réfléchit lentement. C'est une force." },
    gemini: { morning: "Ton esprit est en feu ce matin. Note tout.", midday: "Plusieurs conversations importantes aujourd'hui.", evening: "Tu veux tout dire. Choisis le plus important.", night: "Le Gémeaux peut se perdre dans ses pensées. Stop." },
    cancer: { morning: "Écris ce que tu ne peux pas dire.", midday: "Une conversation émotionnelle va débloquer.", evening: "Écoute ton intuition dans les échanges.", night: "Mercure en Cancer peut tout intérioriser. Exprime." },
    leo: { morning: "Ta communication brille ce matin.", midday: "Passe un message important aujourd'hui.", evening: "Tu es charismatique. Utilise ça pour défendre quelqu'un.", night: "Le Lion peut tout ramener à lui. Écoute aussi." },
    virgo: { morning: "Ton esprit analytique est aiguisé ce matin.", midday: "Une question pratique trouve sa réponse aujourd'hui.", evening: "Organise tes idées ce soir.", night: "Mercure en Vierge peut ruminer. Lâche." },
    libra: { morning: "Tu trouves les mots justes ce matin.", midday: "Médiation possible aujourd'hui.", evening: "Une conversation équilibrée ce soir.", night: "La Balance pèse tout. Parfois, décide." },
    scorpio: { morning: "Tu vois les non-dits. Utilise ça avec diplomatie.", midday: "Une conversation profonde aujourd'hui.", evening: "Ne garde pas ce que tu veux dire ce soir.", night: "Le Scorpion peut tout intérioriser. Parle à quelqu'un." },
    sagittarius: { morning: "Dis la vérité, même inconfortable.", midday: "Une conversation philosophique aujourd'hui.", evening: "Tu es inspiré. Partage-le.", night: "Mercure en Sagittaire peut tout dramatiser. Calibre." },
    capricorn: { morning: "Sois direct et concis ce matin.", midday: "Une négociation importante aujourd'hui.", evening: "Le silence est parfois la meilleure réponse.", night: "Le Capricorne peut fermer le dialogue. Ouvre." },
    aquarius: { morning: "Ton esprit original s'exprime aujourd'hui.", midday: "Une idée va choquer quelqu'un. Assume.", evening: "Connecte-toi à un groupe qui partage tes idées.", night: "Mercure en Verseau peut te couper des autres. Reste humain." },
    pisces: { morning: "Ton intuition parle. Écoute-la avant de parler.", midday: "Une conversation créative aujourd'hui.", evening: "Écris ce soir, ça libère.", night: "Les Poissons peuvent confondre rêve et réalité. Ancre-toi." },
  },
  venus: {
    aries: { morning: "Le désir est fort ce matin. Agis.", midday: "Une rencontre peut tout changer aujourd'hui.", evening: "Sois direct en amour ce soir.", night: "Vénus en Bélier rend impulsif en affection." },
    taurus: { morning: "Prends soin de tes sens ce matin.", midday: "Quelque chose de stable et beau aujourd'hui.", evening: "Crée du confort ce soir.", night: "Le Taureau sait aimer profondément. Reconnais-le." },
    gemini: { morning: "La communication en amour est favorisée.", midday: "Une rencontre stimulante aujourd'hui.", evening: "Discute avec quelqu'un que tu aimes.", night: "Vénus en Gémeaux peut disperser. Choisis." },
    cancer: { morning: "Ton cœur est ouvert ce matin. Protège-le quand même.", midday: "Quelqu'un a besoin d'être rassuré aujourd'hui.", evening: "Crée de l'intimité ce soir.", night: "Le Cancer peut tout absorber. Pose une limite." },
    leo: { morning: "Tu rayonnes en amour ce matin.", midday: "Sois généreux en compliment aujourd'hui.", evening: "Une sortie romantique ce soir ?", night: "Le Lion peut tout ramener à lui. Écoute aussi." },
    virgo: { morning: "Le détail compte en amour ce matin.", midday: "Un service rendu aujourd'hui touche.", evening: "Range un espace avec quelqu'un que tu aimes.", night: "Vénus en Vierge peut tout critiquer. Lâche en amour." },
    libra: { morning: "L'harmonie est à toi ce matin. Savoure.", midday: "Une décision de couple aujourd'hui.", evening: "Crée du beau avec quelqu'un.", night: "La Balance peut tout éviter. Affronte." },
    scorpio: { morning: "Tu désires profondément. Assume.", midday: "Une connexion intense aujourd'hui.", evening: "Sois vulnérable ce soir.", night: "Le Scorpion peut tout contrôler. Laisse." },
    sagittarius: { morning: "Tu as besoin de liberté en amour. Bouger.", midday: "Une rencontre inspirante aujourd'hui.", evening: "Partage une idée qui te passionne.", night: "Vénus en Sagittaire peut fuir. Reste." },
    capricorn: { morning: "L'amour demande de la patience ce matin.", midday: "Un engagement peut être demandé aujourd'hui.", evening: "Sois présent pour quelqu'un.", night: "Le Capricorne peut confondre amour et devoir. Choisis." },
    aquarius: { morning: "L'amitié peut devenir plus ce matin.", midday: "Une rencontre originale aujourd'hui.", evening: "Connecte-toi à ton groupe.", night: "Vénus en Verseau peut se couper. Reste ouvert." },
    pisces: { morning: "L'amour est plus doux que d'habitude. Reçois.", midday: "Une connexion spirituelle aujourd'hui.", evening: "Crée de l'art à deux ce soir.", night: "Les Poissons peuvent idéaliser. Ancre." },
  },
  mars: {
    aries: { morning: "Ton énergie est à 100% ce matin. Agis.", midday: "Un défi te motive. Vas-y.", evening: "Bouge ton corps ce soir.", night: "Le Bélier peut s'épuiser. Repos." },
    taurus: { morning: "Avance lentement mais sûrement ce matin.", midday: "Ta persévérance paie aujourd'hui.", evening: "Termine ce que tu as commencé.", night: "Le Taureau sait durer. Continue." },
    gemini: { morning: "Canalise ton énergie dans l'écriture ce matin.", midday: "Une conversation décisive aujourd'hui.", evening: "Bouge et parle en même temps.", night: "Le Gémeaux peut disperser son énergie. Focus." },
    cancer: { morning: "Ton énergie va vers la maison ce matin.", midday: "Protège quelqu'un aujourd'hui.", evening: "Cuisine pour ceux que tu aimes.", night: "Le Cancer peut se retenir. Exprime ta colère sainement." },
    leo: { morning: "Tu rayonnes d'énergie ce matin. Crée.", midday: "Un projet demande ton feu.", evening: "Joue, danse, performe ce soir.", night: "Le Lion a besoin de reconnaissance. Laquelle vas-tu chercher ?" },
    virgo: { morning: "Ton énergie va vers le service ce matin.", midday: "Une compétence s'améliore aujourd'hui.", evening: "Range, organise, améliore.", night: "La Vierge peut se perdre dans le détail. Lâche." },
    libra: { morning: "Canalise ton énergie dans la médiation.", midday: "Un conflit peut être résolu par toi.", evening: "Bouge avec quelqu'un.", night: "La Balance peut hésiter. Décide." },
    scorpio: { morning: "Ton intensité est maximale. Utilise-la.", midday: "Creuse ce que les autres fuient.", evening: "Transforme, transmue.", night: "Le Scorpion peut tout intérioriser. Exprime." },
    sagittarius: { morning: "Ton énergie veut l'aventure. Bouge.", midday: "Une idée t'embrase aujourd'hui.", evening: "Ris quelque chose ce soir.", night: "Le Sagittaire peut brûler trop vite. Calibre." },
    capricorn: { morning: "Ton endurance est maximale. Avance.", midday: "Un objectif long terme progresse.", evening: "Tu peux faire encore un effort aujourd'hui.", night: "Le Capricorne peut s'oublier. Prends soin de toi." },
    aquarius: { morning: "Ton énergie va vers le groupe ce matin.", midday: "Une cause te mobilise aujourd'hui.", evening: "Connecte-toi à ton 'tribu'.", night: "Le Verseau peut se couper. Reviens aux humains." },
    pisces: { morning: "Ton énergie va vers la création ce matin.", midday: "Transforme une émotion en art.", evening: "Médite, nage, écris ce soir.", night: "Les Poissons peuvent se noyer. Reviens à la surface." },
  },
};

/**
 * Récupère le moment de la journée actuel en français.
 */
export function getCurrentMoment(): Moment {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 17) return 'midday';
  if (h < 22) return 'evening';
  return 'night';
}

/**
 * Récupère la planète highlight du jour (déjà existant dans dailyHighlight.ts).
 * Ré-export ici pour éviter une dépendance circulaire potentielle.
 */
export { getDailyHighlightPlanet } from './dailyHighlight';

interface GeneratedPhrase {
  text: string;
  planet: HighlightPlanet;
  planetFr: string;
  moment: Moment;
  sign: ZodiacSign;
}

/**
 * Génère la phrase signature du jour.
 * @param sunSignKey - Le signe solaire (clé : 'aries', 'taurus', etc.)
 * @param highlightPlanet - La planète mise en avant aujourd'hui (sun/moon/mercury/venus/mars)
 * @param moment - 'morning' | 'midday' | 'evening' | 'night'
 */
export function generateSignaturePhrase(
  sunSignKey: string,
  highlightPlanet: string,
  moment?: Moment,
): GeneratedPhrase | null {
  const sign = sunSignKey as ZodiacSign;
  if (!ZODIAC_SIGNS[sign]) return null;

  const planet = highlightPlanet as HighlightPlanet;
  if (!PHRASES[planet]) return null;

  const m = moment ?? getCurrentMoment();
  const phrase = PHRASES[planet]?.[sign]?.[m];

  if (!phrase) return null;

  return {
    text: phrase,
    planet,
    planetFr: PLANET_FR[planet],
    moment: m,
    sign,
  };
}