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
  { id: 'tarot', icon: '🃏', label: 'Tarot', accent: 'rgba(168,85,247,0.15)', accentBorder: 'rgba(168,85,247,0.25)' },
  { id: 'energy', icon: '⚡', label: 'Énergie', accent: 'rgba(251,191,36,0.15)', accentBorder: 'rgba(251,191,36,0.25)' },
  { id: 'intention', icon: '✦', label: 'Intention', accent: 'rgba(96,165,250,0.15)', accentBorder: 'rgba(96,165,250,0.25)' },
  { id: 'ritual', icon: '🌙', label: 'Rituel soir', accent: 'rgba(192,132,252,0.15)', accentBorder: 'rgba(192,132,252,0.25)' },
] as const;

export function QuickAccessBar() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(`home-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Petit flash pour attirer l'œil sur la section ciblée
      el.style.transition = 'box-shadow 0.3s';
      el.style.boxShadow = '0 0 0 2px rgba(251,191,36,0.3)';
      setTimeout(() => { el.style.boxShadow = ''; }, 1200);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2 mb-5">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl glass border transition-all active:scale-95 hover:border-gold-500/30"
          style={{ background: item.accent, borderColor: item.accentBorder }}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-[9px] text-night-300 font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}