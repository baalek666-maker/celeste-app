import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';

const SIGN_GREETINGS: Record<string, string> = {
  aries: 'Que ton feu intérieur illumine aujourd\'hui',
  taurus: 'Ancre-toi, le ciel récompense la patience',
  gemini: 'Ta curiosité est ton meilleur outil du jour',
  cancer: 'Écoute ton ventre, il sait avant ta tête',
  leo: 'Brille sans t\'excuser, c\'est ta nature',
  virgo: 'Les détails du jour sont tes alliés',
  libra: 'Cherche l\'équilibre, pas le consensus',
  scorpio: 'Ta profondeur est un pouvoir, pas un poids',
  sagittarius: 'Vise large, l\'horizon est vaste aujourd\'hui',
  capricorn: 'Avance un pas après l\'autre, ça compte',
  aquarius: 'Ta différence est exactement ce qu\'il faut',
  pisces: 'Nage dans ton intuition, elle te porte',
};

interface PlanetPos {
  planet: string;
  sign: ZodiacSign;
}

/**
 * HeroPrediction — accroche émotionnelle VMF v2 (Piste A + C + E).
 *
 * - Remplace le simple "Bonjour" par une signature mémorable.
 * - Piste C : streak vivant (badge toujours visible).
 * - Piste E : si on a les planètes perso, on cite la planète en aspect
 *   pour passer du "générique" au "spot on".
 * - "Si précise que tu vas te dire : mais comment elle sait ça ?"
 */
export default function DailyGreeting({
  sunSignKey,
  firstName,
  streak,
  highlightPlanet,
}: {
  sunSignKey: string;
  firstName?: string;
  streak: number;
  highlightPlanet?: PlanetPos | null;
}) {
  const sign = ZODIAC_SIGNS[sunSignKey as ZodiacSign];
  const greeting = SIGN_GREETINGS[sunSignKey] || 'Le ciel a quelque chose à te dire';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const nameSuffix = firstName ? `, ${firstName}` : '';

  // Piste E — Prédiction personnalisée : on cite une planète perso si dispo
  const personalHook = highlightPlanet
    ? `${capitalize(highlightPlanet.planet)} en ${ZODIAC_SIGNS[highlightPlanet.sign]?.name ?? ''} éclaire ta journée.`
    : null;

  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-night-400 text-xs capitalize tracking-wide">{today}</p>
        {streak >= 1 && (
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
            streak >= 7
              ? 'text-gold-300 bg-gold-500/15 border-gold-400/40 shadow-sm shadow-gold-500/20'
              : 'text-gold-400 bg-gold-500/10 border-gold-500/30'
          }`}>
            🔥 {streak} jour{streak > 1 ? 's' : ''} de rituel
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gold-gradient leading-tight">
        Ton ciel du jour
      </h1>

      <p className="text-night-200 text-sm mt-2 leading-relaxed italic">
        « {greeting}{nameSuffix}. »
      </p>

      {personalHook && (
        <p className="text-gold-300/90 text-[13px] mt-2.5 leading-relaxed animate-fade-in">
          ✦ {personalHook}
        </p>
      )}

      {sign && (
        <div className="flex items-center gap-2 mt-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: `${sign.color}18`, border: `1px solid ${sign.color}40` }}
          >
            <span style={{ color: sign.color }}>{sign.symbol}</span>
          </div>
          <p className="text-night-400 text-xs">
            {firstName ? `${firstName}, ` : ''}{sunSignKey === 'capricorn' ? 'Capricorne' : sign.name}
          </p>
        </div>
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}