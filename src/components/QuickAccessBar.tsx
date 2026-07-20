import type { Screen } from '../App';

/**
 * QuickAccessBar — barre horizontale de 4 mini-cards pour accéder
 * aux rituels du jour sans scroller.
 *
 * Proposition B "Dashboard Rituel" — affichée juste sous le HeroPrediction,
 * elle donne à l'user une vue d'esprit des 4 rituels disponibles et lui
 * permet d'y sauter directement.
 *
 * Clic → scrollIntoView vers la section correspondante (IDs fixés sur les
 * composants dans Home.tsx).
 */
const ITEMS = [
  { id: 'tarot', icon: '🃏', label: 'Tarot' },
  { id: 'energy', icon: '⚡', label: 'Énergie' },
  { id: 'intention', icon: '✦', label: 'Intention' },
  { id: 'ritual', icon: '🌙', label: 'Rituel soir' },
] as const;

export function QuickAccessBar() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(`home-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.3s';
      el.style.boxShadow = '0 0 0 1px rgba(251,191,36,0.2)';
      setTimeout(() => { el.style.boxShadow = ''; }, 1200);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl glass border border-night-700/20 transition-all active:scale-95 hover:border-night-500/40"
        >
          <span className="text-base opacity-80">{item.icon}</span>
          <span className="text-[10px] text-night-400">{item.label}</span>
        </button>
      ))}
    </div>
  );
}