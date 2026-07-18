/**
 * P1#7 — Stockage local du code de parrainage.
 *
 * Au chargement de l'app, si l'URL contient ?ref=CEL-XXXXXX, on le persiste
 * en localStorage. Il sera envoyé avec la requête POST /register et consommé
 * (supprimé) après usage, qu'il ait réussi ou non.
 *
 * On stocke aussi la date pour expirer au bout de 30 jours (un user qui
 * s'inscrit 2 mois après avoir cliqué un lien n'est probablement plus un
 * parrainage légitime — évite les abus).
 */
const KEY = 'celeste-ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function captureReferralFromURL(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('ref');
    if (!raw) return null;
    // Validation : alphanumérique + tiret, 4-16 chars.
    const clean = raw.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,16}$/.test(clean)) return null;
    const payload = JSON.stringify({ code: clean, ts: Date.now() });
    localStorage.setItem(KEY, payload);
    // Nettoie l'URL pour éviter de reshare le lien avec ?ref= à chaque fois.
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
    return clean;
  } catch {
    return null;
  }
}

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; ts?: number };
    if (!parsed.code) return null;
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
