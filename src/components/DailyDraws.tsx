import DailyTarot from './DailyTarot';
import ProgressionHub from './ProgressionHub';

/**
 * DailyDraws — le rituel de tirage + la progression qui va avec.
 * Fusionne Tarot + Progression (XP, quêtes, défi, badges).
 */
export default function DailyDraws() {
  return (
    <div className="space-y-4">
      <DailyTarot />
      <ProgressionHub />
    </div>
  );
}
