// v15 — Horoscope du jour 100 % déterministe (zéro LLM), vraiment personnel :
// il se base sur les aspects exacts entre les planètes du jour et TON thème natal,
// et sur la maison que la Lune traverse chez toi. Deux Taureau n'ont donc pas le
// même texte. Voix Céleste : tutoiement, concret, jamais fataliste.

const PFR = { sun: 'le Soleil', moon: 'la Lune', mercury: 'Mercure', venus: 'Vénus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne' };
const NFR = { sun: 'ton Soleil', moon: 'ta Lune', mercury: 'ton Mercure', venus: 'ta Vénus', mars: 'ton Mars', ascendant: 'ton Ascendant' };

// Ce que la planète du jour apporte
const TRANSIT_THEME = {
  sun: 'la lumière du jour', moon: "l'humeur du moment", mercury: 'les échanges et les idées',
  venus: "l'envie de douceur et de lien", mars: "l'énergie et l'envie d'agir", jupiter: "un vent d'ouverture", saturn: 'une exigence de sérieux',
};
// Ce que le point natal représente chez toi
const NATAL_DOMAIN = {
  sun: 'ta confiance et ce que tu veux vraiment', moon: 'tes émotions et ton besoin de sécurité',
  mercury: 'ta façon de penser et de parler', venus: 'tes relations et ce qui te fait plaisir',
  mars: 'ta volonté et ta façon de t\'affirmer', ascendant: "l'image que tu renvoies",
};
const ASPECTS = [
  { name: 'conjonction', angle: 0, tone: 'focus' },
  { name: 'sextile', angle: 60, tone: 'easy' },
  { name: 'carré', angle: 90, tone: 'tense' },
  { name: 'trigone', angle: 120, tone: 'easy' },
  { name: 'opposition', angle: 180, tone: 'tense' },
];
const ORB = { moon: 6, sun: 3, mercury: 3, venus: 3, mars: 3, jupiter: 2.5, saturn: 2.5 };
const WEIGHT = { moon: 1, sun: 2, mercury: 2, venus: 2.2, mars: 2.4, jupiter: 3, saturn: 3.2 };
const NATAL_WEIGHT = { sun: 1.3, moon: 1.3, ascendant: 1.1, venus: 1, mars: 1, mercury: 0.9 };

const TONE_LINE = {
  easy: [
    (t, n) => `${cap(t)} soutient ${n} : c'est fluide, profite-en pour avancer sans forcer.`,
    (t, n) => `${cap(t)} s'accorde avec ${n}. Ce que tu entreprends aujourd'hui trouve plus facilement sa place.`,
    (t, n) => `Belle entente entre ${t} et ${n} : fais confiance à ce qui vient naturellement.`,
  ],
  tense: [
    (t, n) => `${cap(t)} bouscule ${n}. Une friction peut apparaître — elle te montre ce qui demande à bouger.`,
    (t, n) => `${cap(t)} met ${n} sous tension. Ralentis avant de réagir : ta réponse sera plus juste.`,
    (t, n) => `Petit frottement entre ${t} et ${n}. Rien de grave, mais ne prends pas tout pour toi.`,
  ],
  focus: [
    (t, n) => `${cap(t)} se pose sur ${n} : tout est amplifié, dans un sens comme dans l'autre.`,
    (t, n) => `${cap(t)} active directement ${n}. C'est un jour où ce thème te saute aux yeux.`,
  ],
};
const ADVICE = {
  easy: ['Ose la demande que tu repousses.', 'Dis oui à une invitation.', 'Lance la petite chose que tu remets à demain.', 'Appuie-toi sur quelqu\'un qui te fait du bien.'],
  tense: ['Respire avant d\'envoyer ce message.', 'Garde une marge dans ton planning.', 'Choisis une seule bataille aujourd\'hui.', 'Note ce qui t\'agace : ça dit quelque chose de toi.'],
  focus: ['Pose une intention claire ce matin.', 'Écris ce que tu ressens, même trois lignes.', 'Fais une chose, mais à fond.'],
};

