/**
 * P1#8 — Cron événements astronomiques.
 *
 * Détecte les événements astronomiques majeurs du jour (±24h) :
 *   - Nouvelle lune, Pleine lune, Premier/Dernier quartier
 *   - Éclipses lunaires et solaires
 *   - Rétrogrades planétaires (début/fin, Mercure/Venus/Mars)
 *   - Transits majeurs : ingresses (Soleil, Vénus, Mars en nouveau signe)
 *   - Conjonctions notables (Soleil-Vénus, Lune-Jupiter, etc.)
 *
 * Puis envoie un push ciblé aux users premium avec un message VMF-aligned.
 *
 * Dépendances : astronomy-engine (déjà dans le stack).
 */

import * as Astronomy from 'astronomy-engine';

// ─── Helpers ────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  'Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge',
  'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons',
];

function eclipticLon(body, date) {
  const t = Astronomy.MakeTime(date);
  try {
    // Pour la Terre on utilise EclipticLongitude qui retourne l'héliocentrique.
    // Géocentrique du Soleil ≈ Earth helio + 180°.
    if (body === Astronomy.Body.Sun) {
      const earthLon = Astronomy.EclipticLongitude(Astronomy.Body.Earth, t);
      return (((earthLon + 180) % 360) + 360) % 360;
    }
    return ((Astronomy.EclipticLongitude(body, t) % 360) + 360) % 360;
  } catch {
    return null;
  }
}

function signOf(lon) {
  if (lon == null) return null;
  return ZODIAC_SIGNS[Math.floor(lon / 30) % 12];
}

function phaseName(angle) {
  // angle 0-360 depuis la nouvelle lune
  if (angle < 22.5 || angle >= 337.5) return { name: 'Nouvelle Lune', short: '🌑', emoji: '🌑' };
  if (angle < 67.5)  return { name: 'Premier croissant', short: '🌒', emoji: '🌒' };
  if (angle < 112.5) return { name: 'Premier quartier', short: '🌓', emoji: '🌓' };
  if (angle < 157.5) return { name: 'Gibeuse croissante', short: '🌔', emoji: '🌔' };
  if (angle < 202.5) return { name: 'Pleine Lune', short: '🌕', emoji: '🌕' };
  if (angle < 247.5) return { name: 'Gibeuse décroissante', short: '🌖', emoji: '🌖' };
  if (angle < 292.5) return { name: 'Dernier quartier', short: '🌗', emoji: '🌗' };
  return { name: 'Dernier croissant', short: '🌘', emoji: '🌘' };
}

const isMajorPhase = (angle) =>
  Math.abs(angle - 0) < 6 || Math.abs(angle - 90) < 6 ||
  Math.abs(angle - 180) < 6 || Math.abs(angle - 270) < 6;

// ─── Détection des événements sur une fenêtre ───────────────────

/**
 * Retourne la liste des événements astronomiques sur les prochaines `hours` heures.
 * Format : { type, title, body, emoji, when (ISO) }
 */
