/**
 * TarotCross — Tirage premium en croix (3 cartes : Passé / Présent / Futur).
 *
 * P2 MON02 — Achat one-shot 2,99€ ou inclus premium mensuel.
 * - Vérifie quota via /api/tarot/cross/status
 * - Si quota : appelle /api/tarot/cross (LLM + fallback déterministe)
 * - Sinon : affiche modal d'achat (iOS / Android / Stripe)
 *
 * Affichage : 3 cartes en colonne avec lecture LLM (past/present/future/synthesis).
 */
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { startConsumableCheckout } from '../lib/payment';
import { toast } from '../components/Toast';

interface Card {
  position: 'past' | 'present' | 'future';
  id: number; name: string; roman: string; emoji: string;
  archetype: string; upright: string; reversed: string; isReversed: boolean;
}
interface Reading {
  past: string; present: string; future: string; synthesis: string;
  _deterministic?: boolean;
}
interface DrawResult {
  cards: Card[]; reading: Reading; isPremiumDraw: boolean; sunSign: string;
}

const POSITION_LABELS: Record<Card['position'], { label: string; sub: string }> = {
  past: { label: 'Passé', sub: 'Ce qui t\'amène ici' },
  present: { label: 'Présent', sub: 'Où tu es' },
  future: { label: 'Futur', sub: 'Ce qui vient' },
};

