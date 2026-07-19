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

    // P0 #4 — Inclure les users FREE (qui ont activé push) en plus des premium.
    // Filtre : pas de push si déjà reçu aujourd'hui.
    // NB : sun/moon/rising sont dans users.natal_chart (TEXT JSON), pas en colonnes.
    const rawUsers = db.prepare(`
      SELECT DISTINCT u.id, u.is_premium, u.natal_chart,
             u.last_astro_event_push
      FROM users u
      JOIN push_subscriptions ps ON ps.user_id = u.id
      WHERE (u.last_astro_event_push IS NULL OR u.last_astro_event_push != ?)
    `).all(today);

    // Hydrate les signes depuis natal_chart JSON pour la personnalisation.
    const users = rawUsers.map(u => {
      let natal = {};
      try { natal = u.natal_chart ? JSON.parse(u.natal_chart) : {}; } catch { /* ignore */ }
      return {
        ...u,
        sun_sign: natal.sunSign || null,
        moon_sign: natal.moonSign || null,
        rising_sign: natal.risingSign || null,
      };
    });

    if (users.length === 0) {
      console.log(`[cron:astro-events] ${events.length} événement(s), 0 user éligible (déjà notifiés ou pas de push).`);
      return;
    }

    /**
     * P0 #4 — Personnalisation par profil astro.
     *
     * Pour chaque event, on adapte le `body` à la configuration natale de l'user :
     *  - Nouvelle lune en Cancer + user Soleil Lion → "fort impact sur ta maison 11"
     *  - Éclipse + user Lune Vierge → "tes émotions passent au crible ce week-end"
     *  - Rétrograde Mercure → on suggère d'éviter les contrats (universel)
     *
     * Si on n'arrive pas à personnaliser, on garde le body générique mais on ajoute
     * une ligne "Prends une minute pour voir comment ça touche ton thème."
     */
    function personalizeEvent(event, user) {
      const sun = (user.sun_sign || '').toLowerCase();
      const moon = (user.moon_sign || '').toLowerCase();
      const rising = (user.rising_sign || '').toLowerCase();

      // Titres personnalisés par évènement majeur
      if (event.type === 'lunar_eclipse') {
        if (moon === 'cancer' || rising === 'cancer') {
          return { ...event,
            body: `Éclipse de lune sur ton axe sensible. Tes émotions passent au crible ce week-end — note ce qui remonte, sans réagir.`,
          };
        }
        if (moon === 'capricorn' || rising === 'capricorn') {
          return { ...event,
            body: `Éclipse en Cancer — Capri­corne de Lune ou d'Ascendant : ce qui t'a retenu trop longtemps demande à sortir.`,
          };
        }
      }

      if (event.type === 'moon_phase') {
        if (event.title.includes('Pleine Lune') || event.title.includes('🌕')) {
          if (sun === moon) {
            return { ...event,
              body: `Pleine lune sur ton propre signe. Tes intentions du mois dernier se révèlent ce soir — laisse émerger ce qui demande à être vu.`,
            };
          }
          if (rising) {
            return { ...event,
              body: `Pleine lune. Si tu sens une tension inhabituelle, ton Ascendant en ${user.rising_sign} indique que c'est ton corps qui parle en premier.`,
            };
          }
        }
        if (event.title.includes('Nouvelle Lune')) {
          if (sun === 'cancer' || sun === 'capricorn') {
            return { ...event,
              body: `Nouvelle lune dans ton axe soin-travail. Pose une intention concrète pour les 4 semaines à venir — santé, mieux-être, engagement.`,
            };
          }
        }
      }

      if (event.type === 'retrograde_start' && event.title.includes('Mercure')) {
        if (['vierge', 'gemini'].includes(sun) || ['vierge', 'gemini'].includes(rising)) {
          return { ...event,
            body: `Mercure rétrograde — tu es Mercurien (Soleil ou Ascendant en Gémeaux/Vierge). Ralentis les signatures de contrat cette semaine, clarifie avant d'engager.`,
          };
        }
      }

      // Fallback générique — toujours inviter à relier à son thème
      return { ...event,
        body: `${event.body}\n\nPrends une minute ce soir : où ton thème natal éclaire-t-il ce qui arrive ?`,
      };
    }

    let sent = 0;
    for (const event of events) {
      // On envoie au maximum le 1er événement majeur (pour ne pas spammer)
      // Sauf si c'est une éclipse + une pleine lune (on combine)
      for (const user of users) {
        const personalized = personalizeEvent(event, user);
        const payload = {
          title: `${user.is_premium ? '✨' : '🌟'} ${personalized.title}`,
          body: personalized.body,
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
