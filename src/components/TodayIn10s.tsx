/**
 * TodayIn10s — Carrousel horizontal ultra-court (3 slides swipeables).
 *
 * VAL01 — Réduit la friction de consultation quotidienne.
 * L'utilisateur voit l'essentiel en 10 secondes sans scroller.
 *
 * Slides :
 *  1. ☉ Énergie du jour (emoji + label + 1 phrase advice)
 *  2. ☽ Lune (phase + emoji + one-liner)
 *  3. ♀ Transits clés (2-3 planètes dominantes)
 *
 * Source : api.getDailyEnergy() + api.getLunarStatus() + api.getTransitsToday()
 * Auto-slide toutes les 6s, swipe manuel, dots indicators.
 */
import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';

interface Slide {
  key: string;
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  accent: 'gold' | 'moon' | 'cosmic';
}

const ACCENT_STYLES = {
  gold:   { glow: 'rgba(197,160,89,0.25)',  border: 'rgba(197,160,89,0.4)'  },
  moon:   { glow: 'rgba(180,190,220,0.20)', border: 'rgba(180,190,220,0.35)' },
  cosmic: { glow: 'rgba(168,85,247,0.20)',  border: 'rgba(168,85,247,0.35)'  },
};

export default function TodayIn10s() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.getDailyEnergy(),
      api.getLunarStatus(),
      api.getTransitsToday(),
    ]).then(([energyR, lunarR, transitsR]) => {
      if (!alive) return;
      const newSlides: Slide[] = [];

      if (energyR.status === 'fulfilled') {
        const e = energyR.value;
        newSlides.push({
          key: 'energy',
          emoji: e.energy.emoji,
          label: 'Énergie du jour',
          value: e.energy.label,
          sub: e.energy.advice?.slice(0, 80) || e.headline,
          accent: 'gold',
        });
      }

      if (lunarR.status === 'fulfilled') {
        const l = lunarR.value;
        const moonName = l.moonPhase.name;
        newSlides.push({
          key: 'moon',
          emoji: l.moonPhase.emoji,
          label: 'Lune',
          value: moonName,
          sub: l.isNewMoonWindow
            ? '🌱 Nouvelle lune — pose une intention'
            : l.isFullMoonWindow
              ? '🌕 Pleine lune — libère et célèbre'
              : l.moonPhase.description?.slice(0, 80),
          accent: 'moon',
        });
      }

      if (transitsR.status === 'fulfilled') {
        const t = transitsR.value.transits;
        // Pick the 2 most slow-moving planets (Jupiter + Saturn) for daily vibe
        const focusPlanets: Record<string, { fr: string; emoji: string }> = {
          venus: { fr: 'Vénus', emoji: '♀' },
          mars: { fr: 'Mars', emoji: '♂' },
          mercury: { fr: 'Mercure', emoji: '☿' },
        };
        const entries = Object.entries(t)
          .filter(([k]) => k in focusPlanets)
          .slice(0, 3);
        if (entries.length > 0) {
          const txt = entries
            .map(([k, v]) => `${focusPlanets[k].emoji} ${focusPlanets[k].fr} en ${v.sign}${v.retrograde ? ' ↺' : ''}`)
            .join(' · ');
          newSlides.push({
            key: 'transits',
            emoji: '✦',
            label: 'Transits',
            value: entries.length === 1 ? `${focusPlanets[entries[0][0]].fr} en ${entries[0][1].sign}` : 'Planètes du jour',
            sub: txt,
            accent: 'cosmic',
          });
        }
      }

      // Safety : si une seule slide, c'est OK ; si zéro, on abandonne
      if (newSlides.length > 0) {
        setSlides(newSlides);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  // Auto-advance every 6s
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = setInterval(() => {
      setActiveIdx(i => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  // Scroll to active slide
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[activeIdx] as HTMLElement;
    if (slide) {
      track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    }
  }, [activeIdx]);

  if (loading) {
    return (
      <div className="px-5 mb-4">
        <div className="h-24 rounded-2xl glass animate-pulse" />
      </div>
    );
  }
  if (slides.length === 0) return null;

  return (
    <div
      className="px-5 mb-4"
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-3 scrollbar-hide -mx-1 px-1 pb-1"
        style={{ scrollbarWidth: 'none' }}
        onScroll={(e) => {
          const track = e.currentTarget;
          const idx = Math.round(track.scrollLeft / (track.clientWidth - 16));
          if (idx !== activeIdx && idx >= 0 && idx < slides.length) {
            setActiveIdx(idx);
          }
        }}
      >
        {slides.map((s) => {
          const style = ACCENT_STYLES[s.accent];
          return (
            <div
              key={s.key}
              className="snap-start flex-shrink-0 w-[85%] rounded-2xl p-4"
              style={{
                background: `linear-gradient(135deg, ${style.glow} 0%, rgba(20,15,30,0.9) 100%)`,
                border: `1.5px solid ${style.border}`,
                boxShadow: `0 0 24px ${style.glow}`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                <div>
                  <p className="text-night-400 text-[10px] uppercase tracking-widest">{s.label}</p>
                  <p className="text-gold-gradient font-bold text-base leading-tight">{s.value}</p>
                </div>
              </div>
              {s.sub && (
                <p className="text-night-200 text-xs leading-relaxed line-clamp-2">{s.sub}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActiveIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className="transition-all"
              style={{
                width: i === activeIdx ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === activeIdx
                  ? 'rgba(197,160,89,0.9)'
                  : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