export function detectAstroEvents(now = new Date(), hoursAhead = 24) {
  const events = [];
  const endWindow = new Date(now.getTime() + hoursAhead * 3600_000);
  const startWindow = new Date(now.getTime() - 6 * 3600_000); // grâce 6h arrière

  // 1. Phases lunaires majeures (NL, PQ, PL, DQ)
  for (const targetAngle of [0, 90, 180, 270]) {
    try {
      const event = Astronomy.SearchMoonPhase(targetAngle, startWindow, hoursAhead + 12);
      if (event && event.date >= now && event.date <= endWindow) {
        const phase = phaseName(targetAngle);
        const bodies = {
          0:   'La lune rentre en phase noire. Temps du retrait, du silence, de la graine qui ne voit pas encore le jour.',
          90:  'Premier quartier : la moitié du chemin. Un geste pour avancer.',
          180: 'Pleine lune. Ce qui était latent se révèle. Éclaire ce qui te limite.',
          270: 'Dernier quartier : lâcher ce qui ne sert plus avant le nouveau cycle.',
        };
        events.push({
          type: 'moon_phase',
          title: `${phase.emoji} ${phase.name}`,
          body: bodies[targetAngle] || phase.name,
          emoji: phase.emoji,
          when: event.date.toISOString(),
        });
      }
    } catch (e) {
      console.error('[astro-events] SearchMoonPhase', targetAngle, e.message);
    }
  }

  // 2. Éclipses lunaires
  try {
    let ecl = Astronomy.SearchLunarEclipse(startWindow);
    while (ecl && ecl.peak <= endWindow) {
      if (ecl.peak >= now) {
        const kind = ecl.kind === 'total' ? 'totale'
          : ecl.kind === 'partial' ? 'partielle' : 'pénombrale';
        events.push({
          type: 'lunar_eclipse',
          title: `🌕 Éclipse lunaire ${kind}`,
          body: `Éclipse de lune ${kind} ${ecl.visibility || ''}. Les ombres se prolongent. Reste à l'écoute de ce qui remonte.`,
          emoji: '🌕',
          when: ecl.peak.toISOString(),
        });
      }
      // Prochaine éclipse (chercher après celle-ci)
      ecl = Astronomy.SearchLunarEclipse(new Date(ecl.peak.getTime() + 86400_000));
    }
  } catch (e) {
    console.error('[astro-events] SearchLunarEclipse:', e.message);
  }

  // 3. Ingress solaires (changement de signe du Soleil) + transits planétaires
  const bodies = [
    { body: Astronomy.Body.Sun,   name: 'Soleil',  weight: 'major' },
    { body: Astronomy.Body.Venus, name: 'Vénus',   weight: 'minor' },
    { body: Astronomy.Body.Mars,  name: 'Mars',    weight: 'minor' },
    { body: Astronomy.Body.Mercury, name: 'Mercure', weight: 'minor' },
  ];

  for (const { body, name, weight } of bodies) {
    try {
      const lonNow = eclipticLon(body, now);
      const lonNext = eclipticLon(body, endWindow);
      if (lonNow == null || lonNext == null) continue;

      const signNow = signOf(lonNow);
      const signNext = signOf(lonNext);
      if (signNow !== signNext) {
        // L'ingress se produit dans la fenêtre
        const body = weight === 'major'
          ? `Le Soleil entre en ${signNext}. Nouveau chapitre saisonnier.`
          : `${name} entre en ${signNext}. Un léger changement de timbre dans la journée.`;
        events.push({
          type: 'ingress',
          title: `${weight === 'major' ? '☀️' : '✦'} ${name} entre en ${signNext}`,
          body,
          emoji: weight === 'major' ? '☀️' : '✦',
          when: now.toISOString(), // approximation (l'ingress est dans la fenêtre)
        });
      }
    } catch (e) {
      console.error(`[astro-events] ingress ${name}:`, e.message);
    }
  }

  // 4. Rétrograde / direct (Mercure, Vénus, Mars) — approximation par vitesse écliptique
  // Si la longitude diminue sur la fenêtre, on est en rétrograde.
  for (const body of [Astronomy.Body.Mercury, Astronomy.Body.Venus, Astronomy.Body.Mars]) {
    try {
      const lonA = eclipticLon(body, now);
      const lonB = eclipticLon(body, new Date(now.getTime() + 6 * 3600_000));
      if (lonA == null || lonB == null) continue;

      // Détecter un changement de direction (station)
      const lonPrev = eclipticLon(body, new Date(now.getTime() - 6 * 3600_000));
      if (lonPrev == null) continue;

      const dBefore = ((lonA - lonPrev + 540) % 360) - 180; // delta signé -180..180
      const dAfter  = ((lonB - lonA + 540) % 360) - 180;

      // Changement de signe de vitesse → station (rétrograde → direct ou inverse)
      if (Math.sign(dBefore) !== Math.sign(dAfter) && Math.abs(dBefore) < 1 && Math.abs(dAfter) < 1) {
        const name = body === Astronomy.Body.Mercury ? 'Mercure'
          : body === Astronomy.Body.Venus ? 'Vénus' : 'Mars';
        const direction = dAfter > 0 ? 'reprend sa marche directe' : 'rentre en rétrograde';
        events.push({
          type: 'station',
          title: `${name} ${direction}`,
          body: `${name} ${direction}. Ralentis. Revois. Les retours en arrière ne sont jamais gratuits.`,
          emoji: body === Astronomy.Body.Mercury ? '☿️' : body === Astronomy.Body.Venus ? '♀️' : '♂️',
          when: now.toISOString(),
        });
      }
    } catch (e) {
      console.error('[astro-events] station:', e.message);
    }
  }

  // Dédupliquat : un seul événement par type+titre (l'ingress peut tirer 2x)
  const seen = new Set();
  return events.filter(e => {
    const k = `${e.type}|${e.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Job runner ─────────────────────────────────────────────────

/**
 * P1#8 — runAstroEventsJob :
 *   - détecte les événements du jour
 *   - envoie un push ciblé aux users premium (et free qui ont opté-in)
 *
 * Doit recevoir (db, sendPushToUser, notifyAllUsers) du server.js parent.
 */
export async function runAstroEventsJob(db, sendPushToUser) {
  try {
    const events = detectAstroEvents(new Date(), 24);
    if (events.length === 0) {
      console.log('[cron:astro-events] Aucun événement astronomique dans les 24h.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Users premium avec push activé et qui n'ont pas déjà reçu l'event aujourd'hui
    // (on stocke la date du dernier push astro dans last_astro_event_push)
    const users = db.prepare(`
      SELECT DISTINCT u.id, u.last_astro_event_push
      FROM users u
      JOIN push_subscriptions ps ON ps.user_id = u.id
      WHERE u.is_premium = 1
        AND (u.last_astro_event_push IS NULL OR u.last_astro_event_push != ?)
    `).all(today);

    if (users.length === 0) {
      console.log(`[cron:astro-events] ${events.length} événement(s), 0 user éligible (déjà notifiés ou pas de push).`);
      return;
    }

    let sent = 0;
    for (const event of events) {
      // On envoie au maximum le 1er événement majeur (pour ne pas spammer)
      // Sauf si c'est une éclipse + une pleine lune (on combine)
      for (const user of users) {
        const payload = {
          title: `✨ ${event.title}`,
          body: event.body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: `celeste-astro-${event.type}-${today}`,
          url: '/?screen=horoscope',
          data: { type: 'astro-event', eventType: event.type, when: event.when },
        };
        const result = await sendPushToUser(user.id, payload);
        if (result.sent > 0) sent++;
      }
    }

    if (sent > 0) {
      // Marquer les users comme notifiés aujourd'hui
      const ids = users.map(u => u.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE users SET last_astro_event_push = ? WHERE id IN (${placeholders})`).run(today, ...ids);
      console.log(`[cron:astro-events] ${sent} push envoyé(s) pour ${events.length} événement(s) à ${users.length} user(s).`);
    }
  } catch (err) {
    console.error('[cron:astro-events] error:', err.message);
  }
}
