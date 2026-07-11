import { useState } from 'react';
import { api } from '../lib/api';
import { toast } from './Toast';

interface TarotCard {
  cardName: string;
  cardId: number;
  roman: string;
  emoji: string;
  isReversed: boolean;
  archetype: string;
  message: string;
  question: string;
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
    const today = new Date().toISOString().split('T')[0];
    return data.date === today ? data : null;
  } catch {
    return null;
  }
}

function setStoredDraw(card: TarotCard) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, card }));
}

export default function DailyTarot() {
  const [drawn, setDrawn] = useState<TarotCard | null>(() => getStoredDraw()?.card || null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const draw = async () => {
    setLoading(true);
    try {
      const card = await api.getDailyTarot();
      setDrawn(card);
      setStoredDraw(card);
      setRevealed(true);
    } catch (e: any) {
      toast({ type: 'error', message: 'Les cartes sont momentanément indisponibles. Réessaie dans un instant.' });
    } finally {
      setLoading(false);
    }
  };

  const flipBack = () => {
    setRevealed(false);
  };

  // Card drawn today — show the result
  if (drawn) {
    return (
      <div className="px-5 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">🃏 Tirage du jour</h2>
          <span className="text-night-500 text-xs">Reviens demain</span>
        </div>
        <div
          className="relative cursor-pointer"
          style={{ perspective: '1000px' }}
          onClick={() => !revealed && setRevealed(true)}
        >
          <div
            className="relative w-full transition-transform duration-700"
            style={{
              transformStyle: 'preserve-3d',
              transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '200px',
            }}
          >
            {/* Card BACK (when not revealed) */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, rgba(197,160,89,0.15) 0%, rgba(120,80,30,0.25) 100%)',
                border: '2px solid rgba(197,160,89,0.3)',
                boxShadow: '0 0 32px rgba(197,160,89,0.15), inset 0 0 32px rgba(197,160,89,0.1)',
              }}
            >
              <div className="flex flex-col items-center justify-center h-full p-6 min-h-[200px]">
                <div className="text-5xl mb-3 opacity-50">✦</div>
                <p className="text-gold-300 font-semibold text-sm tracking-widest uppercase">Carte révélée</p>
                <p className="text-night-500 text-xs mt-2">Touche pour retourner</p>
              </div>
            </div>

            {/* Card FRONT (when revealed) */}
            <div
              className="rounded-2xl p-6"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'linear-gradient(135deg, rgba(197,160,89,0.25) 0%, rgba(40,30,15,0.95) 100%)',
                border: `2px solid rgba(197,160,89,${drawn.isReversed ? '0.25' : '0.5'})`,
                boxShadow: '0 0 48px rgba(197,160,89,0.25), inset 0 0 32px rgba(197,160,89,0.1)',
                minHeight: '200px',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-gold-500 text-xs tracking-widest uppercase mb-1">{drawn.roman}</p>
                  <h3 className="text-gold-gradient font-bold text-xl">
                    {drawn.cardName}
                    {drawn.isReversed && <span className="ml-2 text-xs text-night-400">(inversée)</span>}
                  </h3>
                  <p className="text-night-300 text-xs italic mt-1">{drawn.archetype}</p>
                </div>
                <div
                  className="text-5xl flex-shrink-0"
                  style={{ transform: drawn.isReversed ? 'rotate(180deg)' : 'none' }}
                >
                  {drawn.emoji}
                </div>
              </div>
              <p className="text-night-100 text-sm leading-relaxed mt-3 mb-3">{drawn.message}</p>
              <div className="pt-3 border-t border-gold-500/20">
                <p className="text-gold-400 text-xs uppercase tracking-widest mb-1">Question du jour</p>
                <p className="text-night-200 text-sm italic">{drawn.question}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not yet drawn today — show CTA
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