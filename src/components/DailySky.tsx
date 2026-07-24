import PersonalTransits from './PersonalTransits';
import DailyRituals from './DailyRituals';

/**
 * DailySky — une seule expérience "le ciel d'aujourd'hui".
 * - PersonalTransits : hero card du transit principal + feed swipe (transits + maisons unifiés)
 * - DailyRituals : rituels du jour (module séparé, autre concept)
 *
 * v15.2 — Maisons activées fusionnées dans le feed (plus de section séparée).
 */
export default function DailySky() {
  return (
    <div className="space-y-4">
      <PersonalTransits />
      <DailyRituals />
    </div>
  );
}
