import { useState } from 'react';

type Aspect = {
  transitPlanet: string;
  natalPlanet: string;
  transitPlanetFr: string;
  natalPlanetFr: string;
  transitGlyph: string;
  natalGlyph: string;
  aspect: string;
  aspectFr: string;
  aspectGlyph: string;
  nature: 'tension' | 'harmonique' | 'neutre';
  orb: number;
  exact: boolean;
  transitRetrograde: boolean;
  interpretation: string;
  conseil: string;
};

type HouseData = {
  num: number;
  theme: string;
  icon: string;
  short: string;
  sign: string;
  activated: boolean;
  natalPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean }>;
  transitPlanets: Array<{ key: string; name: string; glyph: string; sign: string; degree: number; retrograde?: boolean }>;
  insight: string;
  action: string;
};

const NATURE_STYLE: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  tension:    { bg: 'from-rose-500/40 to-orange-500/30',  text: 'text-rose-300', label: 'Défi', emoji: '⚡' },
  harmonique: { bg: 'from-emerald-500/40 to-teal-500/30', text: 'text-emerald-300', label: 'Flow', emoji: '✨' },
  neutre:     { bg: 'from-violet-500/40 to-indigo-500/30', text: 'text-violet-300', label: 'Activation', emoji: '🌑' },
};

function makeHeroTitle(interpretation: string): string {
  if (!interpretation) return "Le ciel t'écoute";
  const firstSentence = interpretation.split(/[,.!?]/)[0]?.trim() || interpretation;
  const words = firstSentence.split(/\s+/);
  if (words.length <= 5) return firstSentence;
  return words.slice(0, 4).join(' ') + '…';
}

function makeHeroSubtitle(interpretation: string): string {
  if (!interpretation) return '';
  const sentences = interpretation.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
  return sentences.sort((a, b) => a.length - b.length)[0] || sentences[0] || '';
}

export default function TransitShare({
  aspect, house, dateFormatted, onClose,
}: {
  aspect?: Aspect;
  house?: HouseData | null;
  dateFormatted: string;
  onClose: () => void;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  if (!aspect && !house) return null;

  // Construit le texte à partager
  let shareText = '';
  if (aspect) {
    const style = NATURE_STYLE[aspect.nature] || NATURE_STYLE.neutre;
    shareText = `${style.emoji} ${aspect.transitPlanetFr} ${aspect.aspectFr} mon ${aspect.natalPlanetFr}\n\n`;
    shareText += `${makeHeroTitle(aspect.interpretation)}\n\n`;
    shareText += `${makeHeroSubtitle(aspect.interpretation)}\n\n`;
    if (aspect.conseil) shareText += `💡 ${aspect.conseil}\n\n`;
    if (house) shareText += `${house.icon} Maison ${house.num} — ${house.theme}\n\n`;
    shareText += `— Céleste 🌙 ${dateFormatted}`;
  } else if (house) {
    shareText = `${house.icon} Maison ${house.num} — ${house.theme}\n\n`;
    shareText += `${house.insight}\n\n`;
    if (house.action) shareText += `→ ${house.action}\n\n`;
    shareText += `— Céleste 🌙 ${dateFormatted}`;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopyState('copied'); setTimeout(() => setCopyState('idle'), 2000); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  const handleShareNative = async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Céleste — Mon ciel aujourd'hui", text: shareText });
        onClose();
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  const style = aspect ? (NATURE_STYLE[aspect.nature] || NATURE_STYLE.neutre) : null;

  return (
    <div className="fixed inset-0 z-[10000] bg-celeste-bg/95 backdrop-blur-md flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div
        className="bg-celeste-bg border-t sm:border border-cosmic-500/30 sm:rounded-2xl rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-celeste-bg/95 backdrop-blur-md border-b border-celeste-primary/15 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-cosmic-gradient">Partager</h3>
          <button onClick={onClose} className="text-celeste-text/60 text-2xl">×</button>
        </div>

        {/* Preview 9:16 (story format) */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-celeste-text/50 text-[10px] uppercase tracking-wider mb-2">Aperçu story 9:16</p>
          <div className={`relative w-full mx-auto rounded-2xl overflow-hidden bg-gradient-to-br ${style?.bg || 'from-cosmic-500/30 to-celeste-primary/20'}`} style={{ aspectRatio: '9/16', maxWidth: '280px' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="flex items-center gap-3 text-4xl mb-4">
                {aspect ? (
                  <>
                    <span className="animate-glow">{aspect.transitGlyph}</span>
                    <span className={`text-3xl ${style?.text || 'text-cosmic-300'}`}>{aspect.aspectGlyph}</span>
                    <span>{aspect.natalGlyph}</span>
                  </>
                ) : (
                  <span className="animate-glow">{house?.icon}</span>
                )}
              </div>
              <div className="w-16 h-16 rounded-full glass-gold flex items-center justify-center mb-4 animate-glow">
                <span className="text-3xl">{style?.emoji || '🏠'}</span>
              </div>
              <h4 className="text-lg font-bold text-cosmic-gradient mb-2 leading-tight">
                {aspect ? makeHeroTitle(aspect.interpretation) : `Maison ${house?.num}`}
              </h4>
              {aspect && (
                <p className="text-xs text-celeste-text/85 leading-relaxed mb-3 line-clamp-4">
                  {makeHeroSubtitle(aspect.interpretation)}
                </p>
              )}
              {house && !aspect && (
                <p className="text-xs text-celeste-text/85 leading-relaxed mb-3 line-clamp-4">
                  {house?.theme}
                </p>
              )}
              <p className="text-[10px] text-celeste-text/50 mt-auto">Céleste 🌙</p>
            </div>
          </div>
        </div>

        {/* Text preview */}
        <div className="px-5 py-3">
          <p className="text-celeste-text/50 text-[10px] uppercase tracking-wider mb-2">Texte à partager</p>
          <div className="rounded-xl bg-celeste-bg/50 border border-celeste-primary/15 p-3 max-h-40 overflow-y-auto">
            <pre className="text-xs text-celeste-text/85 whitespace-pre-wrap font-sans leading-relaxed">{shareText}</pre>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
          <button
            onClick={handleShareNative}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cosmic-600 to-cosmic-700 text-white font-semibold text-sm shadow-lg"
          >
            📤 Partager
          </button>
          <button
            onClick={handleCopy}
            className="w-full py-3 rounded-2xl glass border border-cosmic-500/30 hover:border-cosmic-500/60 text-celeste-text/85 font-medium text-sm transition-all"
          >
            {copyState === 'copied' ? '✓ Copié !' : '📋 Copier le texte'}
          </button>
        </div>
      </div>
    </div>
  );
}
