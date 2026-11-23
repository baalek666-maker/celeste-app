import { useState } from 'react';
import { calculateNatalChart } from '../lib/astrology';
import { setBirthData, setOnboarded } from '../lib/storage';
import { api } from '../lib/api';
import type { User, BirthData, NatalChart } from '../types';
import { toast } from '../components/Toast';
import { CitySearch } from '../components/CitySearch';
import type { GeoPlace } from '../lib/geocode';
import { ZODIAC_SIGNS } from '../data/zodiac';
import { SUN_TEXT, MOON_TEXT, RISING_TEXT } from '../data/big3';

// P0#2 — 117 villes hardcodées supprimées. Remplacées par geocoding OSM Nominatim
// via <CitySearch /> (composant réutilisable). Plus aucun blocage géographique :
// n'importe quel lieu francophone (Sénégal, Liban, Vietnam, Antilles...) est trouvable.

export function Onboarding({ onComplete }: { onComplete: (u: User) => void }) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GeoPlace | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [reveal, setReveal] = useState<NatalChart | null>(null);
  const [trialOn, setTrialOn] = useState(false);

  const finish = () => {
    let user: Partial<User> = {};
    try { user = JSON.parse(localStorage.getItem('celeste_user') || '{}'); } catch { /* corrupt localStorage */ }
    if (firstName.trim()) user.name = firstName.trim();
    if (trialOn) {
      const now = Math.floor(Date.now() / 1000);
      user.isPremium = true;
      user.trialStartedAt = now;
      user.premiumUntil = now + 7 * 86400;
    }
    onComplete(user as User);
  };

  const handleSubmit = () => {
    if (!selectedPlace) return;
    setCalculating(true);
    setStep(3); // Affiche l'animation "Calculating" (était manquant — bug P0)
    const c = selectedPlace;
    const finalTime = timeUnknown ? '12:00' : time;
    let birth: BirthData = {
      date, time: finalTime, city: c.city, country: c.country,
      latitude: c.latitude, longitude: c.longitude, timezone: c.tzOffset,
    };

    // v15 — le serveur renvoie le fuseau RÉEL à la date de naissance (heure d'été,
    // historique) → on recalcule le thème local avec, sinon l'Ascendant peut être faux.
    const save = api.saveBirthData(birth, { firstName: firstName.trim() || undefined })
      .then((r) => { if (r?.birthData) birth = { ...birth, ...r.birthData }; return 'synced'; })
      .catch(() => { toast.info('Sauvegardé sur ton téléphone — synchronisation dès que possible'); return 'queued'; });
    // v15 — « reverse trial » : 7 jours de Premium offerts automatiquement, sans CB.
    const trial = save.then(() => api.startTrial()).then(() => { setTrialOn(true); }).catch(() => { /* déjà utilisé / hors ligne */ });

    const minDelay = new Promise(r => setTimeout(r, 1800));
    Promise.all([minDelay, save, trial]).finally(() => {
      let chart: NatalChart;
      try {
        chart = calculateNatalChart(birth);
      } catch (err) {
        console.error('[Onboarding] calculateNatalChart failed:', err);
        setCalculating(false);
        setStep(2);
        return;
      }
      setBirthData(birth, chart);
      setOnboarded();
      setCalculating(false);
      setReveal(chart);
      setStep(4);
    });
  };

  const shareBig3 = async (chart: NatalChart) => {
    const s = ZODIAC_SIGNS[chart.sun]?.name, m = ZODIAC_SIGNS[chart.moon]?.name, r = ZODIAC_SIGNS[chart.rising]?.name;
    const text = `Mon Big 3 : Soleil ${s}, Lune ${m}, Ascendant ${r} ✦ Et toi ?`;
    try {
      if (navigator.share) await navigator.share({ title: 'Mon ciel sur Céleste', text, url: window.location.origin });
      else { await navigator.clipboard.writeText(`${text} ${window.location.origin}`); toast.success('Copié — colle-le où tu veux ✦'); }
    } catch { /* partage annulé */ }
  };

  // Step indicator (P1 — segments glass + gold avec labels, vs simple dots)
  // v15 — 2 étapes réelles (avant : 3 segments pour « Étape 1 sur 2 »), décalé
  // à droite du bouton retour (qui chevauchait le libellé).
  const STEP_LABELS = ['Ta naissance', 'Ton lieu'];
  const ProgressBar = ({ current }: { current: number }) => (
    <div className="fixed top-0 left-0 right-0 pl-16 pr-6 pt-5 z-40">
      {/* Segmented progress */}
      <div className="flex gap-1.5 mb-2">
        {STEP_LABELS.map((_, n) => (
          <div key={n} className="flex-1 h-1.5 rounded-full bg-night-800/80 overflow-hidden backdrop-blur-sm">
            <div
              className={`h-full bg-gradient-to-r from-cosmic-500 via-cosmic-400 to-gold-400 transition-colors duration-200 ease-out duration-700 ease-out shadow-[0_0_8px_rgba(251,191,36,0.4)] ${
                current >= n ? 'w-full' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>
      {/* Step labels */}
      <div className="flex justify-between">
        {STEP_LABELS.map((label, n) => (
          <p key={label} className={`text-[10px] uppercase tracking-wider transition-colors ${
            current === n
              ? 'text-gold-400 font-semibold'
              : current > n
                ? 'text-night-300'
                : 'text-night-700'
          }`}>
            {label}
          </p>
        ))}
      </div>
    </div>
  );

  const BackButton = ({ to }: { to: number }) => (
    step > 0 && (
      <button
        type="button"
        onClick={() => setStep(to)}
        aria-label="Retour à l'étape précédente"
        className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full glass flex items-center justify-center text-night-300 hover:text-gold-400 transition-colors"
      >
        ←
      </button>
    )
  );

  const steps = [
    // Step 0: Welcome
    <div key="0" className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-fade-in">
      <div className="mb-8 relative">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cosmic-500/20 to-gold-500/20 flex items-center justify-center animate-glow">
          <svg width="64" height="64" viewBox="0 0 64 64" className="animate-spin-slow">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#fbbf24" strokeWidth="0.5" opacity="0.5" />
            <circle cx="32" cy="32" r="20" fill="none" stroke="#c084fc" strokeWidth="0.5" opacity="0.5" />
            <circle cx="32" cy="32" r="12" fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.5" />
            <circle cx="32" cy="4" r="2" fill="#fbbf24" />
            <circle cx="60" cy="32" r="1.5" fill="#c084fc" />
            <circle cx="32" cy="60" r="1.5" fill="#a855f7" />
            <circle cx="4" cy="32" r="1.5" fill="#fbbf24" />
            <circle cx="32" cy="32" r="3" fill="#fcd34d" opacity="0.8" />
          </svg>
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-3 text-gold-gradient">Bienvenue</h1>
      <p className="text-night-300 text-base mb-8 max-w-xs">
        Trois infos sur ta naissance, et ton ciel s'ouvre. Ça prend une minute.
      </p>
      {/* v15 — Offre unique, la même partout */}
      <div className="glass rounded-2xl px-5 py-4 mb-8 max-w-xs border border-gold-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-gold-400 text-sm font-semibold">✦ 7 jours de Premium offerts</span>
        </div>
        <p className="text-night-400 text-xs leading-relaxed text-left">
          Sans carte bancaire. Ensuite, ton horoscope et ton tirage du jour restent gratuits, pour toujours.
        </p>
      </div>
      {/* P3 — 3 mini-cartes preview avant le CTA : montre ce qui t'attend */}
      <div className="w-full max-w-xs mb-8">
        <p className="text-night-500 text-xs uppercase tracking-widest mb-3 text-center">Tu vas découvrir</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '✦', title: 'Horoscope', sub: 'quotidien', gradient: 'from-cosmic-500/30 to-cosmic-500/10' },
            { icon: '☽', title: 'Portrait', sub: 'cosmique', gradient: 'from-gold-500/30 to-gold-500/10' },
            { icon: '♡', title: 'Compatibilité', sub: 'deux ciels', gradient: 'from-rose-500/25 to-rose-500/5' },
          ].map((card, idx) => (
            <div
              key={card.title}
              className={`glass rounded-2xl p-3 text-center border border-white/10 bg-gradient-to-br ${card.gradient} animate-fade-in`}
              style={{ animationDelay: `${0.15 + idx * 0.12}s` }}
            >
              <div className="text-2xl mb-1.5">{card.icon}</div>
              <p className="text-white text-xs font-semibold leading-tight">{card.title}</p>
              <p className="text-night-400 text-[10px] mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setStep(1)}
        className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-lg shadow-lg shadow-cosmic-900/50 hover:shadow-cosmic-700/50 transition-colors duration-200 ease-out animate-glow"
      >
        Commencer
      </button>
    </div>,

    // Step 1: Date + Time of birth (merged — was 2 separate steps)
    <div key="1" className="flex flex-col items-center justify-center min-h-screen px-8 pt-28 pb-8 animate-fade-in relative">
      <ProgressBar current={0} />
      <BackButton to={0} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 1 sur 2</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Quand es-tu né·e ?</h2>
      <p className="text-night-400 text-sm mb-6 text-center max-w-xs">
        L'heure de naissance donne ton Ascendant — elle change tout.
      </p>

      {/* v15 — prénom (facultatif) : « Bonjour Camille » au lieu du préfixe e-mail */}
      <label className="w-full max-w-xs mb-2 text-night-400 text-xs uppercase tracking-wider text-left">
        Ton prénom <span className="normal-case tracking-normal text-night-600">(facultatif)</span>
      </label>
      <input
        type="text" value={firstName} onChange={e => setFirstName(e.target.value.slice(0, 40))}
        autoComplete="given-name" placeholder="Camille"
        className="w-full max-w-xs py-3.5 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center placeholder:text-night-600 focus:outline-none focus:border-cosmic-500 transition-colors mb-4"
      />

      {/* Date input — v15.1 : label au-dessus (les input[type=date] natives Android affichent leur propre format, pas de placeholder custom) */}
      <label className="w-full max-w-xs mb-2 text-night-400 text-xs uppercase tracking-wider text-left">
        Ta date de naissance
      </label>
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors mb-3"
      />

      {/* Time input + unknown toggle */}
      <label className="w-full max-w-xs mb-2 text-night-400 text-xs uppercase tracking-wider text-left">
        Ton heure de naissance
      </label>
      <button
        onClick={() => { setTimeUnknown(!timeUnknown); if (!timeUnknown) setTime(''); }}
        className={`w-full max-w-xs mb-3 py-3 rounded-2xl border text-sm font-medium transition-colors duration-200 ease-out ${timeUnknown ? 'glass border-cosmic-500 text-cosmic-300' : 'glass border-night-700 text-night-300 hover:border-cosmic-500/50'}`}
      >
        {timeUnknown ? '✓ Je ne connais pas mon heure' : '🕐 Je ne connais pas mon heure de naissance'}
      </button>
      <input
        type="time" value={time} disabled={timeUnknown}
        onChange={e => setTime(e.target.value)}
        className={`w-full max-w-xs py-4 px-4 rounded-2xl glass border border-night-700 text-night-100 text-lg text-center focus:outline-none focus:border-cosmic-500 transition-colors mb-2 ${timeUnknown ? 'opacity-40' : ''}`}
      />
      {timeUnknown && (
        <p className="text-night-500 text-xs mt-1 max-w-xs text-center mb-2">
          ⚠️ Sans l'heure, l'Ascendant et les Maisons seront approximatifs (calculés à midi).
        </p>
      )}

      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          disabled={!date || (!time && !timeUnknown)}
          onClick={() => setStep(2)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors duration-200 ease-out"
        >
          Continuer
        </button>
      </div>
    </div>,

    // Step 2: Place of birth (P0#2 — CitySearch remplace la liste hardcodée)
    // Fric-#3 — Ajout d'un raccourci "Je préciserai plus tard" qui prend Paris
    // comme défaut pour réduire l'abandon. Le user pourra le changer plus tard
    // dans Settings > Profil.
    <div key="2" className="flex flex-col items-center justify-center min-h-screen px-8 pt-28 pb-8 animate-fade-in relative">
      <ProgressBar current={1} />
      <BackButton to={1} />
      <p className="text-gold-400 text-sm uppercase tracking-widest mb-3">Étape 2 sur 2</p>
      <h2 className="text-2xl font-bold mb-2 text-center">Où es-tu né·e ?</h2>
      <p className="text-night-400 text-sm mb-6 text-center max-w-xs">
        Le lieu de naissance affine ton Ascendant. Tape ta ville — partout dans le monde.
      </p>

      <div className="w-full max-w-xs">
        <CitySearch
          onSelect={setSelectedPlace}
          value={selectedPlace}
          placeholder="🔎 Paris, Dakar, Saigon..."
        />
      </div>

      {/* Fric-#3 — Skip CTA : Paris par défaut, modifiable dans Settings */}
      <button
        onClick={() => {
          setSelectedPlace({
            displayName: 'Paris, Île-de-France, France',
            city: 'Paris', country: 'France',
            latitude: 48.8566, longitude: 2.3522, tzOffset: 2,
          });
          // Trigger handleSubmit après le setState
          setTimeout(() => {
            const btn = document.getElementById('onboarding-submit');
            if (btn) (btn as HTMLButtonElement).click();
          }, 50);
        }}
        className="mt-4 text-night-400 hover:text-gold-400 text-sm transition-colors underline-offset-4 hover:underline"
      >
        Je préciserai plus tard → utiliser Paris
      </button>

      <div className="mt-auto w-full max-w-xs pb-8">
        <button
          id="onboarding-submit"
          disabled={!selectedPlace}
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 disabled:opacity-30 disabled:cursor-not-allowed text-night-950 font-semibold text-lg shadow-lg shadow-gold-900/50 transition-colors duration-200 ease-out"
        >
          Révéler mon thème ✨
        </button>
        <p className="text-night-500 text-xs text-center mt-3">
          Tu pourras modifier ta ville à tout moment dans Réglages.
        </p>
      </div>
    </div>,

    // Step 3: Calculating — cercle zodiacal animé
    // 12 signes orbitent pendant que les planètes se placent. Effet wow.
    <div key="3" className="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-fade-in relative">
      {calculating ? (
        <>
          {/* Cercle zodiacal animé — 12 segments + planètes en orbite */}
          <div className="relative mb-8 w-64 h-64 mx-auto">
            {/* Halo radial doré pulsant */}
            <div className="absolute inset-0 rounded-full animate-glow"
                 style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)' }} />

            <svg width="256" height="256" viewBox="0 0 256 256" className="relative z-10">
              <defs>
                <radialGradient id="calc-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.3" />
                  <stop offset="70%" stopColor="#c084fc" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>

              {/* Cercle de fond */}
              <circle cx="128" cy="128" r="120" fill="url(#calc-glow)" />
              <circle cx="128" cy="128" r="110" fill="none" stroke="#383964" strokeWidth="0.5" opacity="0.5" />

              {/* 12 segments zodiacaux (30° chacun) qui s'allument progressivement */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = (i * 30 - 90) * Math.PI / 180;
                const x1 = 128 + 100 * Math.cos(angle);
                const y1 = 128 + 100 * Math.sin(angle);
                const x2 = 128 + 110 * Math.cos(angle);
                const y2 = 128 + 110 * Math.sin(angle);
                const sx = 128 + 85 * Math.cos(angle);
                const sy = 128 + 85 * Math.sin(angle);
                const signs = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
                return (
                  <g key={i}
                     className="animate-fade-in"
                     style={{ animationDelay: `${i * 0.08}s`, transformOrigin: '128px 128px' }}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="0.5" opacity="0.3" />
                    <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central"
                          fontSize="11" fill="#fbbf24" opacity="0.6">{signs[i]}</text>
                  </g>
                );
              })}

              {/* Orbites planétaires concentriques */}
              <circle cx="128" cy="128" r="70" fill="none" stroke="#56589c" strokeWidth="0.4" opacity="0.4" />
              <circle cx="128" cy="128" r="50" fill="none" stroke="#757bc4" strokeWidth="0.4" opacity="0.3" />
              <circle cx="128" cy="128" r="30" fill="none" stroke="#a855f7" strokeWidth="0.4" opacity="0.3" />

              {/* Soleil central */}
              <circle cx="128" cy="128" r="6" fill="#fcd34d" opacity="0.9">
                <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Planètes en orbite — rotation continue */}
              <g className="animate-spin-slow" style={{ transformOrigin: '128px 128px' }}>
                <circle cx="198" cy="128" r="3" fill="#fbbf24">
                  <animateTransform attributeName="transform" type="rotate"
                    from="0 128 128" to="360 128 128" dur="8s" repeatCount="indefinite" />
                </circle>
                <circle cx="178" cy="128" r="2.5" fill="#e0e0e0">
                  <animateTransform attributeName="transform" type="rotate"
                    from="0 128 128" to="-360 128 128" dur="6s" repeatCount="indefinite" />
                </circle>
                <circle cx="158" cy="128" r="2" fill="#c084fc">
                  <animateTransform attributeName="transform" type="rotate"
                    from="60 128 128" to="420 128 128" dur="10s" repeatCount="indefinite" />
                </circle>
                <circle cx="148" cy="128" r="1.5" fill="#a855f7">
                  <animateTransform attributeName="transform" type="rotate"
                    from="180 128 128" to="540 128 128" dur="7s" repeatCount="indefinite" />
                </circle>
              </g>
            </svg>
          </div>

          <h2 className="text-xl font-bold mb-3 text-gold-gradient">Calcul de ton thème natal</h2>
          <p className="text-night-400 text-sm mb-8">Les planètes se placent dans ton ciel...</p>

          {/* Étapes de calcul — apparition séquencée avec checkmarks */}
          <div className="space-y-3 text-left max-w-xs mx-auto">
            {[
              { label: 'Position du Soleil', delay: '0.3s', icon: '☉' },
              { label: 'Position de la Lune', delay: '0.8s', icon: '☽' },
              { label: 'Calcul de l\'Ascendant', delay: '1.3s', icon: '↑' },
              { label: 'Répartition des Maisons', delay: '1.8s', icon: '⌂' },
            ].map((step) => (
              <div key={step.label}
                   className="flex items-center gap-3 animate-fade-in"
                   style={{ animationDelay: step.delay }}>
                <span className="text-gold-400 text-base w-5">{step.icon}</span>
                <span className="text-night-300 text-sm">{step.label}</span>
                <span className="ml-auto text-gold-400/60 text-xs animate-pulse">...</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>,

    // Step 4 (v15) — Révélation du Big 3 : le moment « wow », partageable.
    <div key="4" className="flex flex-col items-center min-h-screen px-6 pt-14 pb-10 text-center animate-fade-in">
      {reveal && (() => {
        const big3 = [
          { label: 'Soleil', hint: 'qui tu es', sign: reveal.sun, text: SUN_TEXT[ZODIAC_SIGNS[reveal.sun]?.name] },
          { label: 'Lune', hint: 'ce dont tu as besoin', sign: reveal.moon, text: MOON_TEXT[ZODIAC_SIGNS[reveal.moon]?.name] },
          { label: 'Ascendant', hint: 'ce que les autres voient', sign: reveal.rising, text: RISING_TEXT[ZODIAC_SIGNS[reveal.rising]?.name] },
        ];
        return (
          <>
            <p className="text-gold-400 text-xs uppercase tracking-[0.25em] mb-3">Ton ciel de naissance</p>
            <h2 className="text-3xl font-bold text-gold-gradient mb-8">
              {firstName.trim() ? `${firstName.trim()}, voici ton ciel` : 'Voici ton ciel'}
            </h2>
            <div className="w-full max-w-sm space-y-3 mb-6">
              {big3.map((b, i) => (
                <div key={b.label} className="glass rounded-2xl p-4 text-left border border-gold-500/15 animate-fade-in" style={{ animationDelay: `${0.2 + i * 0.35}s`, animationFillMode: 'both' }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-3xl text-gold-300 w-9 text-center">{ZODIAC_SIGNS[b.sign]?.symbol}</span>
                    <div>
                      <p className="text-night-400 text-[11px] uppercase tracking-widest">{b.label} · {b.hint}</p>
                      <p className="text-white text-lg font-semibold leading-tight">{ZODIAC_SIGNS[b.sign]?.name}</p>
                    </div>
                  </div>
                  {b.text && <p className="text-night-300 text-sm leading-relaxed">{b.text}</p>}
                </div>
              ))}
            </div>
            {timeUnknown && (
              <p className="text-night-500 text-xs max-w-xs mb-4">Sans heure de naissance, ton Ascendant est approximatif. Tu pourras l'ajouter dans ton Profil.</p>
            )}
            {trialOn && (
              <div className="w-full max-w-sm rounded-2xl px-4 py-3 mb-6 border border-gold-500/30 bg-gold-500/5 animate-fade-in" style={{ animationDelay: '1.3s', animationFillMode: 'both' }}>
                <p className="text-gold-300 text-sm font-semibold">✦ Ton Premium est offert pendant 7 jours</p>
                <p className="text-night-400 text-xs mt-1">Portrait complet, compatibilités illimitées, météo à 14 jours. Sans carte bancaire, rien à annuler.</p>
              </div>
            )}
            <button onClick={finish} className="w-full max-w-sm py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 text-night-950 font-semibold text-lg shadow-lg shadow-gold-900/40 mb-3">
              Découvrir ma journée ✦
            </button>
            <button onClick={() => shareBig3(reveal)} className="text-night-300 hover:text-gold-400 text-sm py-2">
              Partager mon Big 3 →
            </button>
          </>
        );
      })()}
    </div>,
  ];

  return steps[step] || steps[0];
}
