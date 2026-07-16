import { useEffect, useState } from 'react';

/**
 * DailyIntention — geste rituel entre Hero et Tarot.
 *
 * VMF ligne 167 : "Ton rituel → Journal + Tarot + Horoscope".
 *
 * UX : 1 phrase méditative (courte, universelle, signe-agnostique),
 * qui apparaît en 2 temps : le cercle se trace (2.2s), puis la phrase
 * fade-in (700ms). Le tout donne le moment de recentrage que Co-Star n'a pas.
 *
 * La phrase change toutes les 24h (date ISO) — pas de re-use identique 2 jours de suite.
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
  const [circleDone, setCircleDone] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Cercle tracé en 2.2s, phrase apparaît 300ms après la fin
    const t1 = setTimeout(() => setCircleDone(true), 2200);
    const t2 = setTimeout(() => setShowText(true), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center my-8 px-6 py-6 select-none" aria-hidden="false">
      {/* Cercle qui se trace (SVG animé) */}
      <div className="relative w-24 h-24 mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <radialGradient id="intent-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F4D27A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F4D27A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#intent-glow)" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#F4D27A"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeDasharray="251.3"
            strokeDashoffset="0"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
              transition: 'stroke-opacity 1.5s ease-in-out',
              strokeOpacity: circleDone ? 1 : 0.4,
              animation: 'intent-trace 2.2s ease-out forwards',
            }}
          />
          {/* Symbole au centre, fade-in après cercle */}
          <text
            x="50"
            y="55"
            textAnchor="middle"
            fontSize="22"
            fill="#F4D27A"
            style={{
              opacity: circleDone ? 1 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
          >
            ✦
          </text>
        </svg>
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

      <style>{`
        @keyframes intent-trace {
          from { stroke-dashoffset: 251.3; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}