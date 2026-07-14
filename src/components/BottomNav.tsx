interface NavProps {
  items: string[];
  labels: Record<string, string>;
  active: string;
  onNavigate: (s: string) => void;
}

// ─── Alchemical / astrological glyph icons ───────────────
function NavIcon({ item, active }: { item: string; active: boolean }) {
  const stroke = active ? '#e2c47c' : '#6a6a6a';
  const sw = active ? 1.6 : 1.3;
  const common = { fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (item) {
    case 'home':
      // Radiant sun (☉) — the centre, the self
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="4.2" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 10} y2={12 + Math.sin(a) * 10} />;
          })}
        </svg>
      );
    case 'horoscope':
      // Pentagram in circle — divination
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9.4" />
          <polygon points="12,3.5 14.4,15.3 4.6,8.3 19.4,8.3 9.6,15.3" strokeWidth={sw * 0.85} />
        </svg>
      );
    case 'compatibility':
      // Two interlocked rings — union
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <circle cx="8.8" cy="12" r="5" />
          <circle cx="15.2" cy="12" r="5" />
        </svg>
      );
    case 'journal':
      // Open grimoire / book
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <path d="M12 6c-1.6-1.2-3.8-2-6-2-1.2 0-2 .2-2 .2v13s.8-.2 2-.2c2.2 0 4.4.8 6 2" />
          <path d="M12 6c1.6-1.2 3.8-2 6-2 1.2 0 2 .2 2 .2v13s-.8-.2-2-.2c-2.2 0-4.4.8-6 2" />
          <line x1="12" y1="6" x2="12" y2="19" />
        </svg>
      );
    case 'explorer':
      // Compass / astrolabe — exploration
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9.5" />
          <polygon points="12,5 14,12 12,19 10,12" strokeWidth={sw * 0.7} />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );
    case 'settings':
      // Hexagram / six-pointed star (Seal) — order & structure
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <polygon points="12,2 7.2,10.5 16.8,10.5" />
          <polygon points="12,22 7.2,13.5 16.8,13.5" />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

export function BottomNav({ items, labels, active, onNavigate }: NavProps) {
  const handleNav = (item: string) => {
    // Haptic feedback (mobile only, silent on desktop)
    if ('vibrate' in navigator) {
      navigator.vibrate(item === active ? 8 : 12);
    }
    onNavigate(item);
  };

  return (
    <div className="glass-dark border-t border-gold-500/10 px-2 py-2 safe-area-bottom relative">
      <div className="flex justify-around items-center">
        {items.map(item => {
          const isActive = active === item;
          return (
            <button
              key={item}
              onClick={() => handleNav(item)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 transition-all duration-300 active:scale-90"
            >
              <div className={`relative transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {/* Gold glow background on active */}
                {isActive && (
                  <div className="absolute inset-0 -m-2 rounded-full bg-gold-500/15 animate-glow" />
                )}
                {/* Active dot indicator above icon */}
                {isActive && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold-400 animate-fade-in" />
                )}
                <div className={`relative transition-all duration-300 ${isActive ? 'drop-shadow-[0_0_7px_rgba(197,160,89,0.55)]' : ''}`}>
                  <NavIcon item={item} active={isActive} />
                </div>
              </div>
              <span className={`text-[10px] font-medium tracking-wide transition-all duration-300 ${isActive ? 'text-gold-400 font-display' : 'text-night-500'}`}>
                {labels[item]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
