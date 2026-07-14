import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

type Section = { heading: string; paragraphs: string[] };

/** Parse the portrait markdown: ## headings + paragraph bodies. No deps. */
function parsePortrait(md: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  let para = '';
  const flush = () => {
    const t = para.trim();
    if (t && cur) cur.paragraphs.push(t);
    para = '';
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      flush();
      if (cur) out.push(cur);
      cur = { heading: line.slice(3).trim(), paragraphs: [] };
    } else if (line.trim() === '') {
      flush();
    } else {
      if (!cur) cur = { heading: '', paragraphs: [] };
      para += (para ? ' ' : '') + line.trim();
    }
  }
  flush();
  if (cur) out.push(cur);
  return out;
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 animate-fade-in">
      <div className="relative w-36 h-36 mb-10">
        {/* ambient gold glow */}
        <div className="absolute inset-0 rounded-full bg-gold-500/20 blur-2xl animate-gold-glow" />
        {/* outer rotating dashed ring (animate-spin guarantees keyframes; duration overridden) */}
        <svg className="absolute inset-0 animate-spin [animation-duration:9s]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(197,160,89,0.4)" strokeWidth="0.6" strokeDasharray="1.5 5" />
        </svg>
        {/* inner counter-rotating ring */}
        <svg className="absolute inset-0 animate-spin [animation-duration:16s] [animation-direction:reverse]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(226,196,124,0.28)" strokeWidth="0.5" strokeDasharray="0.5 7" />
        </svg>
        {/* cardinal tick marks */}
        <svg className="absolute inset-0" viewBox="0 0 100 100">
          {[0, 90, 180, 270].map((d) => (
            <line key={d} x1="50" y1="3" x2="50" y2="8.5" stroke="rgba(197,160,89,0.6)" strokeWidth="0.9" transform={`rotate(${d} 50 50)`} />
          ))}
        </svg>
        {/* central pulsing star */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gold-300 text-4xl animate-twinkle drop-shadow-[0_0_14px_rgba(197,160,89,0.75)]">✦</span>
        </div>
        {/* orbiting mote */}
        <div className="absolute inset-0 animate-spin [animation-duration:6s]">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 text-gold-400 text-[9px]">✦</span>
        </div>
      </div>
      <p className="font-display text-night-100 tracking-wide text-center px-8">
        Les étoiles rédigent votre portrait…
      </p>
      <div className="flex gap-1.5 mt-4">
        <span className="splash-dot" style={{ animationDelay: '0s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.2s' }} />
        <span className="splash-dot" style={{ animationDelay: '0.4s' }} />
      </div>
      <p className="text-night-500 text-xs mt-6 tracking-wider">Un instant de patience</p>
    </div>
  );
}

export default function AstroPortrait({ onBack }: { onBack?: () => void } = {}) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAstroPortrait();
      setSections(parsePortrait(res.portrait));
      setWordCount(res.wordCount);
      setCached(res.cached);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Les étoiles sont voilées pour l’instant.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) load();
    return () => { cancelled = true; };
  }, [load]);

  const back = () => {
    if (onBack) onBack();
    else window.history.back();
  };

  return (
    <div className="page-transition min-h-screen pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 glass-dark px-5 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={back} aria-label="Retour"
            className="text-gold-400 text-sm hover:text-gold-300 transition-colors">‹ Retour</button>
          <h1 className="font-display text-lg font-semibold text-gold-gradient tracking-[0.18em]">PORTRAIT ASTRAL</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5">
        {error && !loading && (
          <div className="flex flex-col items-center py-28 animate-fade-in text-center">
            <span className="text-4xl text-gold-500/60 mb-4 animate-twinkle">✦</span>
            <p className="text-night-300 mb-6 max-w-xs">{error}</p>
            <button onClick={load}
              className="px-8 py-3 rounded-2xl glass-gold border border-gold-500/30 text-gold-200 font-medium hover:border-gold-500/60 active:scale-[0.98] transition-all">
              Réessayer
            </button>
          </div>
        )}

        {loading && <LoadingState />}

        {sections && !loading && !error && (
          <article className="animate-fade-in pt-9">
            {/* opening ornament */}
            <div className="flex flex-col items-center mb-11">
              <span className="text-gold-400 text-2xl animate-twinkle">✦</span>
              <div className="w-44 mt-3 ornament-divider" />
            </div>

            {sections.map((s, i) => (
              <section key={i} className="mb-12 last:mb-0">
                {s.heading && (
                  <>
                    <h2 className="font-display text-2xl md:text-[1.7rem] leading-snug text-gold-gradient mb-4">
                      {s.heading}
                    </h2>
                    <div className="ornament-divider mb-6">
                      <span className="text-gold-500/70 text-[0.6rem]">✦</span>
                    </div>
                  </>
                )}
                {s.paragraphs.map((p, j) => (
                  <p key={j}
                    className={`font-body text-night-100/90 text-[1.13rem] leading-[1.95] mb-5 ${i === 0 && j === 0 ? 'drop-cap' : ''}`}>
                    {p}
                  </p>
                ))}
              </section>
            ))}

            {/* colophon / word-count badge */}
            <div className="mt-12 ornament-divider mb-5" />
            <div className="flex items-center justify-center gap-3 text-xs text-night-500 tracking-wide">
              <span>~{wordCount.toLocaleString('fr-FR')} mots</span>
              {cached && (
                <>
                  <span className="text-night-700">·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-leaf-500" /> lu récemment
                  </span>
                </>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
