/**
 * Geocoding via OpenStreetMap Nominatim.
 *
 * P0#2 — Remplace les 117 villes hardcodées dans Onboarding.tsx et Settings.tsx.
 * Utilisation gratuite sous 1 req/sec (politique OSM). On debounce côté appelant.
 *
 * Docs : https://nominatim.org/release-docs/develop/api/Search/
 * Pas de clé API. Politique : https://operations.osmfoundation.org/policies/nominatim/
 */

export interface GeoPlace {
  /** Nom d'affichage (ex: "Paris, Île-de-France, France") */
  displayName: string;
  /** Nom court (ex: "Paris") */
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Décalage UTC en heures au moment de la requête (approximatif — DST inclus via le timeZone). */
  tzOffset: number;
  /** Fuseau IANA renvoyé par Nominatim quand dispo (ex: "Europe/Paris"). */
  timeZone?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimResponse {
  place_id: number;
  display_name: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  lat: string;
  lon: string;
  extratags?: { timezone?: string };
}

/**
 * Recherche de lieux par texte libre. Retourne max 10 résultats, français d'abord.
 * @param query texte libre ("paris", "dakar sénégal", "saigon vietnam")
 * @param signal AbortSignal optionnel pour annuler les requêtes en vol
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '10',
    'accept-language': 'fr',
  });

  try {
    const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal,
      headers: {
        // OSM demande un User-Agent descriptif — pas un header custom depuis le navigateur
        // (interdit par spec). On respecte la politique via un referer propre.
        Accept: 'application/json',
      },
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as NominatimResponse[];
    return data.map(parsePlace).filter((p): p is GeoPlace => p !== null);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return [];
    console.warn('[geocode] Nominatim fetch failed:', err);
    return [];
  }
}

function parsePlace(raw: NominatimResponse): GeoPlace | null {
  const lat = parseFloat(raw.lat);
  const lon = parseFloat(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const city = raw.name || raw.address?.city || raw.address?.town ||
    raw.address?.village || raw.address?.hamlet || raw.address?.county ||
    (raw.display_name ? raw.display_name.split(',')[0] : 'Lieu');

  const country = raw.address?.country || '';

  // Approximation du décalage UTC à partir de la longitude : 15° = 1h.
  // Suffisant pour l'astrologie natale (précision ±30 min acceptable pour l'Ascendant
  // sans heure exacte). Affiné via timeZone si Nominatim le fournit.
  const timeZone = raw.extratags?.timezone;
  const tzOffset = timeZone ? tzOffsetFromIANA(timeZone) : Math.round(lon / 15);

  return {
    displayName: raw.display_name || `${city}, ${country}`,
    city,
    country,
    latitude: lat,
    longitude: lon,
    tzOffset,
    timeZone,
  };
}

/** Convertit un fuseau IANA en offset UTC actuel (incluant DST). */
function tzOffsetFromIANA(iana: string): number {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'shortOffset',
    });
    const parts = fmt.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    // "GMT+2", "GMT-5", "GMT" → nombre
    const m = offsetPart.match(/GMT([+-]\d+(?::\d+)?)/);
    if (!m) return 0;
    const [h, mm] = m[1].split(':');
    const sign = h.startsWith('-') ? -1 : 1;
    return sign * (Math.abs(parseInt(h, 10)) + (mm ? parseInt(mm, 10) / 60 : 0));
  } catch {
    return 0;
  }
}
