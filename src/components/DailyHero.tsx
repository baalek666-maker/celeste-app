import { useEffect, useState } from 'react';
import CelesteLogo from './CelesteLogo';
import { getDailyDominantTransit, TRANSIT_INFO } from '../lib/dailyTransit';

/**
 * DailyHero — haut de page d'accueil.
 *
 * v14.9.h — Inspiré de la landing page :
 *  - Logo Céleste en grand (88-96px), halo doré
 *  - Badge "Données NASA · temps réel" (rappel data quality)
 *  - Carte "Aperçu · aujourd'hui" avec transit dominant + hook du jour
 *  - Username + signe en sous-titre (touch perso)
 *
 * Différences avec la landing :
 *  - Pas de pagination dots (pas un slider)
 *  - Username + signe (user logged in)
 *  - Carte du jour remplace le slider d'aperçus multi-signs
 *
 * Pourquoi on a ça : "le haut fait un peu vide" (user feedback).
 * Maintenant le user ouvre l'app et il a un repère fort (logo + badge
 * qualité data + un truc à lire sur son jour), pas juste un logo
 * perdu au milieu.
 */
export function DailyHero({ firstName, sunSignName, sunSignGlyph, sunSignColor }: {
  firstName?: string;
  sunSignName?: string;
  sunSignGlyph?: string;
  sunSignColor?: string;
}) {
  const [transitKey] = useState(() => getDailyDominantTransit());
  const transit = TRANSIT_INFO[transitKey];

  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="relative pt-2 pb-6 animate-fade-in"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
      }}
    >
      {/* ── Logo en grand, centré, halo doré ── */}
      <div className="flex justify-center mb-3">
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 -m-8 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(197,160,89,0.22) 0%, rgba(197,160,89,0) 60%)',
            }}
          />
          <CelesteLogo size={104} animated className="relative drop-shadow-[0_0_24px_rgba(197,160,89,0.3)]" />
        </div>
      </div>

      {/* ── Salutation + signe (touch perso) ── */}
      <div className="text-center mb-4">
        <h1 className="text-night-50 text-2xl font-light tracking-tight" style={{ fontFamily: 'Georgia, "Cormorant Garamond", serif' }}>
          {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
        </h1>
        {sunSignName && (
          <p className="text-[12px] text-night-400 mt-1 flex items-center justify-center gap-1.5">
            {sunSignGlyph && (
              <span style={{ color: sunSignColor }} className="text-sm">{sunSignGlyph}</span>
            )}
            <span>Signe solaire · {sunSignName}</span>
          </p>
        )}
      </div>

      {/* ── Badge NASA · temps réel ── */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-night-700/60 bg-night-800/40">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
          </span>
          <span className="text-[10px] tracking-[0.15em] text-night-400 uppercase font-medium">
            Données NASA · temps réel
          </span>
        </div>
      </div>

      {/* ── Carte aperçu du jour (transit dominant) ── */}
      <div className="relative rounded-2xl overflow-hidden border border-night-700/50 bg-gradient-to-br from-night-800/60 to-night-900/60 backdrop-blur-sm">
        {/* Bordure subtile or en haut */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cosmic-500/50 to-transparent" />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] tracking-[0.2em] text-cosmic-400 font-semibold uppercase flex items-center gap-1.5">
              <span style={{ color: transit.accent }} className="text-sm">{transit.glyph}</span>
              Aperçu · aujourd'hui
            </span>
            <span className="text-[10px] text-night-500 tracking-wider uppercase">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          <p
            className="text-night-100 text-[15px] leading-relaxed font-light"
            style={{ fontFamily: 'Georgia, "Cormorant Garamond", serif' }}
          >
            « {transit.dailyHook} »
          </p>

          <p className="text-[10px] text-night-500 mt-3 tracking-wide">
            <span className="text-cosmic-400">{transit.label}</span> · transit dominant calculé sur éphémérides
          </p>
        </div>
      </div>
    </div>
  );
}

export default DailyHero;
