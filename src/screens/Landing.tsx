/**
 * Landing — public marketing page shown instead of Auth when user
 * isn't logged in but has visited the app before (or directly via
 * ?landing=1 query param). Goal: convert to onboarding/signup.
 *
 * Sections:
 *   1. Hero (sun glyph + tagline + CTA)
 *   2. Features (3 cards: horoscope, compat, journal)
 *   3. Pricing teaser (39,99/an vs 6,99/sem with savings badge)
 *   4. Footer CTA + secondary auth link
 *
 * Style: same alchemical dark theme + gold accent as rest of app.
 * Animations: animate-fade-in, animate-fade-in-up for sections.
 */
import type { Screen } from '../App';

interface LandingProps {
  onStart: () => void;       // → onboarding (then auth)
  onLogin: () => void;       // → auth (login mode)
}

const FEATURES = [
  {
    symbol: '☉',
    title: 'Horoscope quotidien',
    desc: 'Lecture précise calculée par astronomy-engine, pas par template générique.',
  },
  {
    symbol: '☽',
    title: 'Compatibilité astrale',
    desc: 'Comparez votre ciel à celui d\'un proche : synastrie Lune, Vénus, Mars.',
  },
  {
    symbol: '✦',
    title: 'Journal alchimique',
    desc: 'Notez vos états et laissez l\'IA détecter vos cycles personnels.',
  },
];

const TESTIMONIALS = [
  { name: 'Camille', sign: '♏ Scorpion', text: 'Prédictions d\'une précision dérangeante.' },
  { name: 'Julien', sign: '♑ Capricorne', text: 'L\'app la plus sobre que j\'ai testée.' },
  { name: 'Inès', sign: '♊ Gémeaux', text: 'Le journal m\'a fait comprendre mes cycles.' },
];

export function Landing({ onStart, onLogin }: LandingProps) {
  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 relative overflow-x-hidden">
      {/* Top bar */}
      <header className="px-6 pt-6 pb-2 flex items-center justify-between relative z-10 animate-fade-in">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#c5a059" strokeWidth="0.6" opacity="0.6" />
            <circle cx="20" cy="20" r="10" fill="none" stroke="#c0c0c0" strokeWidth="0.5" opacity="0.4" />
            <circle cx="20" cy="3" r="1.4" fill="#e2c47c" />
            <circle cx="20" cy="20" r="2.5" fill="#d4ae5f" opacity="0.85" />
          </svg>
          <span className="font-display tracking-wider text-gold-gradient text-lg">Céleste</span>
        </div>
        <button
          onClick={onLogin}
          className="text-night-300 hover:text-gold-400 text-sm transition-colors px-3 py-1.5"
        >
          Connexion
        </button>
      </header>

      {/* Hero */}
      <section className="px-6 pt-10 pb-12 text-center relative z-10 animate-fade-in">
        <div className="inline-flex items-center justify-center w-28 h-28 rounded-full glass-gold border border-gold-500/30 mb-8 animate-float-slow">
          <svg width="64" height="64" viewBox="0 0 80 80" className="animate-spin-slow">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#c5a059" strokeWidth="0.5" opacity="0.5" />
            <circle cx="40" cy="40" r="24" fill="none" stroke="#c0c0c0" strokeWidth="0.5" opacity="0.35" />
            <circle cx="40" cy="6" r="2" fill="#e2c47c" />
            <circle cx="74" cy="40" r="1.4" fill="#c0c0c0" />
            <circle cx="40" cy="74" r="1.4" fill="#c0c0c0" />
            <circle cx="6" cy="40" r="1.4" fill="#c0c0c0" />
            <circle cx="40" cy="40" r="4" fill="#d4ae5f" opacity="0.85" />
          </svg>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-display text-gold-gradient mb-4 leading-tight">
          Votre destin,<br />gravé dans les étoiles
        </h1>
        <p className="text-night-300 text-base max-w-md mx-auto mb-10 font-body leading-relaxed">
          Carte du ciel calculée par éphémérides NASA, lectures hermétiques,
          compatibilités synastriques. L'astrologie comme elle aurait dû être.
        </p>
        <button
          onClick={onStart}
          className="w-full max-w-xs mx-auto block py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 text-night-950 font-semibold font-display tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-500/30"
        >
          Commencer gratuitement ✨
        </button>
        <p className="text-night-500 text-xs mt-3">
          Sans carte bancaire · 1 horoscope + 1 compatibilité offerts
        </p>
      </section>

      {/* Features */}
      <section className="px-6 py-8 relative z-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-night-500 text-center mb-6">
          Trois piliers
        </h2>
        <div className="grid gap-4 max-w-md mx-auto">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-5 border border-night-700 hover:border-gold-500/30 transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl text-gold-400 font-serif">{f.symbol}</div>
                <div>
                  <h3 className="text-night-100 font-semibold mb-1">{f.title}</h3>
                  <p className="text-night-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-8 relative z-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-night-500 text-center mb-6">
          Ce qu'ils en disent
        </h2>
        <div className="space-y-3 max-w-md mx-auto">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className="glass rounded-2xl p-4 border border-night-700 animate-fade-in-up"
              style={{ animationDelay: `${0.4 + i * 0.12}s` }}
            >
              <p className="text-night-200 text-sm italic leading-relaxed mb-2">
                « {t.text} »
              </p>
              <p className="text-night-500 text-xs">
                {t.name} · {t.sign}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="px-6 py-8 relative z-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-night-500 text-center mb-6">
          Tarif unique
        </h2>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <div className="glass rounded-2xl p-4 border border-night-700 text-center">
            <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Semaine</p>
            <p className="text-gold-400 text-2xl font-bold font-display">6,99 €</p>
          </div>
          <div className="glass-gold rounded-2xl p-4 border border-gold-500/50 text-center relative">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gold-500 text-night-950 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Économique
            </span>
            <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Année</p>
            <p className="text-gold-400 text-2xl font-bold font-display">39,99 €</p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 py-12 pb-16 relative z-10 text-center">
        <button
          onClick={onStart}
          className="w-full max-w-xs mx-auto block py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 text-night-950 font-semibold font-display tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-500/30"
        >
          Découvrir mon ciel ✨
        </button>
        <p className="text-night-500 text-xs mt-6">
          Déjà un compte ?{' '}
          <button
            onClick={onLogin}
            className="text-gold-400 hover:text-gold-300 underline-offset-2 hover:underline"
          >
            Se connecter
          </button>
        </p>
      </section>
    </div>
  );
}

export default Landing;