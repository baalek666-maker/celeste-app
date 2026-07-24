import { useState, useEffect, useRef } from 'react';
import { toast } from './Toast';
import TransitShare from './TransitShare';
import { getTransitImage, getHouseImage } from '../lib/transitImages';

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

const NATURE_STYLE: Record<string, { bg: string; border: string; text: string; label: string; emoji: string; gradient: string }> = {
  tension:    { bg: 'from-rose-500/15 to-orange-500/10',    border: 'border-rose-500/30',    text: 'text-rose-300',    label: 'Défi',      emoji: '⚡', gradient: 'from-rose-500/40 to-orange-500/30' },
  harmonique: { bg: 'from-emerald-500/15 to-teal-500/10',   border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Flow',      emoji: '✨', gradient: 'from-emerald-500/40 to-teal-500/30' },
  neutre:     { bg: 'from-violet-500/15 to-indigo-500/10',   border: 'border-violet-500/30',  text: 'text-violet-300',  label: 'Activation',emoji: '🌑', gradient: 'from-violet-500/40 to-indigo-500/30' },
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
  if (!interpretation) return "Le ciel t'écoute";
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

  const transitCards: CardData[] = sortedAspects.map(a => ({
    kind: 'transit' as const, aspect: a, house: findMatchingHouse(a, houses),
  }));
  const usedHouseNums = new Set(transitCards.filter(c => c.kind === 'transit' && c.house).map(c => (c as any).house.num));
  const orphanHouses = (houses || []).filter(h => h.activated && !usedHouseNums.has(h.num));

  const cards: CardData[] = [...transitCards, ...orphanHouses.map(h => ({ kind: 'house' as const, house: h }))];

  const [activeIndex, setActiveIndex] = useState(0);
  const [shareForCard, setShareForCard] = useState<CardData | null>(null);
  const [savedAspects, setSavedAspects] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [swipeDx, setSwipeDx] = useState(0);
  const [swipeDy, setSwipeDy] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Swipe horizontal handlers (Tinder-like)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      setIsDragging(true);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      setSwipeDx(dx);
      setSwipeDy(dy);
    };
    const onTouchEnd = () => {
      if (startX.current === null) return;
      const dx = swipeDx;
      const dy = swipeDy;
      startX.current = null;
      startY.current = null;
      setIsDragging(false);
      setSwipeDx(0);
      setSwipeDy(0);

      // Swipe horizontal prioritaire (Tinder-like)
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -80 && activeIndex < cards.length - 1) {
          setActiveIndex(i => i + 1); // swipe gauche = suivant
        } else if (dx > 80 && activeIndex > 0) {
          setActiveIndex(i => i - 1); // swipe droite = précédent
        } else if (dx < -180) {
          // long swipe gauche = skip
          handleSkip();
        } else if (dx > 180) {
          // long swipe droite = save
          handleSave();
        }
      } else {
        // Swipe vertical (haut = share)
        if (dy < -120) {
          setShareForCard(cards[activeIndex]);
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeIndex, cards, swipeDx, swipeDy]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && activeIndex < cards.length - 1) setActiveIndex(i => i + 1);
      if (e.key === 'ArrowLeft' && activeIndex > 0) setActiveIndex(i => i - 1);
      if (e.key === 'ArrowUp') setShareForCard(cards[activeIndex]);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, cards, onClose]);

  const dateFormatted = new Date(transits.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const handleSave = () => {
    const card = cards[activeIndex];
    if (card.kind !== 'transit') {
      toast.info('Sauvegarde dispo pour les transits uniquement ✨');
      return;
    }
    const key = `${card.aspect.transitPlanet}-${card.aspect.aspect}-${card.aspect.natalPlanet}`;
    if (savedAspects.has(key)) {
      toast.info('Déjà sauvegardé ⭐');
      return;
    }
    setSavedAspects(prev => new Set([...prev, key]));
    // TODO: persist to localStorage / API
    try {
      const saved = JSON.parse(localStorage.getItem('celeste_saved_transits') || '[]');
      saved.push({ key, date: transits.date, ...card.aspect });
      localStorage.setItem('celeste_saved_transits', JSON.stringify(saved));
      toast.success('Sauvé dans ton journal ⭐');
    } catch {
      toast.success('Sauvé ⭐');
    }
  };

  const handleSkip = () => {
    if (activeIndex < cards.length - 1) {
      setActiveIndex(i => i + 1);
    } else {
      onClose();
    }
  };

  const orphanStartIndex = transitCards.length;

  return (
    <div className="fixed inset-0 z-[9999] bg-celeste-bg overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-12 pb-3 flex items-center justify-between bg-gradient-to-b from-celeste-bg via-celeste-bg/95 to-transparent">
        <button onClick={onClose} className="text-celeste-text/70 text-sm flex items-center gap-1">
          <span className="text-lg">‹</span> Retour
        </button>
        <p className="text-celeste-text/60 text-xs capitalize">{dateFormatted}</p>
        <div className="w-12" />
      </div>

      {/* Cards container (snap-x horizontal, Tinder-like) */}
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center pt-24 pb-32 overflow-hidden"
      >
        <div
          className="relative w-full h-full"
          style={{
            transform: `translateX(${-activeIndex * 100}%) translateX(${swipeDx}px)`,
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {cards.map((card, idx) => {
            const isOrphanSection = idx === orphanStartIndex && orphanHouses.length > 0;
            const offset = idx - activeIndex;
            // Calcul de l'opacité et scale pour effet 3D
            const opacity = Math.max(0.4, 1 - Math.abs(offset) * 0.3);
            const scale = Math.max(0.85, 1 - Math.abs(offset) * 0.05);
            const rotate = swipeDx * 0.02; // léger rotate跟随 le drag

            return (
              <div
                key={idx}
                className="absolute top-0 left-0 w-full h-full flex items-center justify-center px-5"
                style={{
                  transform: `translateX(${offset * 100}%) scale(${scale}) rotate(${offset === 0 ? rotate : 0}deg)`,
                  opacity,
                  transition: isDragging && offset === 0 ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s',
                  pointerEvents: offset === 0 ? 'auto' : 'none',
                }}
              >
                {isOrphanSection && (
                  <div className="absolute top-20 left-0 right-0 flex items-center gap-3 px-8 z-10">
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
                    isSaved={savedAspects.has(`${card.aspect.transitPlanet}-${card.aspect.aspect}-${card.aspect.natalPlanet}`)}
                    onShare={() => setShareForCard(card)}
                    onSave={handleSave}
                    onSkip={handleSkip}
                  />
                ) : (
                  <HouseCard
                    house={card.house}
                    onShare={() => setShareForCard(card)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination dots (bottom) */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-3">
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

      {/* Swipe hint (1ère fois) */}
      {activeIndex === 0 && (
        <div className="absolute bottom-24 left-0 right-0 z-10 flex items-center justify-center gap-2 text-celeste-text/40 text-[10px] uppercase tracking-wider pointer-events-none">
          <span>←</span>
          <span>swipe</span>
          <span>→</span>
        </div>
      )}

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
  aspect, house, isSaved, onShare, onSave, onSkip,
}: {
  aspect: Aspect;
  house: HouseData | null;
  isSaved: boolean;
  onShare: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const style = NATURE_STYLE[aspect.nature] || NATURE_STYLE.neutre;
  const imageUrl = getTransitImage(aspect.transitPlanet, aspect.nature);

  return (
    <div className="relative w-full max-w-sm h-[600px] max-h-[80vh] rounded-3xl overflow-hidden celeste-card animate-fade-in shadow-2xl">
      {/* Image de fond (si dispo) ou fallback gradient */}
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-celeste-bg/40 via-celeste-bg/60 to-celeste-bg/90" />
        </div>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient}`}>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-cosmic-500/20 animate-glow blur-2xl" />
            <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-cosmic-500/20 animate-glow blur-2xl" style={{ animationDelay: '1.5s' }} />
          </div>
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col p-6">
        {/* Top: glyphs + EXACT + counter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-3xl">
            <span title={aspect.transitPlanetFr} className="animate-glow drop-shadow-lg">{aspect.transitGlyph}</span>
            {aspect.transitRetrograde && <span className="text-xs text-amber-400 font-mono self-start">℞</span>}
            <span className={`text-2xl ${style.text} drop-shadow-lg`}>{aspect.aspectGlyph}</span>
            <span title={aspect.natalPlanetFr} className="drop-shadow-lg">{aspect.natalGlyph}</span>
          </div>
          {aspect.exact && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/40 text-gold-100 font-bold border border-gold-500/50 backdrop-blur-sm">
              EXACT
            </span>
          )}
        </div>

        {/* Hero emoji */}
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-full glass-gold flex items-center justify-center animate-glow backdrop-blur-sm">
            <span className="text-3xl">{style.emoji}</span>
          </div>
        </div>

        {/* Nature badge */}
        <div className="flex justify-center mb-2">
          <span className={`text-[10px] px-2.5 py-1 rounded-full bg-celeste-bg/50 ${style.text} font-semibold uppercase tracking-wider border ${style.border} backdrop-blur-sm`}>
            {style.emoji} {style.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-center mb-2 text-cosmic-gradient leading-tight drop-shadow-lg">
          {makeHeroTitle(aspect.interpretation)}
        </h3>

        {/* Subtitle */}
        <p className="text-sm text-celeste-text/90 text-center mb-3 leading-relaxed px-1 drop-shadow">
          {makeHeroSubtitle(aspect.interpretation)}
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
          <span className="text-cosmic-400 text-xs">★</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
        </div>

        {/* Conseil */}
        {aspect.conseil && (
          <div className="rounded-xl bg-celeste-bg/40 border border-cosmic-500/30 p-2.5 mb-2 backdrop-blur-sm">
            <p className="text-xs text-celeste-text/90 flex items-start gap-2">
              <span className="not-italic text-base flex-shrink-0">💡</span>
              <span className="italic">{aspect.conseil}</span>
            </p>
          </div>
        )}

        {/* Maison (petite ligne) */}
        {house && (
          <div className="rounded-xl bg-celeste-bg/40 border border-celeste-primary/25 p-2 mb-3 backdrop-blur-sm">
            <p className="text-xs text-celeste-text/80 flex items-center gap-2">
              <span className="text-base">{house.icon}</span>
              <span className="font-semibold">Maison {house.num}</span>
              <span className="text-celeste-text/60">— {house.theme}</span>
            </p>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions Tinder-like : SAVE (gauche) | SHARE (centre) | SKIP (droite) */}
        <div className="flex items-center justify-around gap-3 mb-2">
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`w-12 h-12 rounded-full glass border-2 ${isSaved ? 'border-emerald-500/50 opacity-50' : 'border-emerald-500/60 hover:border-emerald-400'} flex items-center justify-center transition-all active:scale-90`}
            aria-label="Sauvegarder (swipe droite long)"
          >
            <span className="text-xl">{isSaved ? '✓' : '⭐'}</span>
          </button>
          <button
            onClick={onShare}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-cosmic-500 to-cosmic-700 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-cosmic-900/60"
            aria-label="Partager (swipe haut)"
          >
            <span className="text-2xl">📤</span>
          </button>
          <button
            onClick={onSkip}
            className="w-12 h-12 rounded-full glass border-2 border-rose-500/60 hover:border-rose-400 flex items-center justify-center transition-all active:scale-90"
            aria-label="Passer (swipe gauche long)"
          >
            <span className="text-xl">✕</span>
          </button>
        </div>
        <div className="flex items-center justify-around text-[9px] text-celeste-text/40 uppercase tracking-wider">
          <span>Sauver</span>
          <span>Partager</span>
          <span>Passer</span>
        </div>
      </div>
    </div>
  );
}

function HouseCard({
  house, onShare,
}: { house: HouseData; onShare: () => void }) {
  const imageUrl = getHouseImage(house.transitPlanets, 'neutre');

  return (
    <div className="relative w-full max-w-sm h-[600px] max-h-[80vh] rounded-3xl overflow-hidden celeste-card animate-fade-in shadow-2xl">
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-celeste-bg/40 via-celeste-bg/60 to-celeste-bg/90" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-cosmic-500/30 to-celeste-primary/20">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-cosmic-500/20 animate-glow blur-2xl" />
          </div>
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-3xl">
            <span className="animate-glow drop-shadow-lg">{house.icon}</span>
          </div>
        </div>

        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-full glass-gold flex items-center justify-center animate-glow backdrop-blur-sm">
            <span className="text-3xl">🏠</span>
          </div>
        </div>

        <div className="flex justify-center mb-2">
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-celeste-bg/50 text-cosmic-300 font-semibold uppercase tracking-wider border border-cosmic-500/30 backdrop-blur-sm">
            Secteur de vie
          </span>
        </div>

        <h3 className="text-2xl font-bold text-center mb-2 text-cosmic-gradient leading-tight drop-shadow-lg">
          Maison {house.num}
        </h3>
        <p className="text-base text-celeste-text/90 text-center mb-3 drop-shadow">
          {house.theme}
        </p>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
          <span className="text-cosmic-400 text-xs">★</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
        </div>

        {house.transitPlanets.length > 0 && (
          <div className="rounded-xl bg-celeste-bg/40 border border-gold-500/30 p-2.5 mb-2 backdrop-blur-sm">
            <p className="text-[10px] text-celeste-text/60 uppercase tracking-wider mb-1.5">Planètes en transit</p>
            <div className="flex flex-wrap gap-1.5">
              {house.transitPlanets.map(tp => (
                <span key={tp.key} className="text-xs px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-100 border border-gold-500/30">
                  {tp.glyph} {tp.name}{tp.retrograde ? ' ℞' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {house.insight && (
          <div className="rounded-xl bg-celeste-bg/40 border border-cosmic-500/30 p-2.5 mb-2 backdrop-blur-sm">
            <p className="text-xs text-celeste-text/90 flex items-start gap-2">
              <span className="not-italic text-base flex-shrink-0">💫</span>
              <span className="italic">{house.insight}</span>
            </p>
          </div>
        )}

        {house.action && (
          <div className="rounded-xl bg-celeste-bg/40 border border-emerald-500/30 p-2.5 mb-3 backdrop-blur-sm">
            <p className="text-xs text-celeste-text/90 flex items-start gap-2">
              <span className="not-italic text-base flex-shrink-0">→</span>
              <span className="italic">{house.action}</span>
            </p>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={onShare}
          className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-cosmic-500 to-cosmic-700 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-cosmic-900/60"
          aria-label="Partager (swipe haut)"
        >
          <span className="text-2xl">📤</span>
        </button>
        <p className="text-[9px] text-celeste-text/40 uppercase tracking-wider text-center mt-2">
          Partager
        </p>
      </div>
    </div>
  );
}
