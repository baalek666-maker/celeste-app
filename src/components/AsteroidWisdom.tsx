import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getUser } from '../lib/storage';

/**
 * AsteroidWisdom — "Tes Blessures & Pouvoirs"
 *
 * v14.9.k — Composant rendu 100% côté client : calcule les positions
 * d'astéroïdes via les éphémérides locales (astronomy-engine), puis
 * affiche le texte déterministe par archétype × signe.
 *
 * Plus d'appel serveur pour ce module. Le user voit TOUJOURS quelque
 * chose : positions calculées + interprétation déterministe (même si
 * le LLM n'a jamais tourné).
 *
 * Si on a aussi le cache serveur (LLM-generated), on l'utilise en
 * surcouche pour enrichir. Sinon on reste sur le fallback.
 */

type Archetype = {
  key: string;
  name: string;
  archetype: string;
  icon: string;
  sign: string;
  degree: number;
  glyph: string;
  title?: string;
  meaning?: string;
  gift?: string;
  shadow?: string;
  practice?: string;
};

type WisdomData = {
  headline: string;
  archetypes: Archetype[];
  generatedAt?: string;
  cached?: boolean;
};

// ── Géométrie astéroïdes (mêmes constantes que server/routes/asteroid-wisdom.js) ──

const SIGN_GLYPHS: Record<string, string> = {
  'Bélier': '♈', 'Taureau': '♉', 'Gémeaux': '♊', 'Cancer': '♋',
  'Lion': '♌', 'Vierge': '♍', 'Balance': '♎', 'Scorpion': '♏',
  'Sagittaire': '♐', 'Capricorne': '♑', 'Verseau': '♒', 'Poissons': '♓'
};

const SIGNS = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];

const ASTEROIDS: Record<string, { name: string; archetype: string; icon: string; a: number; e: number; i: number; node: number; argPeri: number; M0: number; period: number; }> = {
  chiron:  { name: 'Chiron',  archetype: 'La blessure guérisseuse',  icon: '🩹',
             a: 13.65, e: 0.379, i: 6.93,  node: 209.3, argPeri: 339.8, M0: 92.3,  period: 50.7 },
  ceres:   { name: 'Cérès',   archetype: 'Comment tu nourris',        icon: '🌾',
             a: 2.77,  e: 0.076, i: 10.59, node: 80.41, argPeri: 71.0,  M0: 78.6,  period: 4.60 },
  pallas:  { name: 'Pallas',  archetype: 'Ta stratégie intuitive',    icon: '🦉',
             a: 2.77,  e: 0.231, i: 34.84, node: 173.1, argPeri: 309.9, M0: 134.7, period: 4.61 },
  juno:    { name: 'Junon',   archetype: 'Ce que tu attends des liens', icon: '💍',
             a: 2.67,  e: 0.258, i: 12.98, node: 169.9, argPeri: 247.7, M0: 71.2,  period: 4.36 },
  vesta:   { name: 'Vesta',   archetype: 'Ton feu intérieur',         icon: '🔥',
             a: 2.36,  e: 0.088, i: 7.14,  node: 103.9, argPeri: 149.8, M0: 109.7, period: 3.63 },
};

// ── Calculs éphémérides (Kepler simplifié, copié de server/routes/asteroid-wisdom.js) ──

