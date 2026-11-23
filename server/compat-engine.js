// v15 — Moteur de compatibilité 100 % déterministe (zéro LLM).
// Mode rapide : signes solaires uniquement (aucun aspect inventé).
// Mode détaillé : vraies longitudes des deux thèmes (synastrie, orbes classiques).
// Voix Céleste : tutoiement, concret, bienveillant, jamais fataliste.

const ORDER = ['Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge', 'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons'];
const ELEMENT = { 'Bélier': 'Feu', 'Lion': 'Feu', 'Sagittaire': 'Feu', 'Taureau': 'Terre', 'Vierge': 'Terre', 'Capricorne': 'Terre', 'Gémeaux': 'Air', 'Balance': 'Air', 'Verseau': 'Air', 'Cancer': 'Eau', 'Scorpion': 'Eau', 'Poissons': 'Eau' };
const MODE = { 'Bélier': 'cardinal', 'Cancer': 'cardinal', 'Balance': 'cardinal', 'Capricorne': 'cardinal', 'Taureau': 'fixe', 'Lion': 'fixe', 'Scorpion': 'fixe', 'Verseau': 'fixe', 'Gémeaux': 'mutable', 'Vierge': 'mutable', 'Sagittaire': 'mutable', 'Poissons': 'mutable' };
const PLANET_FR = { sun: 'Soleil', moon: 'Lune', mercury: 'Mercure', venus: 'Vénus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne' };

// Paires d'éléments : score de base + phrase (forces/défis)
const ELEMENT_PAIR = {
  'Feu-Feu': [88, "Deux feux : vous vous enflammez pour les mêmes envies, l'élan est immédiat.", "Deux feux peuvent aussi se brûler : apprenez à laisser l'autre gagner parfois."],
  'Terre-Terre': [84, "Deux signes de Terre : même besoin de concret, de fiabilité, de construire.", "Le risque, c'est la routine : prévoyez de la surprise."],
  'Air-Air': [82, "Deux signes d'Air : les conversations ne s'arrêtent jamais, vous vous stimulez.", "Beaucoup de mots, parfois peu d'ancrage : passez aussi aux actes."],
  'Eau-Eau': [86, "Deux signes d'Eau : vous vous comprenez sans parler, l'intimité vient vite.", "Les émotions peuvent déborder à deux : gardez chacun un espace à soi."],
  'Feu-Air': [84, "Le Feu et l'Air s'alimentent : l'un inspire, l'autre attise. Une relation vivante.", null],
  'Terre-Eau': [83, "La Terre et l'Eau se nourrissent : sécurité d'un côté, tendresse de l'autre.", null],
  'Feu-Terre': [52, "Le Feu apporte l'élan, la Terre la durée — ensemble, vous pouvez réaliser beaucoup.", "Rythmes différents : l'un fonce, l'autre veut être sûr. La patience est votre clé."],
  'Feu-Eau': [46, "Le Feu réchauffe, l'Eau adoucit : une attirance réelle entre deux opposés.", "L'un a besoin d'action, l'autre de douceur : nommez vos besoins, sans les deviner."],
  'Air-Terre': [50, "L'Air apporte les idées, la Terre les rend réelles : un duo complémentaire.", "L'un vit dans sa tête, l'autre dans le concret : il faudra traduire."],
  'Air-Eau': [54, "L'Air met des mots sur ce que l'Eau ressent : vous vous apprenez beaucoup.", "La logique et l'émotion ne parlent pas pareil : écoute avant de répondre."],
};
function pairKey(e1, e2) {
  return ELEMENT_PAIR[`${e1}-${e2}`] ? `${e1}-${e2}` : `${e2}-${e1}`;
}

