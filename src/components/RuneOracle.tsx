import { useState, useCallback, useRef, useEffect } from "react";
import {
  ELDER_FUTHARK,
  AETTIR,
  drawRunes,
  getRuneOfDay,
  RUNE_SPREADS,
  type RuneData,
} from "../data/runes";

interface DrawnRune {
  rune: RuneData;
  reversed: boolean;
  position?: string;
}

export default function RuneOracle() {
  const [mode, setMode] = useState<"intro" | "draw" | "result" | "aettir">(
    "intro"
  );
  const cleanupTimers = useRef<Set<number>>(new Set());

  useEffect(() => () => {
    cleanupTimers.current.forEach(clearTimeout);
    cleanupTimers.current.clear();
  }, []);
  const [selectedSpread, setSelectedSpread] = useState(0);
  const [drawnRunes, setDrawnRunes] = useState<DrawnRune[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [question, setQuestion] = useState("");

  const runeOfDay = getRuneOfDay();

  const startDraw = useCallback((spreadIdx: number) => {
    setSelectedSpread(spreadIdx);
    const spread = RUNE_SPREADS[spreadIdx];
    const runes = drawRunes(spread.count).map((r, i) => ({
      ...r,
      position: spread.positions[i],
    }));
    setDrawnRunes(runes);
    setRevealed(new Array(spread.count).fill(false));
    setMode("draw");
  }, []);

  const revealRune = (idx: number) => {
    setRevealed((prev) => {
      const next = [...prev];
      next[idx] = true;
      if (next.every(Boolean)) {
        const t = window.setTimeout(() => setMode("result"), 800);
        // Cleanup if component unmounts within 800ms
        cleanupTimers.current.add(t);
      }
      return next;
    });
  };

  const reset = () => {
    setMode("intro");
    setDrawnRunes([]);
    setRevealed([]);
    setQuestion("");
  };

  // === INTRO ===
  if (mode === "intro") {
    return (
      <div className="space-y-6">
        {/* Rune du jour */}
        <div className="glass-gold rounded-2xl p-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-500/70 mb-3">
            Rune du Jour
          </p>
          <div
            className="text-6xl mb-3"
            style={{
              transform: runeOfDay.reversed ? "rotate(180deg)" : "none",
              filter: "drop-shadow(0 0 12px rgba(234,179,8,0.3))",
            }}
          >
            {runeOfDay.rune.symbol}
          </div>
          <h3 className="text-xl font-serif text-night-100 mb-1">
            {runeOfDay.rune.name}
          </h3>
          <p className="text-sm text-night-300 italic mb-2">
            {runeOfDay.rune.meaning}
          </p>
          <p className="text-xs text-gold-400/80">
            {runeOfDay.reversed ? "Inverse" : "Droit"} - {runeOfDay.rune.keyword}
          </p>
        </div>

        {/* Choisir un tirage */}
        <div>
          <h3 className="text-sm uppercase tracking-widest text-night-400 mb-3 text-center">
            Choisir un tirage
          </h3>
          <div className="space-y-3">
            {RUNE_SPREADS.map((spread, i) => (
              <button
                key={i}
                onClick={() => startDraw(i)}
                className="w-full glass rounded-xl p-4 text-left hover:border-gold-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-serif text-night-100 text-lg">
                    {spread.name}
                  </span>
                  <span className="text-2xl opacity-50">
                    {"\u16A0".repeat(Math.min(spread.count, 3))}
                  </span>
                </div>
                <p className="text-xs text-night-400">{spread.description}</p>
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: spread.count }).map((_, j) => (
                    <span
                      key={j}
                      className="w-6 h-8 rounded border border-gold-500/30 flex items-center justify-center text-gold-500/50 text-xs"
                    >
                      ?
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Voir les Aettir */}
        <button
          onClick={() => setMode("aettir")}
          className="w-full text-center text-sm text-night-400 hover:text-gold-400 transition-colors"
        >
          Explorer les 3 Aettir (familles de runes) {"\u2192"}
        </button>
      </div>
    );
  }

  // === AETTIR VIEW ===
  if (mode === "aettir") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setMode("intro")}
          className="text-sm text-night-400 hover:text-gold-400"
        >
          {"\u2190"} Retour
        </button>
        {AETTIR.map((aett, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-gold-400 text-lg">{aett.name}</h3>
              <span className="text-xs text-night-400">Runes {aett.start}-{aett.end}</span>
            </div>
            <p className="text-xs text-night-400 mb-1">
              Divinite: {aett.deity}
            </p>
            <p className="text-xs text-night-300 italic mb-3">{aett.theme}</p>
            <div className="grid grid-cols-4 gap-2">
              {ELDER_FUTHARK.slice(aett.start - 1, aett.end).map((rune) => (
                <div
                  key={rune.id}
                  className="aspect-square rounded-lg bg-night-950/50 border border-gold-500/10 flex flex-col items-center justify-center hover:border-gold-500/40 transition-all"
                >
                  <span className="text-2xl text-night-100">
                    {rune.symbol}
                  </span>
                  <span className="text-[10px] text-night-400 mt-1">
                    {rune.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => setMode("intro")}
          className="w-full text-center text-sm text-night-400 hover:text-gold-400"
        >
          {"\u2190"} Retour au tirage
        </button>
      </div>
    );
  }

  // === DRAW (tirage) ===
  if (mode === "draw") {
    const spread = RUNE_SPREADS[selectedSpread];
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="font-serif text-xl text-night-100 mb-1">
            {spread.name}
          </h3>
          <p className="text-xs text-night-400">
            Touchez chaque pierre pour reveler sa rune
          </p>
        </div>

        {/* Question optionnelle */}
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pose ta question (optionnel)..."
          className="w-full glass rounded-xl px-4 py-2 text-sm text-night-100 placeholder-night-500 outline-none border-gold-500/20"
        />

        {/* Pierres a reveler */}
        <div className="space-y-4">
          {drawnRunes.map((dr, i) => (
            <div key={i}>
              {spread.count > 1 && (
                <p className="text-xs text-gold-500/60 mb-2 ml-1">
                  {dr.position}
                </p>
              )}
              <button
                onClick={() => revealRune(i)}
                disabled={revealed[i]}
                className={`w-full glass rounded-xl p-6 flex items-center justify-center transition-all ${
                  revealed[i]
                    ? "border-gold-500/40"
                    : "hover:border-gold-500/60 hover:scale-[1.02]"
                }`}
              >
                {revealed[i] ? (
                  <div className="text-center animate-pulse-once">
                    <div
                      className="text-5xl mb-2 text-night-100"
                      style={{
                        transform: dr.reversed ? "rotate(180deg)" : "none",
                        filter: "drop-shadow(0 0 10px rgba(234,179,8,0.3))",
                      }}
                    >
                      {dr.rune.symbol}
                    </div>
                    <p className="text-sm font-serif text-gold-400">
                      {dr.rune.name}
                    </p>
                    <p className="text-[10px] text-night-400 mt-1">
                      {dr.reversed ? "Inverse" : "Droit"}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-4xl opacity-30">
                      {"\u25CF"}
                    </div>
                    <p className="text-xs text-night-500 mt-2">
                      Pierre {i + 1} - Toucher pour reveler
                    </p>
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={reset}
          className="w-full text-center text-sm text-night-400 hover:text-gold-400"
        >
          Annuler
        </button>
      </div>
    );
  }

  // === RESULT ===
  return (
    <div className="space-y-5">
      {question && (
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-night-400 italic">"{question}"</p>
        </div>
      )}

      <div className="space-y-4">
        {drawnRunes.map((dr, i) => (
          <div
            key={i}
            className="glass-gold rounded-xl p-5 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            {RUNE_SPREADS[selectedSpread].count > 1 && (
              <p className="text-xs uppercase tracking-widest text-gold-500/70 mb-2">
                {dr.position}
              </p>
            )}
            <div className="flex items-start gap-4">
              {/* Symbole */}
              <div className="flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-xl bg-night-950/60 border border-gold-500/20 flex items-center justify-center"
                  style={{ transform: dr.reversed ? "rotate(180deg)" : "none" }}
                >
                  <span className="text-3xl text-night-100">
                    {dr.rune.symbol}
                  </span>
                </div>
              </div>
              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-serif text-lg text-gold-400">
                    {dr.rune.name}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-night-800 text-night-300">
                    {dr.reversed ? "Inverse" : "Droit"}
                  </span>
                </div>
                <p className="text-xs text-night-400 mb-2">
                  {dr.rune.meaning} - Element: {dr.rune.element}
                </p>
                <p className="text-sm text-night-200 leading-relaxed">
                  {dr.reversed ? dr.rune.reversed : dr.rune.upright}
                </p>
              </div>
            </div>
            {/* Correspondances astro */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="text-[10px] px-2 py-1 rounded-full bg-gold-500/10 text-gold-400/80">
                {dr.rune.planet}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-gold-500/10 text-gold-400/80">
                {dr.rune.zodiac}
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full bg-gold-500/10 text-gold-400/80">
                {dr.rune.element}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Poesie runique */}
      <div className="glass rounded-xl p-4 text-center">
        <p className="text-xs text-night-400 mb-2 uppercase tracking-widest">
          Poesie runique
        </p>
        <p className="text-sm text-night-300 italic leading-relaxed">
          {drawnRunes[0]?.rune.poetry}
        </p>
      </div>

      <button
        onClick={reset}
        className="w-full py-3 rounded-xl bg-gold-500/20 border border-gold-500/40 text-gold-400 hover:bg-gold-500/30 transition-all font-medium"
      >
        Nouveau tirage
      </button>
    </div>
  );
}