function asteroidEclipticLon(el: typeof ASTEROIDS[keyof typeof ASTEROIDS], date: Date): number {
  const epoch = Date.UTC(2000, 0, 0, 12, 0, 0);
  const days = (date.getTime() - epoch) / 86400000;
  const n = 360 / (el.period * 365.25);
  let M = el.M0 + n * days;
  M = ((M % 360) + 360) % 360 * Math.PI / 180;
  let E = M;
  for (let iter = 0; iter < 8; iter++) {
    E = E - (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  }
  E = E * 180 / Math.PI;
  const v = Math.atan2(
    Math.sqrt(1 - el.e * el.e) * Math.sin(E * Math.PI / 180),
    Math.cos(E * Math.PI / 180) - el.e
  ) * 180 / Math.PI;
  let lon = ((el.node + el.argPeri + v) % 360 + 360) % 360;
  return Math.round(lon * 100) / 100;
}

function degToSignInfo(lon: number) {
  const sign = SIGNS[Math.floor(lon / 30)];
  const degree = Math.round((lon % 30) * 10) / 10;
  return { sign, degree, absDeg: lon };
}

// ── Fallback déterministe par archétype × signe ──

const ARCH_FALLBACK: Record<string, {
  meaning: (s: string) => string;
  gift: (s: string) => string;
  shadow: (s: string) => string;
  practice: (s: string) => string;
}> = {
  chiron: {
    meaning: (s) => `Chiron en ${s} marque là où tu as été blessé·e — et là où tu peux devenir guide pour d'autres qui vivent la même chose. C'est ta blessure guérisseuse.`,
    gift: (s) => `Tu peux accompagner ceux qui vivent ce que tu as traversé — sans en faire un métier, mais avec une présence qui désarme.`,
    shadow: (s) => `Le piège : rester dans le rôle du blessé pour ne pas avoir à vivre ta propre guérison. Tant que tu soignes les autres, tu n'as pas à te soigner toi-même.`,
    practice: (s) => `Accepte cette semaine de recevoir au lieu de donner — accepte un soin, un compliment, un service.`,
  },
  ceres: {
    meaning: (s) => `Cérès en ${s} raconte comment tu nourris et ce dont tu as besoin pour te sentir nourri·e. Ta manière de prendre soin est ta signature.`,
    gift: (s) => `Tu sais créer un espace où les gens se sentent en sécurité — par ta présence, ta cuisine, ton écoute.`,
    shadow: (s) => `Attention à confondre "prendre soin des autres" et s'oublier soi-même. Le don peut devenir épuisement si tu ne reçois rien en retour.`,
    practice: (s) => `Liste trois choses qui te nourrissent vraiment cette semaine — et fais-en au moins une chaque jour, sans négocier.`,
  },
  pallas: {
    meaning: (s) => `Pallas en ${s} révèle ton intelligence stratégique — là où tu vois des patterns que personne d'autre ne voit. C'est ta façon de penser unique.`,
    gift: (s) => `Tu peux résoudre des problèmes que d'autres fuient — par ta capacité à relier des informations que personne ne rapproche.`,
    shadow: (s) => `Le piège : intellectualiser au lieu de ressentir. Quand tu analyses trop, tu perds l'intuition qui fait ta vraie force.`,
    practice: (s) => `Coupe ton esprit 10 minutes par jour (marche, musique, danse) — et vois ce qui remonte quand tu n'analyses plus.`,
  },
  juno: {
    meaning: (s) => `Junon en ${s} décrit ce que tu attends des liens profonds — ta vision du partenariat égal et juste.`,
    gift: (s) => `Tu sais créer des relations où chacun a sa place, sans jeu de pouvoir. C'est rare.`,
    shadow: (s) => `Le piège : confondre engagement et perte de soi. T'investir à fond peut t'amener à oublier tes propres besoins.`,
    practice: (s) => `Note ce qui est non-négociable pour toi dans un lien — et ce qui est négociable. Mets les deux listes par écrit.`,
  },
  vesta: {
    meaning: (s) => `Vesta en ${s} indique où brûle ton feu sacré — ce à quoi tu es prêt·e à te consacrer entièrement.`,
    gift: (s) => `Quand tu t'engages sur quelque chose qui compte, tu deviens inarrêtable. Ta concentration devient magnétique.`,
    shadow: (s) => `Le piège : te consumer entièrement pour une cause au point de t'oublier. Le feu sacré a besoin d'être protégé pour durer.`,
    practice: (s) => `Identifie une chose que tu as négligée à force de te consacrer à ce qui brûle — et donne-lui 30 minutes aujourd'hui.`,
  },
};

function archFallback(p: Archetype) {
  const fb = ARCH_FALLBACK[p.key];
  if (!fb) {
    return {
      title: p.archetype,
      meaning: `${p.name} en ${p.sign} marque une facette de ton chemin intérieur — explore-la.`,
      gift: `Ce que cette position t'enseigne se révèle dans tes relations profondes.`,
      shadow: `Le piège serait de l'ignorer ou d'en faire trop — vise le milieu.`,
      practice: `Prends un moment de silence aujourd'hui et écoute ce que cette part de toi veut te dire.`,
    };
  }
  return {
    title: p.archetype,
    meaning: fb.meaning(p.sign),
    gift: fb.gift(p.sign),
    shadow: fb.shadow(p.sign),
    practice: fb.practice(p.sign),
  };
}

function computeLocal(birthDate: Date): WisdomData {
  const positions = Object.entries(ASTEROIDS).map(([key, el]) => {
    const lon = asteroidEclipticLon(el, birthDate);
    const info = degToSignInfo(lon);
    return {
      key,
      name: el.name,
      archetype: el.archetype,
      icon: el.icon,
      sign: info.sign,
      degree: info.degree,
      absDeg: info.absDeg,
      glyph: SIGN_GLYPHS[info.sign] || '·',
    };
  });

  return {
    headline: 'Tes archétypes intérieurs dessinent un chemin unique.',
    archetypes: positions.map(p => ({ ...p, ...archFallback(p) })),
  };
}

// ─── Composant ────────────────────────────────────────────────

export default function AsteroidWisdom() {
  const [data, setData] = useState<WisdomData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [birthMissing, setBirthMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    // 1) Récupère birth_data depuis le profil local (persisté par App.tsx)
    const user = getUser();
    const birthData = user?.birthData;
    if (!birthData) {
      // Pas de birth_data → on ne peut rien calculer. Message clair.
      setBirthMissing(true);
      return () => { alive = false; };
    }

    // 2) Calcul local immédiat (positions + fallback déterministe)
    try {
      const [y, m, d] = birthData.date.split('-').map(Number);
      const [h, min] = (birthData.time || '12:00').split(':').map(Number);
      const birthDate = new Date(Date.UTC(y, m - 1, d, h, min, 0));
      const local = computeLocal(birthDate);
      if (alive) setData(local);
    } catch (e: any) {
      if (alive) setErrorMsg('Impossible de calculer tes positions (' + (e?.message || 'erreur') + ').');
    }

    // 3) Optionnel : on tente d'enrichir avec le cache serveur (LLM-generated)
    api.getAsteroidWisdom()
      .then(d => {
        if (!alive) return;
        // Si le serveur a du contenu plus riche (title/meaning custom), on fusionne
        if (d?.archetypes?.length) {
          setData(prev => {
            if (!prev) return d;
            const merged = {
              ...prev,
              headline: d.headline || prev.headline,
              archetypes: prev.archetypes.map(a => {
                const richer = d.archetypes.find(x => x.key === a.key);
                return richer ? { ...a, ...richer } : a;
              }),
            };
            return merged;
          });
        }
      })
      .catch(() => { /* silencieux — on a déjà le fallback local */ });

    return () => { alive = false; };
  }, []);

  // ── Pas de birth_data → CTA clair ──
  if (birthMissing) {
    return (
      <div className="celeste-card mb-6 text-center py-8">
        <div className="text-3xl mb-3">🌑</div>
        <h3 className="text-sm font-semibold text-night-100 mb-2">Blessures & Pouvoirs</h3>
        <p className="text-xs text-night-400 mb-4 leading-relaxed">
          Pour découvrir tes archétypes (Chiron, Lilith, Cérès…), indique ta date de naissance.
        </p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('celeste:navigate', { detail: 'settings' }))}
          className="text-[11px] text-cosmic-400 underline"
        >
          Compléter mon profil →
        </button>
      </div>
    );
  }

  // ── Erreur de calcul ──
  if (errorMsg) {
    return (
      <div className="celeste-card mb-6 text-sm text-night-400">
        {errorMsg}
      </div>
    );
  }

  // ── Loading (court — calcul local est synchrone) ──
  if (!data) {
    return (
      <div className="celeste-card mb-6 animate-pulse">
        <div className="h-4 bg-night-700/30 rounded w-1/2 mb-3" />
        <div className="h-3 bg-night-700/30 rounded w-3/4 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-night-700/30 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ── Affichage ──
  return (
    <div className="celeste-card mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌑</span>
        <h3 className="text-sm font-semibold text-celeste-accent">Blessures & Pouvoirs</h3>
      </div>

      <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-violet-500/8 to-gold-500/5 border border-gold-500/20">
        <p className="text-sm text-night-100 leading-relaxed">{data.headline}</p>
      </div>

      <div className="space-y-2">
        {data.archetypes.map(a => {
          const isOpen = expanded === a.key;
          return (
            <div key={a.key} className="rounded-xl bg-night-800/30 border border-night-700/40 overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : a.key)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-night-800/50 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-night-100 truncate">
                    {a.title || a.archetype}
                  </p>
                  <p className="text-xs text-night-400">
                    {a.name} {a.glyph} {a.sign} · {a.degree}°
                  </p>
                </div>
                <span className={`text-night-500 transition-transform text-xs ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-night-700/40 pt-2.5">
                  {a.meaning && (
                    <p className="text-sm text-night-200 leading-relaxed">{a.meaning}</p>
                  )}
                  {a.gift && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-cosmic-400 font-medium mt-0.5 shrink-0">🎁 Don</span>
                      <p className="text-xs text-night-300 leading-relaxed flex-1">{a.gift}</p>
                    </div>
                  )}
                  {a.shadow && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-rose-300/80 font-medium mt-0.5 shrink-0">⚠ Piège</span>
                      <p className="text-xs text-night-400 leading-relaxed flex-1">{a.shadow}</p>
                    </div>
                  )}
                  {a.practice && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-emerald-300/80 font-medium mt-0.5 shrink-0">✦ Pratique</span>
                      <p className="text-xs text-night-300 leading-relaxed flex-1 italic">{a.practice}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}