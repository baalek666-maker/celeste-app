import { useState, useEffect, useRef } from 'react';
import TransitShare from './TransitShare';

type Aspect = {
  transitPlanet: string;
  natalPlanet: string;
  transitPlanetFr: string;
  natalPlanetFr: string;
  transitGlyph: string;
  natalGlyph: string;
  aspect: string;
  aspectFr: string;
  aspectGlyph: string;
  nature: 'tension' | 'harmonique' | 'neutre';
  orb: number;
  exact: boolean;
  transitRetrograde: boolean;
  interpretation: string;
  conseil: string;
};

type HouseData = {
  num: number;
  theme: string;
  icon: string;
  short: string;
  sign: string;
  activated: boolean;
  natalPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean }>;
  transitPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean }>;
  insight: string;
  action: string;
};

type TransitsData = {
  date: string;
  headline: string;
  flowScore: number;
  challengeScore: number;
  aspects: Aspect[];
};

const NATURE_STYLE: Record<string, { bg: string; border: string; text: string; label: string; emoji: string }> = {
  tension:    { bg: 'from-rose-500/15 to-orange-500/10',    border: 'border-rose-500/30',    text: 'text-rose-300',    label: 'Défi',      emoji: '⚡' },
  harmonique: { bg: 'from-emerald-500/15 to-teal-500/10',   border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Flow',      emoji: '✨' },
  neutre:     { bg: 'from-violet-500/15 to-indigo-500/10',   border: 'border-violet-500/30',  text: 'text-violet-300',  label: 'Activation',emoji: '🌑' },
};

function findMatchingHouse(aspect: Aspect, houses: HouseData[]): HouseData | null {
  if (!houses || houses.length === 0) return null;
  const planetToHouse: Record<string, string> = {
    'Soleil': 'Soleil', 'Lune': 'Lune', 'Mercure': 'Mercure', 'Vénus': 'Vénus',
    'Mars': 'Mars', 'Jupiter': 'Jupiter', 'Saturne': 'Saturne', 'Uranus': 'Uranus',
    'Neptune': 'Neptune', 'Pluton': 'Pluton',
  };
  const transitKey = planetToHouse[aspect.transitPlanet] || aspect.transitPlanet;
  const natalKey = planetToHouse[aspect.natalPlanet] || aspect.natalPlanet;
  return houses.find(h =>
    h.transitPlanets.some(p => p.name === transitKey) ||
    h.natalPlanets.some(p => p.name === natalKey)
  ) || null;
}

function makeHeroTitle(interpretation: string): string {
  if (!interpretation) return 'Le ciel t\'écoute';
  const firstSentence = interpretation.split(/[,.!?]/)[0]?.trim() || interpretation;
  const words = firstSentence.split(/\s+/);
  if (words.length <= 5) return firstSentence;
  return words.slice(0, 4).join(' ') + '…';
}

function makeHeroSubtitle(interpretation: string): string {
  if (!interpretation) return '';
  const sentences = interpretation.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
  return sentences.sort((a, b) => a.length - b.length)[0] || sentences[0] || '';
}

type CardData =
  | { kind: 'transit'; aspect: Aspect; house: HouseData | null }
  | { kind: 'house'; house: HouseData };

export default function TransitFeed({
  transits,
  houses,
  onClose,
}: {
  transits: TransitsData;
  houses: HouseData[];
  onClose: () => void;
}) {
  // Tri : EXACT d'abord, puis tension, puis harmonique, puis orb
  const sortedAspects = [...transits.aspects].sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    const order = { tension: 0, neutre: 1, harmonique: 2 };
    if (order[a.nature] !== order[b.nature]) return order[a.nature] - order[b.nature];
    return a.orb - b.orb;
  });

  // Construit la liste unifiée : transits en premier, puis maisons orphelines
  const transitCards: CardData[] = sortedAspects.map(a => ({
    kind: 'transit' as const, aspect: a, house: findMatchingHouse(a, houses),
  }));
  const usedHouseNums = new Set(transitCards.filter(c => c.kind === 'transit' && c.house).map(c => (c as any).house.num));
  const orphanHouses = (houses || []).filter(h => h.activated && !usedHouseNums.has(h.num));

  // Feed = transits + orphelines (avec un séparateur "Aussi activé")
  const cards: CardData[] = [...transitCards, ...orphanHouses.map(h => ({ kind: 'house' as const, house: h }))];

  const [activeIndex, setActiveIndex] = useState(0);
  const [shareForCard, setShareForCard] = useState<CardData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  // Swipe handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => { startY.current = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.changedTouches[0].clientY - startY.current;
      startY.current = null;
      // swipe haut (dy < -50) = suivant ; swipe bas (dy > 50) = précédent
      if (dy < -50 && activeIndex < cards.length - 1) {
        setActiveIndex(i => i + 1);
      } else if (dy > 50 && activeIndex > 0) {
        setActiveIndex(i => i - 1);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeIndex, cards.length]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && activeIndex < cards.length - 1) setActiveIndex(i => i + 1);
      if (e.key === 'ArrowUp' && activeIndex > 0) setActiveIndex(i => i - 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, cards.length, onClose]);

  const dateFormatted = new Date(transits.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Trouve l'index de la 1ère maison orpheline pour afficher un séparateur
  const orphanStartIndex = transitCards.length;

  return (
    <div className="fixed inset-0 z-[9999] bg-celeste-bg/95 backdrop-blur-md animate-fade-in">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-12 pb-3 flex items-center justify-between bg-gradient-to-b from-celeste-bg to-transparent">
        <button onClick={onClose} className="text-celeste-text/70 text-sm flex items-center gap-1">
          <span className="text-lg">‹</span> Retour
        </button>
        <p className="text-celeste-text/60 text-xs capitalize">{dateFormatted}</p>
        <div className="w-12" />
      </div>

      {/* Cards container (snap scroll) */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory pt-24 pb-32"
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map((card, idx) => {
          // Séparateur "Aussi activé"
          const isOrphanSection = idx === orphanStartIndex && orphanHouses.length > 0;
          return (
            <div key={idx} className="min-h-[85vh] snap-start flex flex-col items-center justify-center px-5 py-2">
              {isOrphanSection && (
                <div className="w-full max-w-sm flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
                  <span className="text-cosmic-400 text-[10px] uppercase tracking-widest font-semibold">
                    🏠 Aussi activé
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
                </div>
              )}

              {card.kind === 'transit' ? (
                <TransitCard
                  aspect={card.aspect}
                  house={card.house}
                  index={idx}
                  total={cards.length}
                  onShare={() => setShareForCard(card)}
                />
              ) : (
                <HouseCard
                  house={card.house}
                  index={idx}
                  total={cards.length}
                  onShare={() => setShareForCard(card)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination dots (bottom) */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 bg-celeste-bg/70 backdrop-blur-md px-3 py-2 rounded-full">
          {cards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              aria-label={`Carte ${idx + 1}`}
              className={`transition-all rounded-full ${
                idx === activeIndex
                  ? 'w-6 h-1.5 bg-cosmic-400'
                  : 'w-1.5 h-1.5 bg-celeste-text/30'
              }`}
            />
          ))}
        </div>
        <p className="text-celeste-text/50 text-[10px] uppercase tracking-wider">
          {activeIndex + 1} / {cards.length}
        </p>
      </div>

      {/* Share modal */}
      {shareForCard && shareForCard.kind === 'transit' && (
        <TransitShare
          aspect={shareForCard.aspect}
          house={shareForCard.house}
          dateFormatted={dateFormatted}
          onClose={() => setShareForCard(null)}
        />
      )}
      {shareForCard && shareForCard.kind === 'house' && (
        <TransitShare
          house={shareForCard.house}
          dateFormatted={dateFormatted}
          onClose={() => setShareForCard(null)}
        />
      )}
    </div>
  );
}

function TransitCard({
  aspect, house, index, total, onShare,
}: { aspect: Aspect; house: HouseData | null; index: number; total: number; onShare: () => void }) {
  const style = NATURE_STYLE[aspect.nature] || NATURE_STYLE.neutre;
  return (
    <div className="w-full max-w-sm celeste-card overflow-hidden relative animate-fade-in">
      {/* Background tint */}
      <div className={`absolute inset-0 bg-gradient-to-br ${style.bg} pointer-events-none`} />
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-cosmic-500/10 animate-glow blur-2xl" />
      </div>

      <div className="relative z-10">
        {/* Top: glyphs + counter */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-3xl">
            <span title={aspect.transitPlanetFr} className="animate-glow">{aspect.transitGlyph}</span>
            {aspect.transitRetrograde && <span className="text-xs text-amber-400 font-mono self-start">℞</span>}
            <span className={`text-2xl ${style.text}`}>{aspect.aspectGlyph}</span>
            <span title={aspect.natalPlanetFr}>{aspect.natalGlyph}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {aspect.exact && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/30 text-gold-200 font-bold border border-gold-500/40">
                EXACT
              </span>
            )}
            <span className="text-[10px] text-celeste-text/40">{index + 1}/{total}</span>
          </div>
        </div>

        {/* Hero emoji */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full glass-gold flex items-center justify-center animate-glow">
            <span className="text-4xl">{style.emoji}</span>
          </div>
        </div>

        {/* Nature badge */}
        <div className="flex justify-center mb-3">
          <span className={`text-xs px-3 py-1 rounded-full bg-celeste-bg/40 ${style.text} font-semibold uppercase tracking-wider border ${style.border}`}>
            {style.emoji} {style.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-center mb-3 text-cosmic-gradient leading-tight">
          {makeHeroTitle(aspect.interpretation)}
        </h3>

        {/* Subtitle */}
        <p className="text-sm text-celeste-text/85 text-center mb-5 leading-relaxed px-2">
          {makeHeroSubtitle(aspect.interpretation)}
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/30 to-transparent" />
          <span className="text-cosmic-400 text-xs">★</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/30 to-transparent" />
        </div>

        {/* Conseil */}
        {aspect.conseil && (
          <div className="rounded-xl bg-cosmic-500/10 border border-cosmic-500/25 p-3 mb-3">
            <p className="text-sm text-celeste-text/85 flex items-start gap-2">
              <span className="not-italic text-base flex-shrink-0">💡</span>
              <span className="italic">{aspect.conseil}</span>
            </p>
          </div>
        )}

        {/* Maison (petite ligne) */}
        {house && (
          <div className="rounded-xl bg-celeste-bg/30 border border-celeste-primary/15 p-2.5 mb-4">
            <p className="text-xs text-celeste-text/60 flex items-center gap-2">
              <span className="text-base">{house.icon}</span>
              <span className="font-semibold text-celeste-text/80">Maison {house.num}</span>
              <span className="text-celeste-text/50">— {house.theme}</span>
            </p>
          </div>
        )}

        {/* Share button */}
        <button
          onClick={onShare}
          className="w-full py-2.5 rounded-xl glass border border-cosmic-500/30 hover:border-cosmic-500/60 transition-all text-sm font-medium text-celeste-text/80 flex items-center justify-center gap-2"
        >
          <span>📤</span> Partager en story Instagram
        </button>
      </div>
    </div>
  );
}

function HouseCard({
  house, index, total, onShare,
}: { house: HouseData; index: number; total: number; onShare: () => void }) {
  return (
    <div className="w-full max-w-sm celeste-card overflow-hidden relative animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-cosmic-500/15 to-celeste-primary/10 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-3xl">
            <span className="animate-glow">{house.icon}</span>
          </div>
          <span className="text-[10px] text-celeste-text/40">{index + 1}/{total}</span>
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full glass-gold flex items-center justify-center animate-glow">
            <span className="text-4xl">🏠</span>
          </div>
        </div>

        <div className="flex justify-center mb-3">
          <span className="text-xs px-3 py-1 rounded-full bg-celeste-bg/40 text-cosmic-300 font-semibold uppercase tracking-wider border border-cosmic-500/30">
            Secteur de vie
          </span>
        </div>

        <h3 className="text-2xl font-bold text-center mb-2 text-cosmic-gradient leading-tight">
          Maison {house.num}
        </h3>
        <p className="text-base text-celeste-text/85 text-center mb-5">
          {house.theme}
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/30 to-transparent" />
          <span className="text-cosmic-400 text-xs">★</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/30 to-transparent" />
        </div>

        {/* Planètes en transit dans cette maison */}
        {house.transitPlanets.length > 0 && (
          <div className="rounded-xl bg-celeste-bg/30 border border-gold-500/20 p-3 mb-3">
            <p className="text-[10px] text-celeste-text/50 uppercase tracking-wider mb-2">Planètes en transit</p>
            <div className="flex flex-wrap gap-1.5">
              {house.transitPlanets.map(tp => (
                <span key={tp.key} className="text-xs px-2 py-1 rounded-full bg-gold-500/15 text-gold-200 border border-gold-500/20">
                  {tp.glyph} {tp.name}{tp.retrograde ? ' ℞' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {house.insight && (
          <div className="rounded-xl bg-cosmic-500/10 border border-cosmic-500/25 p-3 mb-3">
            <p className="text-sm text-celeste-text/85 flex items-start gap-2">
              <span className="not-italic text-base flex-shrink-0">💫</span>
              <span className="italic">{house.insight}</span>
            </p>
          </div>
        )}

        {house.action && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 mb-4">
            <p className="text-sm text-celeste-text/85 flex items-start gap-2">
              <span className="not-italic text-base flex-shrink-0">→</span>
              <span className="italic">{house.action}</span>
            </p>
          </div>
        )}

        <button
          onClick={onShare}
          className="w-full py-2.5 rounded-xl glass border border-cosmic-500/30 hover:border-cosmic-500/60 transition-all text-sm font-medium text-celeste-text/80 flex items-center justify-center gap-2"
        >
          <span>📤</span> Partager en story Instagram
        </button>
      </div>
    </div>
  );
}
