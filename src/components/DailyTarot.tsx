import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';
import { getTarotImage } from '../data/tarotImages';
import { localISODate } from '../lib/storage';

interface TarotCard {
  cardName: string;
  cardId: number;
  roman: string;
  emoji: string;
  isReversed: boolean;
  archetype: string;
  message: string;
  question: string;
  reading?: string;
}

const STORAGE_KEY = 'celeste_tarot_drawn';

interface StoredDraw {
  date: string;
  card: TarotCard;
}

function getStoredDraw(): StoredDraw | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredDraw = JSON.parse(raw);
    const today = localISODate();
    return data.date === today ? data : null;
  } catch {
    return null;
  }
}

function setStoredDraw(card: TarotCard) {
  const today = localISODate();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, card }));
}

type DrawPhase = 'idle' | 'summoning' | 'facedown' | 'revealed';

export default function DailyTarot() {
  const stored = getStoredDraw();
  const [drawn, setDrawn] = useState<TarotCard | null>(stored?.card ?? null);
  const [phase, setPhase] = useState<DrawPhase>(stored ? 'revealed' : 'idle');
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [flipSide, setFlipSide] = useState<'recto' | 'verso'>('recto');

  const draw = async () => {
    setLoading(true);
    setPhase('summoning');
    try {
      const card = await api.getDailyTarot();
      setDrawn(card);
      setStoredDraw(card);
      setImgError(false);
      // After summon animation, show face-down card
      setTimeout(() => setPhase('facedown'), 1400);
    } catch {
      toast.error('Les cartes sont momentanément indisponibles. Réessaie dans un instant.');
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  };

  const reveal = () => {
    if (phase === 'facedown') setPhase('revealed');
  };

  // ─── IDLE: CTA button ───────────────────────────────
  if (phase === 'idle' && !drawn) {
    return (
      <div className="px-5 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">🃏 Tirage du jour</h2>
          <span className="text-night-500 text-xs">Une carte vous attend</span>
        </div>
        <button
          onClick={draw}
          disabled={loading}
          className="w-full rounded-2xl p-8 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, rgba(197,160,89,0.15) 0%, rgba(40,30,15,0.85) 100%)',
            border: '2px solid rgba(197,160,89,0.35)',
            boxShadow: '0 0 32px rgba(197,160,89,0.2), inset 0 0 24px rgba(197,160,89,0.08)',
          }}
        >
          <div className="flex flex-col items-center">
            <div className="text-6xl mb-3 animate-float-slow">🃏</div>
            <p className="text-gold-gradient font-bold text-lg mb-1">
              {loading ? 'Tirage en cours…' : 'Tirer ma carte du jour'}
            </p>
            <p className="text-night-300 text-xs">
              Une carte, un message. Revenez demain pour la suivante.
            </p>
          </div>
        </button>
      </div>
    );
  }

  // ─── SUMMONING: magic animation ─────────────────────
  if (phase === 'summoning') {
    return (
      <div className="px-5 mb-6 flex flex-col items-center justify-center min-h-[280px]">
        {/* Radiating glow */}
        <div className="relative flex items-center justify-center w-32 h-44">
          {/* Pulsing rings */}
          <div
            className="absolute inset-0 rounded-2xl animate-ping"
            style={{
              background: 'radial-gradient(circle, rgba(197,160,89,0.4) 0%, transparent 70%)',
              animationDuration: '1.2s',
            }}
          />
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(197,160,89,0.2) 0%, transparent 60%)',
              animation: 'tarot-pulse 0.8s ease-in-out infinite',
            }}
          />
          {/* Floating sparkles */}
          {['✦', '✧', '⋆', '✦', '✧'].map((s, i) => (
            <span
              key={i}
              className="absolute text-gold-300 text-sm"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                animation: `tarot-float-${i} ${0.6 + i * 0.15}s ease-out infinite`,
                opacity: 0.6 + Math.random() * 0.4,
              }}
            >
              {s}
            </span>
          ))}
          {/* Card silhouette */}
          <div
            className="relative w-20 h-32 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.2) 0%, rgba(40,30,15,0.9) 100%)',
              border: '2px solid rgba(197,160,89,0.4)',
              boxShadow: '0 0 40px rgba(197,160,89,0.3)',
              animation: 'tarot-card-spin 1.4s ease-in-out',
            }}
          >
            <span className="text-4xl" style={{ animation: 'tarot-glow 0.8s ease-in-out infinite' }}>✦</span>
          </div>
        </div>
        <p className="text-gold-300 text-sm tracking-widest uppercase mt-6 animate-pulse">
          Les cartes se mélangent…
        </p>
        <style>{`
          @keyframes tarot-pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 1; }
          }
          @keyframes tarot-glow {
            0%, 100% { opacity: 0.5; text-shadow: 0 0 8px rgba(197,160,89,0.4); }
            50% { opacity: 1; text-shadow: 0 0 20px rgba(197,160,89,0.9); }
          }
          @keyframes tarot-card-spin {
            0% { transform: rotateY(0deg) scale(0.5); opacity: 0; }
            50% { transform: rotateY(180deg) scale(1.1); opacity: 1; }
            100% { transform: rotateY(360deg) scale(1); opacity: 1; }
          }
          @keyframes tarot-float-0 { 0%{transform:translateY(0)} 100%{transform:translateY(-20px)} }
          @keyframes tarot-float-1 { 0%{transform:translateY(0)} 100%{transform:translateY(-15px)} }
          @keyframes tarot-float-2 { 0%{transform:translateY(0)} 100%{transform:translateY(-25px)} }
          @keyframes tarot-float-3 { 0%{transform:translateY(0)} 100%{transform:translateY(-18px)} }
          @keyframes tarot-float-4 { 0%{transform:translateY(0)} 100%{transform:translateY(-22px)} }
        `}</style>
      </div>
    );
  }

  // ─── FACEDOWN: card back, tap to reveal ─────────────
  if (phase === 'facedown' && drawn) {
    return (
      <div className="px-5 mb-6 flex flex-col items-center animate-fade-in">
        <div className="flex items-center justify-between mb-3 w-full">
          <h2 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">🃏 Tirage du jour</h2>
        </div>
        <p className="text-gold-300 text-sm tracking-widest uppercase mb-4 animate-pulse">
          Une carte a été tirée…
        </p>
        <div
          className="relative cursor-pointer w-48 h-72 rounded-2xl transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            perspective: '1200px',
            animation: 'tarot-drop-in 0.6s ease-out',
          }}
          onClick={reveal}
        >
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.18) 0%, rgba(60,40,15,0.95) 50%, rgba(197,160,89,0.12) 100%)',
              border: '3px solid rgba(197,160,89,0.4)',
              boxShadow: '0 0 48px rgba(197,160,89,0.25), inset 0 0 32px rgba(197,160,89,0.1)',
            }}
          >
            {/* Ornamental pattern */}
            <div className="absolute inset-3 rounded-xl border border-gold-500/20 flex items-center justify-center">
              <div className="absolute inset-1 rounded-lg border border-gold-500/10" />
            </div>
            {/* Central glyph */}
            <div className="relative flex flex-col items-center">
              <div className="text-6xl mb-2" style={{ animation: 'tarot-glow 1.5s ease-in-out infinite' }}>✦</div>
              <div className="text-gold-500/40 text-xs tracking-[0.3em] uppercase">Céleste</div>
            </div>
            {/* Corner flourishes */}
            <div className="absolute top-2 left-2 text-gold-500/30 text-xs">❦</div>
            <div className="absolute top-2 right-2 text-gold-500/30 text-xs">❦</div>
            <div className="absolute bottom-2 left-2 text-gold-500/30 text-xs">❦</div>
            <div className="absolute bottom-2 right-2 text-gold-500/30 text-xs">❦</div>
          </div>
        </div>
        <p className="text-night-300 text-xs mt-4 animate-pulse">👆 Touche pour révéler</p>
        <style>{`
          @keyframes tarot-drop-in {
            0% { transform: translateY(-40px) scale(0.8); opacity: 0; }
            60% { transform: translateY(8px) scale(1.05); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // ─── REVEALED: flip 3D, click to toggle recto/verso ───
  if (drawn) {
    const cardImage = !imgError ? getTarotImage(drawn.cardId) : null;
    const toggleFlip = () => setFlipSide(s => s === 'recto' ? 'verso' : 'recto');

    return (
      <div className="px-5 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">🃏 Tirage du jour</h2>
          <span className="text-night-500 text-xs">Reviens demain</span>
        </div>

        {/* 3D Flip Container */}
        <div
          className="relative cursor-pointer select-none"
          style={{ perspective: '1500px' }}
          onClick={toggleFlip}
        >
          <div
            className="relative w-full transition-transform duration-700 ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipSide === 'verso' ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* ═══ RECTO (card image + basic info) ═══ */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, rgba(197,160,89,0.25) 0%, rgba(40,30,15,0.98) 100%)',
                border: `3px solid rgba(197,160,89,${drawn.isReversed ? '0.25' : '0.55'})`,
                boxShadow: '0 0 48px rgba(197,160,89,0.3), inset 0 0 32px rgba(197,160,89,0.08)',
              }}
            >
              {/* Full card image — no crop */}
              {cardImage ? (
                <div
                  className="relative w-full"
                  style={{ transform: drawn.isReversed ? 'rotate(180deg)' : 'none' }}
                >
                  <img
                    src={cardImage}
                    alt={drawn.cardName}
                    className="w-full h-auto block"
                    onError={() => setImgError(true)}
                  />
                  {/* Roman numeral overlay */}
                  <div className="absolute top-2 left-2 bg-night-950/70 rounded-lg px-2 py-0.5">
                    <span className="text-gold-400 text-xs font-bold tracking-widest">{drawn.roman}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center pt-6 pb-3">
                  <div className="text-6xl mb-2" style={{ transform: drawn.isReversed ? 'rotate(180deg)' : 'none' }}>
                    {drawn.emoji}
                  </div>
                  <div className="bg-night-950/50 rounded-lg px-2 py-0.5">
                    <span className="text-gold-400 text-xs font-bold tracking-widest">{drawn.roman}</span>
                  </div>
                </div>
              )}

              {/* Text content below image */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-gold-gradient font-bold text-base leading-tight">
                    {drawn.cardName}
                    {drawn.isReversed && <span className="ml-1.5 text-[10px] text-night-400">⟲ inversée</span>}
                  </h3>
                </div>
                <p className="text-night-300 text-[11px] italic mb-2">{drawn.archetype}</p>
                <p className="text-night-100 text-xs leading-relaxed mb-2">{drawn.message}</p>
                <div className="pt-2 border-t border-gold-500/15">
                  <p className="text-gold-400 text-[10px] uppercase tracking-widest mb-0.5">Question du jour</p>
                  <p className="text-night-200 text-xs italic leading-snug">{drawn.question}</p>
                </div>
              </div>
            </div>

            {/* ═══ VERSO (detailed astrological reading) ═══ */}
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'linear-gradient(160deg, rgba(40,30,15,0.98) 0%, rgba(20,15,8,0.99) 50%, rgba(40,30,15,0.98) 100%)',
                border: '3px solid rgba(197,160,89,0.45)',
                boxShadow: '0 0 48px rgba(197,160,89,0.25), inset 0 0 40px rgba(197,160,89,0.06)',
              }}
            >
              <div className="flex flex-col h-full min-h-[400px] p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gold-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{drawn.emoji}</span>
                    <div>
                      <p className="text-gold-gradient font-bold text-sm leading-tight">{drawn.cardName}</p>
                      <p className="text-night-400 text-[10px]">{drawn.roman} · {drawn.isReversed ? 'Inversée' : 'Droite'}</p>
                    </div>
                  </div>
                  <span className="text-gold-500/40 text-lg">✦</span>
                </div>

                {/* Detailed reading */}
                <div className="flex-1 overflow-y-auto">
                  <p className="text-gold-400 text-[10px] uppercase tracking-widest mb-2">⚕ Lecture astrale du jour</p>
                  <p className="text-night-100 text-xs leading-relaxed">
                    {drawn.reading || drawn.message}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-gold-500/15">
                  <p className="text-night-500 text-[10px] text-center italic">
                    {flipSide === 'recto' ? '👆 Touche pour la lecture détaillée' : '👆 Touche pour revoir la carte'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hint below card */}
        <p className="text-night-400 text-[10px] text-center mt-3 animate-pulse">
          {flipSide === 'recto' ? '👆 Touche la carte pour ta lecture astrale' : '👆 Touche pour revoir la carte'}
        </p>
      </div>
    );
  }

  // Fallback (shouldn't happen)
  return null;
}
