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

function makeHeroTitle(aspect: Aspect | { transitPlanetFr: string; natalPlanetFr: string; aspectFr: string }): string {
  const t = aspect.transitPlanetFr || '';
  // Format court et stable : "{planète en transit}" — pas de phrase tronquée
  if (t) return `${t} en transit`;
  return "Le ciel t'écoute";
}

/**
 * Subtitle = contenu qui APPORTE une valeur, sans répéter le titre.
 * Règles :
 *   - ne jamais reprendre la première phrase (c'est déjà le titre)
 *   - si la 2e phrase existe et est assez longue → on l'utilise
 *   - sinon : phrase d'action contextualisée via buildFallbackAdvice()
 */
function makeHeroSubtitle(
  interpretation: string,
  ctx: { nature: 'tension' | 'harmonique' | 'neutre'; transitFr: string; natalFr: string; aspectFr: string; houseTheme?: string | null },
): string {
  const sentences = (interpretation || '')
    .split(/[.!?]/)
    .map(s => s.trim())
    .filter(Boolean);

  // Stratégie 1 : prendre la 2e phrase (la 1ère est devenue le titre)
  if (sentences.length >= 2 && sentences[1].length >= 40) {
    return capitalize(sentences[1]);
  }

  // Stratégie 2 : la 3e, 4e… jusqu'à en trouver une longue
  for (let i = 2; i < sentences.length; i++) {
    if (sentences[i].length >= 50) return capitalize(sentences[i]);
  }

  // Stratégie 3 : fallback intelligent contextualisé
  return buildFallbackAdvice(ctx);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Génère un conseil actionnable quand l'interprétation backend est trop courte.
 * Ton : coach bienveillant, 2e personne, signal temporel.
 */
function buildFallbackAdvice(ctx: {
  nature: 'tension' | 'harmonique' | 'neutre';
  transitFr: string;
  natalFr: string;
  aspectFr: string;
  houseTheme?: string | null;
}): string {
  const theme = ctx.houseTheme ? ` dans ${ctx.houseTheme.toLowerCase()}` : '';
  if (ctx.nature === 'tension') {
    return `Tu peux ralentir${theme} et observer ce qui te frictionne — c'est souvent là que ${ctx.transitFr} réveille quelque chose en toi.`;
  }
  if (ctx.nature === 'harmonique') {
    return `Aujourd'hui, ${ctx.transitFr} ${ctx.aspectFr} ${ctx.natalFr}${theme} : profite de cette fenêtre pour avancer sur ce qui te tient à cœur.`;
  }
  // neutre
  return `${ctx.transitFr} ${ctx.aspectFr} ${ctx.natalFr}${theme} — un climat intérieur à écouter, sans forcer ni résister.`;
}

type CardData =
  | { kind: 'transit'; aspect: Aspect; house: HouseData | null }
  | { kind: 'house'; house: HouseData };

export default function TransitFeed({
  transits,
  houses,
  onClose,
  inline = false,
}: {
  transits: TransitsData;
  houses: HouseData[];
  onClose: () => void;
  inline?: boolean;
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
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll vers la carte (utilisé par les flèches et les dots)
  const scrollToCard = (idx: number) => {
    const el = cardsRef.current[idx];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setActiveIndex(idx);
    }
  };

  // Lock body scroll (uniquement en mode modal)
  useEffect(() => {
    if (inline) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [inline]);

  // Sync activeIndex avec le scroll natif (quand l'user swipe à la main)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        // Trouve la carte la plus proche du centre du container
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        let closestIdx = 0;
        let closestDist = Infinity;
        cardsRef.current.forEach((el, idx) => {
          if (!el) return;
          const r = el.getBoundingClientRect();
          const cardCenterX = r.left + r.width / 2;
          const dist = Math.abs(cardCenterX - centerX);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = idx;
          }
        });
        setActiveIndex(closestIdx);
      }, 100);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') scrollToCard(Math.min(activeIndex + 1, cards.length - 1));
      if (e.key === 'ArrowLeft') scrollToCard(Math.max(activeIndex - 1, 0));
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
    <div className={inline ? 'relative w-full h-[640px] sm:h-[680px] overflow-hidden rounded-2xl bg-celeste-bg border border-cosmic-500/20' : 'fixed inset-0 z-[9999] bg-celeste-bg overflow-hidden'}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-12 pb-3 flex items-center justify-between bg-gradient-to-b from-celeste-bg via-celeste-bg/95 to-transparent">
        {inline ? (
          <button
            onClick={() => {
              // En mode inline : scroll vers la section Transits du jour (sommaire) ou haut de la page
              const target = document.getElementById('transits-section-top');
              if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-celeste-text/70 text-sm flex items-center gap-1"
          >
            <span className="text-lg">‹</span> Haut
          </button>
        ) : (
          <button onClick={onClose} className="text-celeste-text/70 text-sm flex items-center gap-1">
            <span className="text-lg">‹</span> Retour
          </button>
        )}
        <p className="text-celeste-text/60 text-xs capitalize">{dateFormatted}</p>
        <div className="w-12" />
      </div>

      {/* Cards container — scroll-snap horizontal CSS natif, pas de transform JS */}
      <div
        ref={containerRef}
        className="absolute inset-0 pt-28 pb-20 overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="flex items-center px-[calc(50vw-140px)] py-4" style={{ gap: 0 }}>
          {cards.map((card, idx) => {
            const isOrphanSection = idx === orphanStartIndex && orphanHouses.length > 0;
            const isActive = idx === activeIndex;

            return (
              <div
                key={idx}
                ref={el => { cardsRef.current[idx] = el; }}
                className="snap-center flex-shrink-0 flex items-center justify-center"
                style={{
                  width: '280px',
                  marginRight: idx < cards.length - 1 ? '20px' : '0',
                  opacity: isActive ? 1 : 0.4,
                  transition: 'opacity 0.3s',
                }}
              >
                {isOrphanSection && isActive && (
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
              onClick={() => scrollToCard(idx)}
              aria-label={`Carte ${idx + 1}`}
              className={`transition-colors duration-200 ease-out rounded-full ${
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

      {/* Flèches ← → cliquables (gauche/droite) */}
      <button
        onClick={() => scrollToCard(Math.max(activeIndex - 1, 0))}
        disabled={activeIndex === 0}
        aria-label="Carte précédente"
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full glass border border-cosmic-500/40 backdrop-blur-md flex items-center justify-center transition-colors duration-200 ease-out active:scale-90 ${
          activeIndex === 0 ? 'opacity-20' : 'opacity-80 hover:opacity-100 hover:border-cosmic-500/70'
        }`}
      >
        <span className="text-2xl text-celeste-text/90">‹</span>
      </button>
      <button
        onClick={() => scrollToCard(Math.min(activeIndex + 1, cards.length - 1))}
        disabled={activeIndex === cards.length - 1}
        aria-label="Carte suivante"
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full glass border border-cosmic-500/40 backdrop-blur-md flex items-center justify-center transition-colors duration-200 ease-out active:scale-90 ${
          activeIndex === cards.length - 1 ? 'opacity-20' : 'opacity-80 hover:opacity-100 hover:border-cosmic-500/70'
        }`}
      >
        <span className="text-2xl text-celeste-text/90">›</span>
      </button>

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

  // Détection : le contenu du bloc scrollable dépasse-t-il la zone visible ?
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const updateScrollIndicator = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canDown = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    setCanScrollDown(canDown);
  };
  useEffect(() => {
    updateScrollIndicator();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollIndicator);
    window.addEventListener('resize', updateScrollIndicator);
    return () => {
      el.removeEventListener('scroll', updateScrollIndicator);
      window.removeEventListener('resize', updateScrollIndicator);
    };
  }, [aspect.interpretation, aspect.conseil, house?.theme]);

  return (
    <div className="relative w-full h-[460px] max-h-[64vh] rounded-2xl overflow-hidden celeste-card animate-fade-in shadow-2xl">
      {/* Image de fond (si dispo) ou fallback gradient */}
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        >
          {/* Overlay sombre intermédiaire — laisse respirer l'image mais assure le contraste */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-celeste-bg/85" />
        </div>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient}`}>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-cosmic-500/20 animate-glow blur-2xl" />
            <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-cosmic-500/20 animate-glow blur-2xl" style={{ animationDelay: '1.5s' }} />
          </div>
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col p-4">
        {/* Fade indicator — fixé en bas de la zone scrollable (overlay) */}
        {canScrollDown && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 bottom-[68px] h-8 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-20 flex items-end justify-center pb-1"
          >
            <span className="text-cosmic-300 text-[10px] animate-pulse">↓</span>
          </div>
        )}
        {/* Bloc scrollable — tout sauf les actions */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef} style={{scrollbarWidth: 'none'}}>
          {/* Top: glyphs + EXACT + counter */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-2xl">
              <span title={aspect.transitPlanetFr} className="animate-glow drop-shadow-lg">{aspect.transitGlyph}</span>
              {aspect.transitRetrograde && <span className="text-xs text-amber-400 font-mono self-start">℞</span>}
              <span className={`text-xl ${style.text} drop-shadow-lg`}>{aspect.aspectGlyph}</span>
              <span title={aspect.natalPlanetFr} className="drop-shadow-lg">{aspect.natalGlyph}</span>
            </div>
            {aspect.exact && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gold-500/40 text-gold-100 font-bold border border-gold-500/50 backdrop-blur-sm">
                ACTIF
              </span>
            )}
          </div>

          {/* Hero emoji */}
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full glass-gold flex items-center justify-center animate-glow backdrop-blur-sm">
              <span className="text-2xl">{style.emoji}</span>
            </div>
          </div>

          {/* Nature badge */}
          <div className="flex justify-center mb-1.5">
            <span className={`text-[9px] px-2 py-0.5 rounded-full bg-celeste-bg/50 ${style.text} font-semibold uppercase tracking-wider border ${style.border} backdrop-blur-sm`}>
              {style.emoji} {style.label}
            </span>
          </div>

          {/* Title — texte or vif avec text-shadow fort pour ressortir sur l'image */}
          <h3
            className="text-2xl font-extrabold text-center mb-2 leading-tight px-1"
            style={{
              color: '#ffd700',
              textShadow: '0 2px 12px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,1)',
            }}
          >
            {makeHeroTitle(aspect)}
          </h3>

          {/* Subtitle — texte blanc pur avec text-shadow */}
          <p
            className="text-[13px] text-center mb-2 leading-snug px-2 font-semibold"
            style={{
              color: '#ffffff',
              textShadow: '0 1px 8px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1)',
            }}
          >
            {makeHeroSubtitle(aspect.interpretation, {
              nature: aspect.nature,
              transitFr: aspect.transitPlanetFr,
              natalFr: aspect.natalPlanetFr,
              aspectFr: aspect.aspectFr,
              houseTheme: house?.theme ?? null,
            })}
          </p>

          {/* Divider */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
            <span className="text-cosmic-400 text-[10px]">★</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
          </div>

          {/* Conseil */}
          {aspect.conseil && (
            <div className="rounded-lg bg-celeste-bg/40 border border-cosmic-500/30 p-2 mb-2 backdrop-blur-sm">
              <p className="text-[11px] text-celeste-text/90 flex items-start gap-1.5">
                <span className="not-italic text-sm flex-shrink-0">💡</span>
                <span className="italic line-clamp-3">{aspect.conseil}</span>
              </p>
            </div>
          )}

          {/* Maison (petite ligne) */}
          {house && (
            <div className="rounded-lg bg-celeste-bg/40 border border-celeste-primary/25 p-1.5 mb-2 backdrop-blur-sm">
              <p className="text-[11px] text-celeste-text/80 flex items-center gap-1.5">
                <span>{house.icon}</span>
                <span className="font-semibold">Maison {house.num}</span>
                <span className="text-celeste-text/60 truncate">— {house.theme}</span>
              </p>
            </div>
          )}
        </div>

        {/* Actions Tinder-like : SAVE (gauche) | SHARE (centre) | SKIP (droite) */}
        <div className="flex items-center justify-around gap-2">
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`w-11 h-11 rounded-full glass border-2 ${isSaved ? 'border-emerald-500/50 opacity-50' : 'border-emerald-500/60 hover:border-emerald-400'} flex items-center justify-center transition-colors duration-200 ease-out active:scale-90`}
            aria-label="Sauvegarder (swipe droite long)"
          >
            <span className="text-lg">{isSaved ? '✓' : '⭐'}</span>
          </button>
          <button
            onClick={onShare}
            className="w-13 h-13 rounded-full bg-gradient-to-br from-cosmic-500 to-cosmic-700 flex items-center justify-center transition-colors duration-200 ease-out active:scale-90 shadow-lg shadow-cosmic-900/60"
            style={{width: '52px', height: '52px'}}
            aria-label="Partager (swipe haut)"
          >
            <span className="text-2xl">📤</span>
          </button>
          <button
            onClick={onSkip}
            className="w-11 h-11 rounded-full glass border-2 border-rose-500/60 hover:border-rose-400 flex items-center justify-center transition-colors duration-200 ease-out active:scale-90"
            aria-label="Passer (swipe gauche long)"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>
        <div className="flex items-center justify-around text-[8px] text-celeste-text/40 uppercase tracking-wider mt-1">
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
    <div className="relative w-full h-[460px] max-h-[64vh] rounded-2xl overflow-hidden celeste-card animate-fade-in shadow-2xl">
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

      <div className="relative z-10 h-full flex flex-col p-4">
        {/* Bloc scrollable : tout sauf le bouton Partager */}
        <div className="flex-1 overflow-y-auto" style={{scrollbarWidth: 'none'}}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-2xl">
              <span className="animate-glow drop-shadow-lg">{house.icon}</span>
            </div>
          </div>

          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full glass-gold flex items-center justify-center animate-glow backdrop-blur-sm">
              <span className="text-2xl">🏠</span>
            </div>
          </div>

          <div className="flex justify-center mb-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-celeste-bg/50 text-cosmic-300 font-semibold uppercase tracking-wider border border-cosmic-500/30 backdrop-blur-sm">
              Secteur de vie
            </span>
          </div>

          <h3 className="text-xl font-bold text-center mb-1 text-cosmic-gradient leading-tight drop-shadow-lg">
            Maison {house.num}
          </h3>
          <p className="text-sm text-celeste-text/90 text-center mb-2 drop-shadow">
            {house.theme}
          </p>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
            <span className="text-cosmic-400 text-[10px]">★</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cosmic-500/40 to-transparent" />
          </div>

          {house.transitPlanets.length > 0 && (
            <div className="rounded-lg bg-celeste-bg/40 border border-gold-500/30 p-2 mb-2 backdrop-blur-sm">
              <p className="text-[9px] text-celeste-text/60 uppercase tracking-wider mb-1">Planètes en transit</p>
              <div className="flex flex-wrap gap-1">
                {house.transitPlanets.map(tp => (
                  <span key={tp.key} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-100 border border-gold-500/30">
                    {tp.glyph} {tp.name}{tp.retrograde ? ' ℞' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {house.insight && (
            <div className="rounded-lg bg-celeste-bg/40 border border-cosmic-500/30 p-2 mb-2 backdrop-blur-sm">
              <p className="text-[11px] text-celeste-text/90 flex items-start gap-1.5">
                <span className="not-italic text-sm flex-shrink-0">💫</span>
                <span className="italic">{house.insight}</span>
              </p>
            </div>
          )}

          {house.action && (
            <div className="rounded-lg bg-celeste-bg/40 border border-emerald-500/30 p-2 backdrop-blur-sm">
              <p className="text-[11px] text-celeste-text/90 flex items-start gap-1.5">
                <span className="not-italic text-sm flex-shrink-0">→</span>
                <span className="italic">{house.action}</span>
              </p>
            </div>
          )}
        </div>

        {/* Bouton Partager fixe en bas */}
        <button
          onClick={onShare}
          className="w-12 h-12 mx-auto mt-2 rounded-full bg-gradient-to-br from-cosmic-500 to-cosmic-700 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ease-out active:scale-90 shadow-lg shadow-cosmic-900/60"
          aria-label="Partager (swipe haut)"
        >
          <span className="text-xl">📤</span>
        </button>
        <p className="text-[8px] text-celeste-text/40 uppercase tracking-wider text-center mt-1 flex-shrink-0">
          Partager
        </p>
      </div>
    </div>
  );
}