export default function TarotCross() {
  const [quota, setQuota] = useState<{ freeUsed: number; paidCount: number; isPremium: boolean; canDraw: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [question, setQuestion] = useState('');

  const refresh = () => {
    api.getTarotCrossStatus()
      .then(setQuota)
      .catch((err) => { toast.error('Tirage croix indisponible — réessaie dans un instant.'); })
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const handleDraw = async () => {
    if (!quota?.canDraw) {
      setShowBuyModal(true);
      return;
    }
    setLoading(true);
    try {
      const r = await api.drawTarotCross(question.trim() || undefined);
      setResult(r);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tirage impossible';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (_source: 'ios' | 'android' | 'stripe') => {
    try {
      // Stripe Checkout → webhook → grant automatique du tirage premium.
      const r = await startConsumableCheckout('tarot');
      if (!r.success) {
        toast.error(r.error || 'Paiement refusé');
      }
      // Redirection vers Stripe si succès → toast de confirmation géré sur /billing/success.
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Paiement refusé');
    }
  };

  if (!quota) {
    return (
      <div className="w-full glass rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-40 bg-night-700/40 rounded" />
      </div>
    );
  }

  // ─── RESULT display ───
  if (result) {
    return (
      <div className="px-5 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">✦ Tirage en croix</h2>
          <span className="text-night-500 text-xs">{result.isPremiumDraw ? 'Premium' : 'Achat'}</span>
        </div>

        {question.trim() && (
          <p className="text-night-400 text-xs italic mb-3 px-3 py-2 rounded-lg bg-night-900/50 border border-gold-500/15">
            « {question} »
          </p>
        )}

        <div className="space-y-3">
          {result.cards.map((card) => (
            <div
              key={card.position}
              className="rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.15) 0%, rgba(40,30,15,0.95) 100%)',
                border: '2px solid rgba(197,160,89,0.35)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-16 h-24 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(197,160,89,0.2) 0%, rgba(20,15,8,0.98) 100%)',
                    border: '1.5px solid rgba(197,160,89,0.4)',
                    transform: card.isReversed ? 'rotate(180deg)' : 'none',
                  }}
                >
                  <span className="text-3xl">{card.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-gold-400 text-[10px] uppercase tracking-widest font-semibold">
                      {POSITION_LABELS[card.position].label}
                    </span>
                    <span className="text-night-500 text-[10px]">·</span>
                    <span className="text-night-500 text-[10px]">{POSITION_LABELS[card.position].sub}</span>
                  </div>
                  <h3 className="text-gold-gradient font-bold text-sm leading-tight mb-0.5">
                    {card.name} {card.isReversed && <span className="text-[10px] opacity-75">⟲</span>}
                  </h3>
                  <p className="text-night-400 text-[10px] italic mb-2">{card.archetype}</p>
                  <p className="text-night-100 text-xs leading-relaxed">
                    {card.position === 'past' && result.reading.past}
                    {card.position === 'present' && result.reading.present}
                    {card.position === 'future' && result.reading.future}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Synthèse */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-gold-500/10 to-cosmic-500/10 border border-gold-500/30">
          <p className="text-gold-400 text-[10px] uppercase tracking-widest font-semibold mb-2">✦ Synthèse</p>
          <p className="text-night-100 text-sm leading-relaxed">{result.reading.synthesis}</p>
        </div>

        {result.reading._deterministic && (
          <p className="text-night-600 text-[10px] mt-2 text-center">
            Lecture concise hors-ligne — la version complète arrivera sous peu.
          </p>
        )}

        <button
          onClick={() => { setResult(null); setQuestion(''); }}
          className="w-full mt-4 py-2 text-night-400 hover:text-gold-300 text-xs transition-colors"
        >
          ↻ Nouveau tirage
        </button>
      </div>
    );
  }

  // ─── LOADING animation ───
  if (loading) {
    return (
      <div className="px-5 mb-6 flex flex-col items-center justify-center py-12">
        <div className="flex gap-3 mb-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-14 h-20 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.2) 0%, rgba(40,30,15,0.95) 100%)',
                border: '2px solid rgba(197,160,89,0.4)',
                animation: `tarot-cross-flip ${0.8 + i * 0.2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
        <p className="text-gold-300 text-sm tracking-widest uppercase animate-pulse">
          Les cartes se révèlent…
        </p>
        <style>{`
          @keyframes tarot-cross-flip {
            0%, 100% { transform: rotateY(0deg); }
            50% { transform: rotateY(180deg); }
          }
        `}</style>
      </div>
    );
  }

  // ─── IDLE — CTA ───
  return (
    <>
      <div className="px-5 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gold-400 text-xs uppercase tracking-widest font-semibold">✦ Tirage en croix</h2>
          <span className="text-night-500 text-xs">
            {quota.isPremium ? 'Inclus premium' : '2,99€'}
          </span>
        </div>

        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(197,160,89,0.18) 0%, rgba(40,30,15,0.9) 100%)',
            border: '2px solid rgba(197,160,89,0.3)',
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-10 h-14 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(197,160,89,0.2) 0%, rgba(20,15,8,0.98) 100%)',
                    border: '1.5px solid rgba(197,160,89,0.35)',
                  }}
                >
                  <span className="text-gold-500/60 text-xs">✦</span>
                </div>
              ))}
            </div>
            <div className="flex-1">
              <p className="text-gold-gradient font-bold text-sm mb-1">3 cartes · Passé · Présent · Futur</p>
              <p className="text-night-300 text-xs leading-relaxed">
                Pose une question, tire trois cartes. Le fil rouge de ta situation se dévoile.
              </p>
            </div>
          </div>

          {/* Champ question optionnel */}
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
            placeholder="Une question ? (optionnel)"
            className="w-full mb-3 px-3 py-2 rounded-xl bg-night-950/60 border border-gold-500/20 text-night-100 text-xs placeholder-night-600 focus:outline-none focus:border-gold-500/50"
          />

          <button
            onClick={handleDraw}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-gold-500/20"
          >
            {quota.isPremium
              ? '✦ Tirer les 3 cartes'
              : quota.canDraw
                ? '✦ Tirer les 3 cartes'
                : '✦ Tirer les 3 cartes — 2,99 €'}
          </button>

          {!quota.isPremium && (
            <p className="text-night-500 text-[10px] text-center mt-2">
              {quota.canDraw
                ? `${quota.paidCount - quota.freeUsed} tirage${(quota.paidCount - quota.freeUsed) > 1 ? 's' : ''} restant${(quota.paidCount - quota.freeUsed) > 1 ? 's' : ''}`
                : 'Paiement unique · lecture instantanée'}
            </p>
          )}
        </div>
      </div>

      {showBuyModal && (
        <div
          className="fixed inset-0 bg-night-950/80 backdrop-blur-sm z-50 flex items-center justify-center px-5"
          onClick={() => setShowBuyModal(false)}
        >
          <div
            className="w-full max-w-md glass rounded-3xl p-6 border border-gold-500/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-gold-gradient mb-2 tracking-wider">
              Tirage en croix
            </h3>
            <p className="text-night-300 text-sm leading-relaxed mb-5">
              Trois cartes. Trois moments. Une réponse qui chemine du Passé vers le Futur.
            </p>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-3xl font-bold text-gold-300">2,99 €</span>
              <span className="text-night-500 text-xs">— pour 1 tirage</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleBuy('ios')}
                className="w-full py-3 rounded-xl bg-night-800 hover:bg-night-700 text-night-100 text-sm border border-night-700 transition-all"
              >
                Acheter sur iOS (App Store)
              </button>
              <button
                onClick={() => handleBuy('android')}
                className="w-full py-3 rounded-xl bg-night-800 hover:bg-night-700 text-night-100 text-sm border border-night-700 transition-all"
              >
                Acheter sur Android (Play Store)
              </button>
              <button
                onClick={() => handleBuy('stripe')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-gold-500/20"
              >
                Payer par carte · 2,99 €
              </button>
            </div>
            <button
              onClick={() => setShowBuyModal(false)}
              className="w-full mt-3 py-2 text-night-500 hover:text-night-300 text-xs transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