// Relation entre les deux signes solaires (distance en signes)
const SIGN_GAP = {
  0: [6, 'Même signe : vous vous reconnaissez tout de suite — qualités comme défauts.'],
  1: [-4, 'Signes voisins : vous êtes différents sur l\'essentiel, mais vous vous apprenez beaucoup.'],
  2: [6, 'Vos signes sont en sextile : une entente facile, amicale, qui donne envie de faire ensemble.'],
  3: [-8, 'Vos signes sont en carré : il y a de la friction, mais aussi beaucoup d\'énergie entre vous.'],
  4: [10, 'Vos signes sont en trigone : l\'harmonie la plus fluide du zodiaque.'],
  5: [-6, 'Vos signes ne se « voient » pas naturellement : il faut faire un pas vers l\'autre.'],
  6: [2, 'Vos signes sont opposés : une attraction forte, comme deux moitiés d\'un même axe.'],
};

const MODE_TEXT = {
  'cardinal-cardinal': "Deux signes cardinaux : vous aimez tous les deux décider. Partagez le volant.",
  'fixe-fixe': "Deux signes fixes : loyauté énorme, mais aucun ne cède facilement.",
  'mutable-mutable': "Deux signes mutables : souplesse et légèreté, à condition que quelqu'un tranche.",
};

const CTX_LABEL = { romantic: 'amoureuse', family: 'familiale', friend: 'amicale', colleague: 'professionnelle' };

function aspectBetween(lon1, lon2) {
  let d = Math.abs(lon1 - lon2) % 360;
  if (d > 180) d = 360 - d;
  if (d <= 7) return { type: 'conjonction', harmonious: null, orb: d };
  if (Math.abs(d - 60) <= 5) return { type: 'sextile', harmonious: true, orb: Math.abs(d - 60) };
  if (Math.abs(d - 90) <= 6) return { type: 'carré', harmonious: false, orb: Math.abs(d - 90) };
  if (Math.abs(d - 120) <= 7) return { type: 'trigone', harmonious: true, orb: Math.abs(d - 120) };
  if (Math.abs(d - 180) <= 7) return { type: 'opposition', harmonious: false, orb: Math.abs(d - 180) };
  return null;
}

// Phrases pour les aspects inter-thèmes les plus parlants
function aspectSentence(p1, p2, asp, ctx) {
  const a = PLANET_FR[p1], b = PLANET_FR[p2];
  const pair = [p1, p2].sort().join('-');
  const good = asp.harmonious !== false;
  const lines = {
    'moon-sun': good
      ? `${p1 === 'sun' ? 'Ton Soleil et sa Lune' : 'Ta Lune et son Soleil'} s'accordent : vous vous comprenez, naturellement.`
      : `${p1 === 'sun' ? 'Ton Soleil et sa Lune' : 'Ta Lune et son Soleil'} se frottent : vos besoins profonds ne s'expriment pas pareil.`,
    'mars-venus': ctx === 'romantic' ? (good ? 'Vénus et Mars se répondent entre vos deux thèmes : la chimie est réelle.' : 'Vénus et Mars en tension : un désir intense, parfois électrique.') : null,
    'mercury-mercury': good ? 'Vos Mercure s\'entendent : vous vous comprenez à demi-mot.' : 'Vos Mercure se heurtent : vérifiez que vous parlez bien de la même chose.',
    'moon-moon': good ? 'Vos Lunes s\'accordent : même façon de vous ressourcer.' : 'Vos Lunes diffèrent : ce qui apaise l\'un peut agacer l\'autre.',
    'saturn-sun': good ? 'Saturne soutient le Soleil : une relation qui peut durer.' : 'Saturne pèse sur le Soleil : l\'un peut se sentir freiné par l\'autre.',
    'jupiter-sun': good ? 'Jupiter touche le Soleil : vous vous rendez mutuellement plus confiants.' : null,
    'sun-sun': good ? 'Vos Soleils s\'accordent : même direction de vie.' : 'Vos Soleils sont en tension : deux façons très différentes d\'avancer.',
    'moon-venus': good ? 'La Lune et Vénus se touchent : beaucoup de tendresse entre vous.' : null,
  };
  if (lines[pair] !== undefined) return lines[pair];
  return null;
}

