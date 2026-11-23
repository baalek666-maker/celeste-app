import DailyTarot from './DailyTarot';
import LunarCycle from './LunarCycle';
import ProgressionHub from './ProgressionHub';
import TarotCross from './TarotCross';

/**
 * DailyDraws — le rituel de tirage + la progression qui va avec.
 * Fusionne Tarot + Progression (XP, quêtes, défi, badges).
 */
export default function DailyDraws() {
  return (
    <div className="space-y-4">
      <DailyTarot />
      <TarotCross />
      <LunarCycle />
      <ProgressionHub />
    </div>
  );
}
