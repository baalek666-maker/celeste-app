import { useState, useEffect, useMemo, useCallback } from 'react';
import { HEXAGRAMS, TRIGRAMS, hexagramFromLines, type Hexagram } from '../data/yijing';

// ─── Helpers ────────────────────────────────────────────────
function castLine(): { value: number; type: 'young_yang' | 'young_yin' | 'old_yang' | 'old_yin'; label: string } {
  // 3 coins. Heads (yang) = 3, Tails (yin) = 2. Sum 6/8 = yin, 7/9 = yang. 6/9 are old (changing).
  const coins = [Math.random() < 0.5 ? 2 : 3, Math.random() < 0.5 ? 2 : 3, Math.random() < 0.5 ? 2 : 3];
  const sum = coins.reduce((a, b) => a + b, 0);
  if (sum === 6) return { value: 0, type: 'old_yin', label: 'Yin mutant' };
  if (sum === 8) return { value: 0, type: 'young_yin', label: 'Yin' };
  if (sum === 7) return { value: 1, type: 'young_yang', label: 'Yang' };
  return { value: 1, type: 'old_yang', label: 'Yang mutant' };
}

function dailyHexagram(date = new Date()): Hexagram {
  // Deterministic from date: year + day-of-year
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const id = ((date.getFullYear() * 367 + dayOfYear) % 64) + 1;
  return HEXAGRAMS.find(h => h.id === id) || HEXAGRAMS[0];
}

