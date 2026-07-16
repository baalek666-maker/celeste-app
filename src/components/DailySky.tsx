import PersonalTransits from './PersonalTransits';
import ActivatedHouses from './ActivatedHouses';
import DailyRituals from './DailyRituals';

/**
 * DailySky — une seule expérience "le ciel d'aujourd'hui".
 * Fusionne Transits + Maisons activées + Rituels en une page scrollable.
 */
export default function DailySky() {
  return (
    <div className="space-y-4">
      <PersonalTransits />
      <ActivatedHouses />
      <DailyRituals />
    </div>
  );
}
