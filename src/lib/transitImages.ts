/**
 * Helper pour récupérer l'image de fond d'une carte de transit.
 *
 * Convention de nommage : /public/transit-images/{planetKey}-{nature}.jpg
 * Planètes : soleil, lune, mercure, venus, mars, jupiter, saturne, uranus, neptune, pluton
 * Natures : tension, harmonique, neutre
 *
 * Total : 30 images fixes (10 planètes × 3 natures).
 * Ces images sont générées une fois par le user (Midjourney/SD), voir prompts dans le brief.
 *
 * Si l'image n'existe pas, on retourne null et le composant utilise un fallback gradient.
 */

const PLANET_KEY: Record<string, string> = {
  'Soleil': 'soleil',
  'Lune': 'lune',
  'Mercure': 'mercure',
  'Vénus': 'venus',
  'Mars': 'mars',
  'Jupiter': 'jupiter',
  'Saturne': 'saturne',
  'Uranus': 'uranus',
  'Neptune': 'neptune',
  'Pluton': 'pluton',
};

const NATURE_KEY: Record<string, string> = {
  tension: 'tension',
  harmonique: 'harmonique',
  neutre: 'neutre',
};

/** Map planète FR (transit ou natale) → clé fichier. */
function planetToKey(planet: string): string | null {
  return PLANET_KEY[planet] || null;
}

/** Map nature → clé fichier. */
function natureToKey(nature: string): string | null {
  return NATURE_KEY[nature] || null;
}

/** Retourne l'URL de l'image pour un aspect (transit), ou null si non disponible. */
export function getTransitImage(planet: string, nature: 'tension' | 'harmonique' | 'neutre'): string | null {
  const planetKey = planetToKey(planet);
  const natureKey = natureToKey(nature);
  if (!planetKey || !natureKey) return null;
  return `/transit-images/${planetKey}-${natureKey}.jpg`;
}

/** Retourne l'URL de l'image pour une maison, en utilisant la première planète en transit. */
export function getHouseImage(
  transitPlanets: Array<{ name: string }>,
  nature: 'tension' | 'harmonique' | 'neutre' = 'neutre'
): string | null {
  if (!transitPlanets || transitPlanets.length === 0) return null;
  return getTransitImage(transitPlanets[0].name, nature);
}