function renderHexagram(lines: number[], highlightChanging?: number[]) {
  // lines[0] = bottom, lines[5] = top
  return (
    <div className="flex flex-col gap-1.5 items-center">
      {[5, 4, 3, 2, 1, 0].map((idx) => {
        const isYang = lines[idx] === 1;
        const isChanging = highlightChanging?.includes(idx);
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className={`relative ${isYang ? 'w-24 h-2' : 'w-24 h-2 flex justify-between'} ${
              isChanging ? 'animate-pulse' : ''
            }`}>
              {isYang ? (
                <div className={`w-full h-full rounded-full ${isChanging ? 'bg-gold-300 shadow-[0_0_12px_rgba(226,196,124,0.7)]' : 'bg-gold-500'}`} />
              ) : (
                <>
                  <div className={`w-[42%] h-full rounded-full ${isChanging ? 'bg-gold-300 shadow-[0_0_12px_rgba(226,196,124,0.7)]' : 'bg-gold-500'}`} />
                  <div className={`w-[42%] h-full rounded-full ${isChanging ? 'bg-gold-300 shadow-[0_0_12px_rgba(226,196,124,0.7)]' : 'bg-gold-500'}`} />
                </>
              )}
            </div>
            {isChanging && (
              <span className="text-gold-300 text-[10px] font-bold w-3">⚡</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────
type Mode = 'overview' | 'oracle' | 'cast' | 'detail';

export function YiJingOracle() {
  const [mode, setMode] = useState<Mode>('overview');
  const todayHex = useMemo(() => dailyHexagram(), []);
  const [castLines, setCastLines] = useState<{ value: number; type: string; label: string }[]>([]);
  const [currentThrow, setCurrentThrow] = useState(0);
  const [isThrowing, setIsThrowing] = useState(false);
  const [selectedHex, setSelectedHex] = useState<Hexagram | null>(null);

  const changingLines = useMemo(() => {
    return castLines
      .map((l, i) => (l.type === 'old_yang' || l.type === 'old_yin' ? i : -1))
      .filter(i => i >= 0);
  }, [castLines]);

  const mainHexagram = useMemo(() => {
    if (castLines.length !== 6) return null;
    const lines = castLines.map(l => l.value);
    const id = hexagramFromLines(lines);
    return HEXAGRAMS.find(h => h.id === id) || HEXAGRAMS[0];
  }, [castLines]);

  const transformedHexagram = useMemo(() => {
    if (!changingLines.length) return null;
    const lines = castLines.map((l, i) => {
      if (changingLines.includes(i)) return l.value === 1 ? 0 : 1;
      return l.value;
    });
    const id = hexagramFromLines(lines);
    return HEXAGRAMS.find(h => h.id === id) || HEXAGRAMS[0];
  }, [castLines, changingLines]);

  const startCast = useCallback(() => {
    setCastLines([]);
    setCurrentThrow(0);
    setIsThrowing(true);
  }, []);

  const throwNext = useCallback(() => {
    if (currentThrow >= 6) return;
    const line = castLine();
    setCastLines(prev => [...prev, line]);
    setCurrentThrow(prev => prev + 1);
  }, [currentThrow]);

  useEffect(() => {
    if (isThrowing && currentThrow < 6) {
      const t = setTimeout(() => throwNext(), 700);
      return () => clearTimeout(t);
    } else if (isThrowing && currentThrow >= 6) {
      setIsThrowing(false);
    }
  }, [isThrowing, currentThrow, throwNext]);

  // ─── OVERVIEW ───────────────────────────────────────────────
  if (mode === 'overview') {
    return (
      <div className="px-5 pt-12 pb-6 page-transition">
        <div className="mb-6 animate-fade-in">
          <p className="text-night-400 text-xs uppercase tracking-widest mb-1">Oracle de Chine</p>
          <h1 className="text-2xl font-bold text-gold-gradient mb-2">Yi Jing</h1>
          <p className="text-night-300 text-sm">
            Le Livre des Mutations, croise avec ton ciel natal.
          </p>
        </div>

        {/* Hexagramme du jour */}
        <button
          onClick={() => { setSelectedHex(todayHex); setMode('detail'); }}
          className="w-full glass-gold rounded-2xl p-5 mb-4 border border-gold-500/30 hover:border-gold-500/60 transition-all text-left animate-fade-in"
          style={{ animationDelay: '0.05s' }}
        >
          <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Hexagramme du jour</p>
          <div className="flex items-center gap-5">
            <div className="flex-shrink-0">
              {renderHexagram([
                ...TRIGRAMS[todayHex.lower].lines,
                ...TRIGRAMS[todayHex.upper].lines,
              ])}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gold-300 font-display text-lg">{todayHex.name}</p>
              <p className="text-night-400 text-xs italic mb-2">{todayHex.pinyin} - {todayHex.id}/64</p>
              <p className="text-night-200 text-xs leading-relaxed line-clamp-3">{todayHex.judgment}</p>
            </div>
          </div>
        </button>

        {/* Tirage */}
        <button
          onClick={() => { startCast(); setMode('cast'); }}
          className="w-full glass rounded-2xl p-5 mb-4 border border-transparent hover:border-gold-500/30 transition-all text-left animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl glass-gold flex items-center justify-center flex-shrink-0">
              <span className="text-2xl text-gold-400">☰</span>
            </div>
            <div className="flex-1">
              <p className="text-night-100 font-semibold text-base">Tirage a 3 pieces</p>
              <p className="text-night-400 text-xs mt-0.5">Consulte l'oracle sur une question</p>
            </div>
            <span className="text-night-500">→</span>
          </div>
        </button>

        {/* Info Bagua */}
        <div className="glass rounded-2xl p-5 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Les 8 Trigrammes</p>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(TRIGRAMS).map(([key, t]) => (
              <div key={key} className="text-center">
                <div className="text-xl mb-1">{t.symbol}</div>
                <p className="text-gold-400 text-[10px] font-semibold">{t.name}</p>
                <p className="text-night-400 text-[9px]">{t.planet}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── CAST ───────────────────────────────────────────────────
  if (mode === 'cast') {
    return (
      <div className="px-5 pt-12 pb-6 page-transition">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('overview')} className="text-gold-400 text-sm">‹ Retour</button>
          <h1 className="text-xl font-bold text-gold-gradient">Tirage Yi Jing</h1>
        </div>

        <div className="glass rounded-2xl p-6 mb-4 text-center">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Lignes jetees</p>
          <p className="text-gold-300 text-3xl font-display mb-3">{currentThrow}/6</p>
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${
                i < currentThrow ? 'bg-gold-500' : 'bg-night-700'
              }`} />
            ))}
          </div>
          {isThrowing ? (
            <p className="text-night-300 text-sm italic">Les pieces roulent...</p>
          ) : currentThrow < 6 ? (
            <button
              onClick={throwNext}
              className="px-6 py-3 glass-gold rounded-full text-gold-300 text-sm font-semibold border border-gold-500/40 hover:border-gold-500/70 transition-all"
            >
              Lancer les pieces
            </button>
          ) : (
            <p className="text-gold-400 text-sm">Tirage termine</p>
          )}
        </div>

        {mainHexagram && (
          <div className="space-y-4">
            <button
              onClick={() => { setSelectedHex(mainHexagram); setMode('detail'); }}
              className="w-full glass-gold rounded-2xl p-5 border border-gold-500/30 text-left hover:border-gold-500/60 transition-all"
            >
              <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Hexagramme principal</p>
              <div className="flex items-center gap-5 mb-3">
                <div className="flex-shrink-0">
                  {renderHexagram([
                    ...TRIGRAMS[mainHexagram.lower].lines,
                    ...TRIGRAMS[mainHexagram.upper].lines,
                  ], changingLines)}
                </div>
                <div className="flex-1">
                  <p className="text-gold-300 font-display text-lg">{mainHexagram.name}</p>
                  <p className="text-night-400 text-xs italic mb-2">{mainHexagram.pinyin} - {mainHexagram.id}/64</p>
                  <p className="text-night-200 text-xs leading-relaxed">{mainHexagram.judgment}</p>
                </div>
              </div>
              {changingLines.length > 0 && (
                <p className="text-night-400 text-xs">
                  ⚡ {changingLines.length} ligne{changingLines.length > 1 ? 's' : ''} mutante{changingLines.length > 1 ? 's' : ''}
                </p>
              )}
            </button>

            {transformedHexagram && (
              <button
                onClick={() => { setSelectedHex(transformedHexagram); setMode('detail'); }}
                className="w-full glass rounded-2xl p-5 border border-transparent hover:border-gold-500/30 transition-all text-left"
              >
                <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Hexagramme transforme</p>
                <div className="flex items-center gap-5">
                  <div className="flex-shrink-0">
                    {renderHexagram([
                      ...TRIGRAMS[transformedHexagram.lower].lines,
                      ...TRIGRAMS[transformedHexagram.upper].lines,
                    ])}
                  </div>
                  <div className="flex-1">
                    <p className="text-gold-300 font-display text-lg">{transformedHexagram.name}</p>
                    <p className="text-night-400 text-xs italic mb-2">{transformedHexagram.pinyin} - {transformedHexagram.id}/64</p>
                    <p className="text-night-200 text-xs leading-relaxed">{transformedHexagram.judgment}</p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={startCast}
              className="w-full py-3 text-night-400 text-xs border border-night-700 rounded-full hover:border-gold-500/40 hover:text-gold-400 transition-all"
            >
              Nouveau tirage
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── DETAIL ─────────────────────────────────────────────────
  if (mode === 'detail' && selectedHex) {
    const h = selectedHex;
    const lowerT = TRIGRAMS[h.lower];
    const upperT = TRIGRAMS[h.upper];
    return (
      <div className="px-5 pt-12 pb-6 page-transition">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode(castLines.length ? 'cast' : 'overview')} className="text-gold-400 text-sm">
            ‹ Retour
          </button>
          <h1 className="text-xl font-bold text-gold-gradient">{h.name}</h1>
        </div>

        <div className="glass-gold rounded-2xl p-6 mb-4 text-center border border-gold-500/30">
          {renderHexagram([
            ...TRIGRAMS[h.lower].lines,
            ...TRIGRAMS[h.upper].lines,
          ], changingLines)}
          <p className="text-gold-300 font-display text-2xl mt-4">{h.name}</p>
          <p className="text-night-400 text-sm italic">{h.pinyin} - Hexagramme {h.id} / 64</p>
          <p className="text-night-300 text-xs mt-2">{h.keywords}</p>
        </div>

        <div className="glass rounded-2xl p-5 mb-4">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Oracle</p>
          <p className="text-night-100 text-sm leading-relaxed">{h.judgment}</p>
        </div>

        <div className="glass rounded-2xl p-5 mb-4">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-2">Image</p>
          <p className="text-night-300 text-sm italic leading-relaxed">{h.image}</p>
        </div>

        {/* Cross-référence astrologique */}
        <div className="glass-gold rounded-2xl p-5 mb-4 border border-gold-500/20">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Croisement astrologique</p>
          <div className="flex items-center justify-around mb-4">
            <div className="text-center">
              <p className="text-2xl text-gold-300 mb-1">{lowerT.symbol}</p>
              <p className="text-gold-400 text-xs font-semibold">{lowerT.name}</p>
              <p className="text-night-300 text-[10px] mt-1">{lowerT.planet}</p>
              <p className="text-night-300 text-[10px]">{lowerT.sign}</p>
            </div>
            <div className="text-night-500 text-xl">+</div>
            <div className="text-center">
              <p className="text-2xl text-gold-300 mb-1">{upperT.symbol}</p>
              <p className="text-gold-400 text-xs font-semibold">{upperT.name}</p>
              <p className="text-night-300 text-[10px] mt-1">{upperT.planet}</p>
              <p className="text-night-300 text-[10px]">{upperT.sign}</p>
            </div>
          </div>
          <p className="text-night-200 text-sm leading-relaxed border-t border-gold-500/10 pt-3">{h.astro}</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-night-400 text-xs uppercase tracking-wider mb-3">Les 2 trigrammes</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-night-300">Superieur</span>
              <span className="text-gold-400">{upperT.name} ({upperT.element})</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-night-300">Inferieur</span>
              <span className="text-gold-400">{lowerT.name} ({lowerT.element})</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-night-300">Direction</span>
              <span className="text-gold-400">{upperT.direction} / {lowerT.direction}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
