// PersonalTransits — wrapper de compatibilité.
// La logique complète (hero card + feed swipe unifié transits + maisons)
// est maintenant dans TransitHero.tsx. Ce wrapper reste pour ne pas casser
// les imports existants (DailySky.tsx, etc).
import TransitHero from './TransitHero';

export default function PersonalTransits() {
  return <TransitHero />;
}
