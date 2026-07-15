import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { localISODate } from '../lib/storage';

/**
 * HoroscopeFeedback — compact widget at the bottom of the horoscope screen.
 * Asks "Cet horoscope était-il précis ?" with 5 gold stars.
 * One submission per day (tracked in localStorage, keyed by date).
 */
const KEY = 'celeste_horoscope_feedback';

export default function HoroscopeFeedback({ date }: { date?: string }) {
  const today = date ?? localISODate();
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(KEY) === today; } catch { return false; }
  });
  const [hover, setHover] = useState(0);
  const [rating, setRating] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (confirmTimer.current !== null) {
      window.clearTimeout(confirmTimer.current);
    }
  }, []);

  const submit = async (n: number) => {
    if (done || confirming) return;
    let alive = true;
    setRating(n);
    setConfirming(true);
    try {
      await api.submitHoroscopeFeedback(n);
    } catch (e) {
      console.error('horoscope feedback:', e);
    }
    try { localStorage.setItem(KEY, today); } catch { /* ignore */ }
    // Hold the "Merci ✦" confirmation briefly, then settle into the permanent state.
    if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => {
      if (alive) setDone(true);
    }, 1100);
  };

  // Submitted (just now or earlier today) → confirmation card.
  if (done || confirming) {
    return (
      <div className="glass-gold rounded-2xl px-5 py-5 mt-4 mb-6 mx-5 animate-fade-in-scale text-center">
        <div className="text-2xl mb-1 text-gold-400 animate-gold-glow">✦</div>
        <p className="text-gold-gradient font-display text-sm tracking-wide">
          {done ? 'Merci pour votre retour ✦' : 'Merci ✦'}
        </p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <div className="glass-gold rounded-2xl px-5 py-4 mt-4 mb-6 mx-5 animate-fade-in">
      <p className="text-center text-night-200 text-sm mb-3 font-display tracking-wide">
        Cet horoscope était-il précis ?
      </p>
      <div
        className="flex justify-center gap-1.5"
        onMouseLeave={() => setHover(0)}
        role="group"
        aria-label="Noter la précision de l'horoscope"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= shown;
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onClick={() => submit(n)}
              aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
              className="text-3xl leading-none p-1 transition-all duration-300 ease-out hover:scale-125 active:scale-90"
              style={{
                color: on ? '#e2c47c' : '#3a3a3a',
                textShadow: on ? '0 0 12px rgba(197,160,89,0.6)' : 'none',
              }}
            >
              ★
            </button>
          );
        })}
      </div>
    </div>
  );
}