// La Lune dans tes maisons (système égal depuis l'Ascendant)
const MOON_HOUSE = {
  1: "La Lune passe sur ton Ascendant : tu es plus à fleur de peau, et plus visible aussi. Écoute ton corps.",
  2: "La Lune traverse ta zone des ressources : envie de confort, de bien manger, de compter un peu tes sous.",
  3: "La Lune anime ta zone des échanges : messages, appels, petits trajets. Ta parole porte.",
  4: "La Lune rentre à la maison : besoin de cocon, de famille, de calme. Ne culpabilise pas de rester chez toi.",
  5: "La Lune éclaire ta zone du plaisir : joue, crée, flirte — ton cœur a envie de légèreté.",
  6: "La Lune passe par ton quotidien : c'est le jour pour ranger, soigner ton corps, avancer sur les petites tâches.",
  7: "La Lune se tourne vers l'autre : tes relations prennent le devant, en amour comme en amitié.",
  8: "La Lune plonge dans ta zone intime : émotions profondes, sujets de confiance. Va au fond des choses.",
  9: "La Lune t'emmène loin : envie d'apprendre, de voyager, de voir plus grand.",
  10: "La Lune monte au sommet de ton ciel : ton travail et ta réputation sont sous les projecteurs.",
  11: "La Lune réveille ta zone des amis et des projets : entoure-toi, partage tes envies.",
  12: "La Lune traverse ta zone secrète : fatigue possible, besoin de retrait. Accorde-toi du silence.",
};
const MOON_HOUSE_LOVE = {
  1: 'On te remarque plus que d\'habitude — laisse-toi approcher.', 2: 'Les petites attentions concrètes comptent plus que les grands mots.',
  3: 'Un message sincère peut tout débloquer.', 4: 'La tendresse se vit à la maison, simplement.', 5: 'Jour idéal pour séduire ou raviver la flamme.',
  6: 'Montre ton amour par un geste utile.', 7: 'Ton couple ou tes liens proches demandent ta présence.', 8: 'Une conversation profonde vous rapproche.',
  9: 'Partager un projet ou une idée vous lie.', 10: 'L\'équilibre entre travail et cœur est à surveiller.', 11: 'L\'amitié peut glisser vers plus — ou te ressourcer.',
  12: 'Garde un peu de mystère, et du temps pour toi.',
};
const MOON_HOUSE_WORK = {
  1: 'Prends l\'initiative, ton énergie personnelle compte.', 2: 'Bon jour pour un point budget ou une négociation.', 3: 'Écris, présente, explique : tu es clair·e.',
  4: 'Travaille au calme, loin du bruit si tu peux.', 5: 'Laisse parler ta créativité, même dans un dossier sérieux.', 6: 'Coche ta liste : la régularité paie aujourd\'hui.',
  7: 'Collabore plutôt que de tout porter seul·e.', 8: 'Creuse un sujet de fond, évite le superficiel.', 9: 'Pense long terme, formation, perspective.',
  10: 'Montre ce que tu fais : c\'est le moment d\'être vu·e.', 11: 'Ton réseau t\'ouvre une porte.', 12: 'Avance en coulisses, sans pression.',
};
const MOODS = {
  easy: ['élan tranquille', 'douce confiance', 'ouverture', 'légèreté'],
  tense: ['intensité lucide', 'tension créative', 'besoin de recul', 'nerfs à vif'],
  focus: ['concentration', 'intensité', 'clarté'],
};

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
function pick(arr, seed) { return arr[seed % arr.length]; }

