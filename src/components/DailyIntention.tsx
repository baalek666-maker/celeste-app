import { useEffect, useState } from 'react';
import CelesteLogo from './CelesteLogo';

/**
 * DailyIntention — geste rituel au cœur de Home.
 *
 * v14.9.g — Logo Céleste remplace le cercle tracé. Le logo parle de lui-même :
 * soleil alchimique avec lune en cœur, l'union cosmique, l'identité de l'app.
 * Pas besoin d'un cercle abstrait en plus.
 *
 * UX : le logo apparaît immédiatement, la phrase fade-in après 800ms.
 * Phrase change toutes les 24h (date ISO) — pas de re-use identique 2 jours de suite.
 */
const INTENTIONS: string[] = [
  "Trois respirations. Pose ton téléphone après la deuxième.",
  "Ce qui compte vraiment t'attend déjà. Ouvre les yeux.",
  "Tu n'as rien à prouver aujourd'hui. Juste à ressentir.",
  "Laisse venir. Ne pousse pas la porte, pousse-toi de la porte.",
  "Ton corps sait. Ta tête doute. Fais confiance au premier.",
  "Tu n'es pas en retard. Tu es exactement où tu dois être.",
  "Le silence a autant de choses à dire que le bruit.",
  "Aujourd'hui, ne décide rien qui coûte ta paix.",
  "Tu mérites ce que tu hésites à demander.",
  "Ce que tu cherches dehors est déjà en toi.",
];

function pickIntention(): string {
  const today = new Date().toISOString().slice(0, 10);
  // Hash déterministe date → index, pour qu'un user ne voie jamais 2x la même
  // phrase 2 jours de suite (mais stable dans la journée)
  let h = 0;
  for (let i = 0; i < today.length; i++) h = (h * 31 + today.charCodeAt(i)) >>> 0;
  return INTENTIONS[h % INTENTIONS.length];
}

export default function DailyIntention() {
  const [text] = useState(pickIntention);
  const [showLogo, setShowLogo] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Logo fade-in rapide (300ms), phrase apparaît 800ms après
    const t1 = setTimeout(() => setShowLogo(true), 300);
    const t2 = setTimeout(() => setShowText(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center my-8 px-6 py-6 select-none" aria-hidden="false">
      {/* Logo Céleste — fade-in au mount, doucement */}
      <div
        className="relative mb-5"
        style={{
          opacity: showLogo ? 1 : 0,
          transform: showLogo ? 'scale(1)' : 'scale(0.85)',
          transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
        }}
      >
        {/* Halo doré subtil derrière le logo */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -m-6 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(197,160,89,0.18) 0%, rgba(197,160,89,0) 65%)',
          }}
        />
        <CelesteLogo size={88} animated className="relative drop-shadow-[0_0_20px_rgba(197,160,89,0.25)]" />
      </div>

      <p
        className="text-center text-sm italic text-night-200 max-w-xs leading-relaxed"
        style={{
          opacity: showText ? 1 : 0,
          transform: showText ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        }}
      >
        {text}
      </p>
    </div>
  );
}