import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CitySearch } from '../components/CitySearch';
import type { BirthData, CompatibilityResult } from '../types';
import type { GeoPlace } from '../lib/geocode';
import { ZODIAC_SIGNS } from '../data/zodiac';
import type { ZodiacSign } from '../types';

type Phase = 'loading' | 'form' | 'computing' | 'result' | 'error' | 'consumed';

/**
 * CompatRedeem — écran de réception d'une invitation à la compatibilité.
 * URL: /?invite=TOKEN
 *
 * L'utilisateur non-inscrit saisit sa date/heure/lieu de naissance et reçoit
 * l'analyse de compatibilité gratuitement (l'invitation est un canal d'acquisition).
 *
 * Si l'invitation a déjà été consumed, on affiche le résultat précédent.
 */
export function CompatRedeem({ token, onDone }: { token: string; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [inviterName, setInviterName] = useState<string>('');
  const [inviterSun, setInviterSun] = useState<string | null>(null);
  const [result, setResult] = useState<CompatibilityResult | null>(null);

  // Birth data form
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await api.getCompatInvite(token);
        if (cancelled) return;
        setInviterName(info.inviterName || 'Une personne');
        setInviterSun(info.inviterSun);
        if (info.status === 'redeemed') {
          setPhase('consumed');
        } else {
          setPhase('form');
        }
      } catch (e: any) {
        if (cancelled) return;
        setSubmitErr(e?.message || 'Invitation introuvable.');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    setSubmitErr('');
    if (!date || !time) {
      setSubmitErr('Date et heure de naissance requises.');
      return;
    }
    if (!place) {
      setSubmitErr('Ville de naissance requise.');
      return;
    }
    const birthData: BirthData = {
      date, time,
      city: place.city,
      country: place.country || '',
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.tzOffset ?? 0,
    };
    setPhase('computing');
    try {
      const { result: r } = await api.redeemCompatInvite(token, birthData);
      setResult(r);
      setPhase('result');
    } catch (e: any) {
      setSubmitErr(e?.message || 'Le calcul a échoué. Réessaie dans un instant.');
      setPhase('form');
    }
  };

  // ─── Loading state ──────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-4 animate-pulse">✨</div>
        <p className="text-night-300 text-sm">Chargement de ton invitation…</p>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-4">🌑</div>
        <h1 className="text-xl font-bold text-night-100 mb-2">Invitation invalide</h1>
        <p className="text-night-400 text-sm mb-6">{submitErr}</p>
        <button onClick={onDone} className="px-5 py-2.5 rounded-2xl glass border border-cosmic-500/40 text-cosmic-200 text-sm font-medium">
          Retour à Céleste
        </button>
      </div>
    );
  }

  // ─── Consumed state ─────────────────────────────────────
  if (phase === 'consumed') {
    return (
      <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-4">💫</div>
        <h1 className="text-xl font-bold text-night-100 mb-2">Invitation déjà utilisée</h1>
        <p className="text-night-400 text-sm mb-6">
          Cette invitation a déjà été utilisée. Chaque lien est valable une seule fois.
        </p>
        <button onClick={onDone} className="px-5 py-2.5 rounded-2xl glass border border-cosmic-500/40 text-cosmic-200 text-sm font-medium">
          Découvrir Céleste
        </button>
      </div>
    );
  }

  // ─── Computing state ────────────────────────────────────
  if (phase === 'computing') {
    return (
      <div className="p-6 max-w-md mx-auto min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-4">⭐</div>
        <p className="text-cosmic-200 font-medium text-sm mb-2">Calcul de votre compatibilité…</p>
        <p className="text-night-400 text-xs mb-6">Les astres s'alignent (2 à 10 secondes).</p>
        <svg className="animate-spin h-8 w-8 text-cosmic-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // ─── Result state ───────────────────────────────────────
  if (phase === 'result' && result) {
    const yourSunSym = inviterSun ? ZODIAC_SIGNS[inviterSun as ZodiacSign]?.symbol : '✨';
    const theirSunSym = result.theirSun ? ZODIAC_SIGNS[result.theirSun as ZodiacSign]?.symbol : '✨';
    return (
      <div className="p-6 max-w-md mx-auto min-h-screen pb-24">
        <div className="text-center mb-6 pt-6">
          <p className="text-night-400 text-xs uppercase tracking-widest mb-2">Votre compatibilité astrale</p>
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="text-4xl">{yourSunSym}</div>
            <div className="text-2xl text-cosmic-400">↔</div>
            <div className="text-4xl">{theirSunSym}</div>
          </div>
          <div className="text-5xl font-bold text-cosmic-gradient mb-1">{result.score}%</div>
          <h1 className="text-xl font-bold text-night-100 mb-2">{result.title}</h1>
          {result.description && (
            <p className="text-night-300 text-sm leading-relaxed">{result.description}</p>
          )}
        </div>

        {result.strengths?.length > 0 && (
          <div className="glass rounded-3xl p-5 mb-4">
            <p className="text-leaf-400 text-sm font-medium mb-3">✦ Points forts</p>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={`s-${i}`} className="text-night-200 text-sm flex gap-2">
                  <span className="text-leaf-400">+</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.challenges?.length > 0 && (
          <div className="glass rounded-3xl p-5 mb-6">
            <p className="text-gold-400 text-sm font-medium mb-3">⚠ Défis</p>
            <ul className="space-y-2">
              {result.challenges.map((c, i) => (
                <li key={`c-${i}`} className="text-night-200 text-sm flex gap-2">
                  <span className="text-gold-400">!</span>{c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="glass rounded-3xl p-5 border border-cosmic-500/30 mb-6">
          <p className="text-cosmic-100 font-medium text-sm mb-2">✨ {inviterName} t'attend sur Céleste</p>
          <p className="text-night-300 text-xs leading-relaxed mb-3">
            Crée ton compte gratuit pour recevoir ton thème astral complet,
            ton horoscope hebdomadaire et accéder à toutes nos analyses.
          </p>
          <button onClick={onDone} className="w-full py-3 rounded-2xl bg-gradient-to-r from-cosmic-500 to-cosmic-700 text-white font-medium text-sm">
            Découvrir Céleste →
          </button>
        </div>
      </div>
    );
  }

  // ─── Form state (default) ───────────────────────────────
  return (
    <div className="p-6 max-w-md mx-auto min-h-screen pb-24">
      <div className="text-center mb-6 pt-6">
        <div className="text-5xl mb-3">💞</div>
        <h1 className="text-2xl font-bold text-cosmic-gradient mb-2">
          {inviterName} t'a invité(e)
        </h1>
        <p className="text-night-300 text-sm leading-relaxed">
          Découvrez votre <span className="text-cosmic-200">compatibilité astrale détaillée</span>.
          Renseigne ta date, heure et lieu de naissance — c'est gratuit.
        </p>
      </div>

      {submitErr && (
        <div className="glass rounded-2xl p-3 mb-4 border border-red-500/30 text-red-300 text-xs">
          {submitErr}
        </div>
      )}

      <div className="glass rounded-3xl p-5 space-y-4">
        <div>
          <label className="text-night-400 text-xs uppercase tracking-widest block mb-2">Date de naissance</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-night-800/60 border border-night-600 rounded-xl px-4 py-3 text-night-100 text-sm focus:outline-none focus:border-cosmic-500" />
        </div>
        <div>
          <label className="text-night-400 text-xs uppercase tracking-widest block mb-2">Heure de naissance</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full bg-night-800/60 border border-night-600 rounded-xl px-4 py-3 text-night-100 text-sm focus:outline-none focus:border-cosmic-500" />
          <p className="text-night-500 text-xs mt-1">L'heure exacte affine la Lune et l'Ascendant.</p>
        </div>
        <div>
          <label className="text-night-400 text-xs uppercase tracking-widest block mb-2">Ville de naissance</label>
          <CitySearch onSelect={setPlace} />
          {place && (
            <p className="text-leaf-400 text-xs mt-2">✓ {place.city}{place.country ? `, ${place.country}` : ''}</p>
          )}
        </div>
      </div>

      <button onClick={handleSubmit}
        className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-cosmic-500 to-cosmic-700 text-white font-medium text-sm transition-all hover:from-cosmic-400 hover:to-cosmic-600 active:scale-[0.99]">
        Voir notre compatibilité →
      </button>

      <p className="text-center text-night-500 text-xs mt-4">
        Tes données restent privées. Aucune inscription requise pour découvrir le résultat.
      </p>
    </div>
  );
}