export function findTransitAspects(natal, transits) {
  const out = [];
  for (const tp of Object.keys(ORB)) {
    const t = transits?.[tp];
    if (typeof t?.longitude !== 'number') continue;
    for (const np of Object.keys(NFR)) {
      const n = natal?.[np];
      if (typeof n?.longitude !== 'number') continue;
      let d = Math.abs(t.longitude - n.longitude) % 360; if (d > 180) d = 360 - d;
      for (const a of ASPECTS) {
        const orb = Math.abs(d - a.angle);
        if (orb <= ORB[tp]) {
          const score = WEIGHT[tp] * (NATAL_WEIGHT[np] || 1) * (1 - orb / (ORB[tp] + 0.5));
          out.push({ transit: tp, natal: np, aspect: a.name, tone: a.tone, orb: Math.round(orb * 10) / 10, score });
        }
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// Score unique 0-100 de la journée (toutes les cartes « énergie » s'alignent dessus)
export function dayScore(natal, transits) {
  const asps = findTransitAspects(natal, transits);
  let s = 58;
  for (const a of asps.slice(0, 8)) s += (a.tone === 'easy' ? 7 : a.tone === 'tense' ? -8 : 2) * Math.min(1.5, a.score / 2);
  return Math.round(Math.max(12, Math.min(96, s)));
}

function moonHouse(natal, transits) {
  const asc = natal?.ascendant?.longitude, m = transits?.moon?.longitude;
  if (typeof asc !== 'number' || typeof m !== 'number') return null;
  return Math.floor((((m - asc) % 360) + 360) % 360 / 30) + 1;
}

export function buildHoroscope(natal, transits, { dateKey = new Date().toISOString().slice(0, 10), userKey = '' } = {}) {
  const asps = findTransitAspects(natal, transits);
  const seed = hash(`${dateKey}|${userKey}|${natal?.sun?.longitude}|${natal?.moon?.longitude}`);
  const house = moonHouse(natal, transits);
  const main = asps.find(a => a.transit !== 'moon') || asps[0] || null;
  const tone = main?.tone || 'easy';

  const general = [];
  if (main) general.push(pick(TONE_LINE[main.tone], seed)(PFR[main.transit], NFR[main.natal]) + ` Ça touche ${NATAL_DOMAIN[main.natal]}.`);
  if (house) general.push(MOON_HOUSE[house]);
  if (!general.length) general.push(`La Lune en ${transits?.moon?.sign || 'transit'} colore ta journée : avance à ton rythme.`);
  general.push(pick(ADVICE[tone], seed >> 3));

  const loveAsp = asps.find(a => ['venus', 'moon'].includes(a.transit) || a.natal === 'venus');
  const workAsp = asps.find(a => ['mars', 'mercury', 'saturn', 'jupiter', 'sun'].includes(a.transit) && a.natal !== 'venus');
  const amour = loveAsp
    ? `${cap(PFR[loveAsp.transit])} en ${loveAsp.aspect} avec ${NFR[loveAsp.natal]} : ${loveAsp.tone === 'tense' ? 'un malentendu se dissipe si tu dis les choses simplement.' : 'un moment de vraie complicité est possible.'} ${house ? MOON_HOUSE_LOVE[house] : ''}`.trim()
    : (house ? MOON_HOUSE_LOVE[house] : 'Sois doux·ce avec toi, et avec ceux que tu aimes.');
  const carriere = workAsp
    ? `${cap(PFR[workAsp.transit])} en ${workAsp.aspect} avec ${NFR[workAsp.natal]} : ${workAsp.tone === 'tense' ? 'avance pas à pas, sans brûler d\'étapes.' : 'tes efforts se voient, ose proposer.'} ${house ? MOON_HOUSE_WORK[house] : ''}`.trim()
    : (house ? MOON_HOUSE_WORK[house] : 'Une tâche à la fois, et tu verras le bout.');

  const score = dayScore(natal, transits);
  const why = asps.slice(0, 3).map(a => `${cap(PFR[a.transit])} ${a.aspect} ${NFR[a.natal].replace(/^(ton|ta) /, '$1 ')} natal${a.natal === 'moon' || a.natal === 'venus' ? 'e' : ''} (orbe ${a.orb}°)`);
  if (house) why.push(`Lune en maison ${house}`);

  return {
    general: general.join(' '),
    amour,
    carriere,
    energie: Math.max(1, Math.min(5, Math.round(score / 20))),
    score,
    mood: pick(MOODS[tone], seed >> 5),
    why,
  };
}
