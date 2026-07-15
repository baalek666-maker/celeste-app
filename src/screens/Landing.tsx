/**
 * Landing — premium public marketing page.
 *
 * Voice Mining Framework v2.0 applied:
 *   - Zero mention of "IA" / "AI" (ai-fatigue = theme #1, 35% of reviews)
 *   - Zero jargon ("hermétique", "synastrique", "alchimique") — speak human
 *   - Accuracy-first messaging ("creepy accurate" = retention driver, 12%)
 *   - Warm tone (CHANI gold standard), not cold/aggressive (Co-Star anti-pattern)
 *   - Anti-generic differentiation throughout
 *
 * Sections:
 *   1. Hero (animated logo + tagline + trust badge + CTA)
 *   2. Stat strip (NASA-grade, 12 signes, temps réel)
 *   3. Features (3 pillars)
 *   4. How it works (3 steps)
 *   5. Testimonials
 *   6. Pricing teaser (annual vs weekly)
 *   7. Footer CTA + auth link
 */
import type { Screen } from '../App';
import CelesteLogo from '../components/CelesteLogo';

interface LandingProps {
  onStart: () => void;
  onLogin: () => void;
  onGuest: () => void;
}

const STATS = [
  { num: 'NASA', label: 'Données officielles' },
  { num: '12', label: 'Signes · Ascendant · Lune' },
  { num: '∞', label: 'Lectures uniques' },
];

const FEATURES = [
  {
    glyph: '☉',
    title: 'Horoscope vraiment personnel',
    desc: "Calculé depuis ton date, heure et lieu de naissance. Pas de texte recyclé — chaque lecture parle de tes planètes, pas de ton seul signe.",
    accent: 'gold',
  },
  {
    glyph: '☥',
    title: 'Compatibilité amoureuse',
    desc: "Découvre pourquoi certains tu attirent et d'autres pas. Vénus, Mars, Lune — la chimie entre deux personnes, expliquée simplement.",
    accent: 'silver',
  },
  {
    glyph: '✦',
    title: 'Journal de bord',
    desc: "Note tes ressentis au fil des jours. Céleste repère tes cycles émotionnels et les résonances planétaires qui les accompagnent.",
    accent: 'gold',
  },
];

const STEPS = [
  { num: '01', title: 'Ta naissance', desc: 'Date, heure et lieu. Trois infos pour calculer ton ciel à la minute près.' },
  { num: '02', title: 'Ta carte du ciel', desc: 'Soleil, Lune, Ascendant — ton thème natal, astronomiquement exact.' },
  { num: '03', title: 'Ton quotidien', desc: "Chaque jour, lisez ce que les planètes activent vraiment en toi." },
];

const TESTIMONIALS = [
  { name: 'Camille', sign: '♏', role: 'Scorpion', text: "D'une précision bluffante. Le transit de Saturne m'a prévenue deux mois à l'avance d'un bouleversement." },
  { name: 'Julien', sign: '♑', role: 'Capricorne', text: "L'app la plus juste que j'ai testée. On dirait qu'elle me connaît vraiment." },
  { name: 'Inès', sign: '♊', role: 'Gémeaux', text: "Le portrait astral m'a fait pleurer. C'est comme si quelqu'un me lisait de l'intérieur." },
];

