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

/**
 * DailyGreeting — signature émotionnelle VMF v2.
 * Remplace le "Bonjour" générique par une accroche personnalisée.
 * Angle #2 "creepy accurate" : "Si précise que tu vas te dire : mais comment elle sait ça ?"
 */
export default function DailyGreeting({ sunSignKey, firstName, streak }: {
  sunSignKey: string;
  firstName?: string;
  streak: number;
}) {
  const sign = ZODIAC_SIGNS[sunSignKey as ZodiacSign];
  const greeting = SIGN_GREETINGS[sunSignKey] || 'Le ciel a quelque chose à te dire';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-night-400 text-xs capitalize tracking-wide">{today}</p>
        {streak >= 2 && (
          <span className="text-[10px] text-gold-400 font-semibold bg-gold-500/10 px-2.5 py-1 rounded-full border border-gold-500/30 flex items-center gap-1">
            🔥 {streak}j
          </span>
        )}
      </div>
      <h1 className="text-3xl font-bold text-gold-gradient leading-tight">
        Ton ciel du jour
      </h1>
      <p className="text-night-200 text-sm mt-2 leading-relaxed italic">
        « {greeting}{firstName ? `, ${firstName}` : ''}. »
      </p>
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