export function computeCompat(chart1, chart2, ctx = 'romantic', quick = false) {
  const s1 = chart1?.sun?.sign, s2 = chart2?.sun?.sign;
  const e1 = ELEMENT[s1], e2 = ELEMENT[s2];
  const key = pairKey(e1, e2);
  const [base, elemStrength, elemChallenge] = ELEMENT_PAIR[key] || [60, null, null];
  const gap = (() => { const d = Math.abs(ORDER.indexOf(s1) - ORDER.indexOf(s2)); return Math.min(d, 12 - d); })();
  const [gapBonus, gapText] = SIGN_GAP[gap] || [0, null];

  const strengths = [];
  const challenges = [];
  if (elemStrength) strengths.push(elemStrength);
  if (elemChallenge) challenges.push(elemChallenge);
  if (gapText) (gapBonus >= 0 ? strengths : challenges).push(gapText);
  const m1 = MODE[s1], m2 = MODE[s2];
  if (m1 === m2 && MODE_TEXT[`${m1}-${m2}`]) challenges.push(MODE_TEXT[`${m1}-${m2}`]);

  let score = base + gapBonus;
  let harmonious = 0, tense = 0;

  if (!quick) {
    const planets = Object.keys(PLANET_FR);
    const found = [];
    for (const p1 of planets) for (const p2 of planets) {
      const a = chart1[p1], b = chart2[p2];
      if (typeof a?.longitude !== 'number' || typeof b?.longitude !== 'number') continue;
      const asp = aspectBetween(a.longitude, b.longitude);
      if (!asp) continue;
      if (asp.harmonious === true) harmonious++;
      if (asp.harmonious === false) tense++;
      const txt = aspectSentence(p1, p2, asp, ctx);
      if (txt) found.push({ txt, good: asp.harmonious !== false, orb: asp.orb });
    }
    found.sort((x, y) => x.orb - y.orb);
    const seen = new Set();
    for (const f of found) {
      if (seen.has(f.txt)) continue; seen.add(f.txt);
      (f.good ? strengths : challenges).push(f.txt);
    }
    // Lunes : besoin émotionnel
    const em1 = ELEMENT[chart1.moon?.sign], em2 = ELEMENT[chart2.moon?.sign];
    if (em1 && em2) {
      const mk = pairKey(em1, em2);
      score += ((ELEMENT_PAIR[mk]?.[0] ?? 60) - 65) / 5;
    }
    score += Math.max(-10, Math.min(10, (harmonious - tense) * 1.5));
  }

  score = Math.round(Math.max(28, Math.min(96, score)));
  const title = score >= 82 ? 'Une évidence rare'
    : score >= 70 ? 'Une belle entente'
    : score >= 56 ? 'Un duo qui se construit'
    : score >= 44 ? 'Une rencontre qui fait grandir'
    : 'Deux mondes à apprivoiser';

  const lbl = CTX_LABEL[ctx] || 'amoureuse';
  const description = score >= 70
    ? `${s1} et ${s2} : une relation ${lbl} où les choses coulent facilement. Votre défi, c'est de ne pas la tenir pour acquise.`
    : score >= 50
      ? `${s1} et ${s2} : une relation ${lbl} faite d'élans et d'ajustements. Ce qui vous différencie est aussi ce qui vous enrichit.`
      : `${s1} et ${s2} : une relation ${lbl} exigeante, mais rarement ennuyeuse. Elle demande de l'écoute — et elle peut beaucoup t'apprendre sur toi.`;

  return {
    score,
    title,
    strengths: strengths.slice(0, 4).length ? strengths.slice(0, 4) : ['Des ponts à construire, pas à pas.'],
    challenges: challenges.slice(0, 3).length ? challenges.slice(0, 3) : ['Peu de frictions majeures entre vos thèmes.'],
    description,
    quick: !!quick,
    _deterministic: true,
  };
}