export function Landing({ onStart, onLogin, onGuest }: LandingProps) {
  return (
    <div className="cosmic-bg star-field min-h-screen text-night-100 relative overflow-x-hidden">
      {/* Aurora overlay */}
      <div className="fixed inset-0 aurora-bg pointer-events-none" />

      {/* ── Top bar ── */}
      <header className="px-6 pt-6 pb-2 flex items-center justify-between relative z-10 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <CelesteLogo size={28} />
          <span className="font-display tracking-wider text-gold-gradient text-lg">Céleste</span>
        </div>
        <button
          onClick={onLogin}
          className="text-night-300 hover:text-gold-400 text-sm transition-colors px-4 py-2 rounded-full glass border border-gold-500/15 hover:border-gold-500/30"
        >
          Connexion
        </button>
      </header>

      {/* ── Hero ── */}
      <section className="px-6 pt-8 pb-10 text-center relative z-10">
        {/* Animated logo */}
        <div className="relative inline-block mb-8 animate-fade-in-scale">
          <div className="absolute inset-0 -m-8 rounded-full ripple-gold opacity-40" />
          <CelesteLogo size={120} animated />
        </div>

        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-gold border border-gold-500/20 mb-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] text-night-300 uppercase tracking-wider">Données astronomiques NASA · mises à jour en temps réel</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold font-display text-gold-gradient mb-4 leading-tight animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Ton ciel,<br />ton miroir
        </h1>
        <p className="text-night-300 text-base max-w-md mx-auto mb-10 font-body leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
          Une carte du ciel calculée aux données astronomiques NASA. Des lectures qui parlent de toi, pas d'un signe générique. L'astrologie comme elle aurait dû être.
        </p>
        <button
          onClick={onStart}
          className="group relative w-full max-w-xs mx-auto block py-4 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold font-display tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-500/30 animate-fade-in-up overflow-hidden"
          style={{ animationDelay: '0.5s' }}
        >
          <span className="relative z-10">Commencer mon thème ✨</span>
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        </button>
        <p className="text-night-500 text-xs mt-3 animate-fade-in" style={{ animationDelay: '0.65s' }}>
          Sans carte bancaire · 1 horoscope + 1 compatibilité offerts
        </p>
        <button
          onClick={onGuest}
          className="block mx-auto mt-4 text-night-400 hover:text-night-200 text-sm transition-colors animate-fade-in"
          style={{ animationDelay: '0.75s' }}
        >
          Explorer d'abord →
        </button>
      </section>

      {/* ── Stat strip ── */}
      <section className="px-6 py-6 relative z-10 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="glass rounded-xl p-3 text-center border border-night-800/50">
              <p className="text-gold-400 text-lg font-bold font-display">{s.num}</p>
              <p className="text-night-500 text-[9px] uppercase tracking-wider leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-8 relative z-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-night-500 text-center mb-6">
          Trois piliers
        </h2>
        <div className="grid gap-4 max-w-md mx-auto">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-5 border border-night-700 hover:border-gold-500/30 transition-all animate-fade-in-up group"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div className="flex items-start gap-4">
                <div className={`text-3xl ${f.accent === 'gold' ? 'text-gold-400' : 'text-night-300'} font-serif group-hover:scale-110 transition-transform`}>
                  {f.glyph}
                </div>
                <div>
                  <h3 className="text-night-100 font-semibold mb-1">{f.title}</h3>
                  <p className="text-night-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-8 relative z-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-night-500 text-center mb-6">
          Comment ça marche
        </h2>
        <div className="space-y-3 max-w-md mx-auto">
          {STEPS.map((s, i) => (
            <div
              key={s.num}
              className="flex items-start gap-4 animate-fade-in-up"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div className="text-2xl font-display font-bold text-gold-500/30 shrink-0 w-12">{s.num}</div>
              <div className="glass rounded-xl p-4 border border-night-800/50 flex-1">
                <h3 className="text-night-100 font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-night-400 text-xs leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="px-6 py-8 relative z-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-night-500 text-center mb-6">
          Ce qu'ils en disent
        </h2>
        <div className="space-y-3 max-w-md mx-auto">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className="glass rounded-2xl p-4 border border-night-700 animate-fade-in-up"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full glass-gold flex items-center justify-center text-lg shrink-0">
                  {t.sign}
                </div>
                <div className="flex-1">
                  <p className="text-night-200 text-sm italic leading-relaxed mb-2">« {t.text} »</p>
                  <p className="text-night-500 text-xs">{t.name} · {t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
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

      {/* ── Footer CTA ── */}
      <section className="px-6 py-12 pb-16 relative z-10 text-center">
        <div className="inline-flex items-center justify-center mb-6 animate-breathe">
          <CelesteLogo size={56} />
        </div>
        <button
          onClick={onStart}
          className="group relative w-full max-w-xs mx-auto block py-4 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-600 text-night-950 font-semibold font-display tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-500/30 overflow-hidden"
        >
          <span className="relative z-10">Découvrir mon ciel ✨</span>
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
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
        <p className="text-night-600 text-[10px] mt-4 font-body">
          Céleste · Ton ciel, ton miroir
        </p>
      </section>
    </div>
  );
}

export default Landing;
