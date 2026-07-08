interface NavProps {
  items: string[];
  labels: Record<string, string>;
  active: string;
  onNavigate: (s: any) => void;
}

const ICONS: Record<string, string> = {
  home: 'M3 12L12 3l9 9M5 10v10h4v-6h6v6h4V10',
  horoscope: 'M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z',
  compatibility: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  journal: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  settings: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
};

export function BottomNav({ items, labels, active, onNavigate }: NavProps) {
  return (
    <div className="glass-dark border-t border-night-700/50 px-2 py-2 safe-area-bottom">
      <div className="flex justify-around items-center">
        {items.map(item => {
          const isActive = active === item;
          return (
            <button
              key={item}
              onClick={() => onNavigate(item)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 transition-all"
            >
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={isActive ? '#fbbf24' : '#757bc4'}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className={isActive ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' : ''}
              >
                <path d={ICONS[item]} />
              </svg>
              <span className={`text-[10px] font-medium ${isActive ? 'text-gold-400' : 'text-night-400'}`}>
                {labels[item]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
