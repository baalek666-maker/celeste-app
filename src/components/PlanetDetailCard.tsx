import { useState, useEffect, useRef } from 'react';
import type { ZodiacSign, Planet } from '../types';
import { api } from '../lib/api';
import { PLANET_DATA, ZODIAC_SIGNS } from '../data/zodiac';

interface Props {
  planet: Planet;
  sign: ZodiacSign;
  degree: number;
  house: number;
  retrograde: boolean;
}

interface Interpretation {
  planetName: string;
  symbol: string;
  sign: string;
  element: string;
  degreeStr: string;
  house: number;
  aspects: Array<{ otherName: string; aspectName: string; text: string; orb: number; color: string }>;
  general: string;
  inSign: string;
  // Backend renvoie un number ; accepté comme string pour rétro-compat
  degree?: string | number;
  degreeSymbolic?: string;
  temperament: string;
  characterology: string;
  keywords: string[];
}

export function PlanetDetailCard({ planet, sign, degree, house, retrograde }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Interpretation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const planetData = PLANET_DATA[planet];
  const signInfo = ZODIAC_SIGNS[sign];
  const signName = signInfo?.name || sign;
  const deg = Math.floor(degree);
  const min = Math.floor((degree - deg) * 60);

  useEffect(() => {
    if (expanded && !fetchedRef.current && !data) {
      fetchedRef.current = true;
      let alive = true;
      setLoading(true);
      api.getPlanetInterpretation(planet)
        .then(d => { if (alive) { setData(d); setError(null); } })
        .catch(e => { if (alive) { setError(e.message || 'Erreur'); fetchedRef.current = false; } })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }
  }, [expanded]);

  return (
    <div className="glass rounded-2xl overflow-hidden transition-all duration-300">
      {/* Header — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${planetData.color}18`, border: `1px solid ${planetData.color}33` }}
        >
          <span className="text-xl" style={{ color: planetData.color }}>{planetData.symbol}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-night-100 font-semibold">{planetData.name}</p>
            {retrograde && <span className="text-xs text-orange-400 font-mono">℞</span>}
          </div>
          <p className="text-night-400 text-sm">
            <span className="text-night-200">{signName}</span>
            {signInfo && ` ${signInfo.symbol}`} · {deg}°{String(min).padStart(2,'0')}' · M{house}
          </p>
        </div>
        <span className={`text-night-500 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>

      {/* Expanded body */}
      <div
        ref={bodyRef}
        className="overflow-hidden transition-all duration-400 ease-in-out"
        style={{
          maxHeight: expanded ? '6000px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 space-y-4">

          {loading && (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
              <p className="text-night-400 text-xs italic">Céleste médite sur cette planète…</p>
            </div>
          )}

          {error && (
            <div className="py-4 text-center">
              <p className="text-red-400/80 text-sm">{error}</p>
              <button
                onClick={() => { fetchedRef.current = false; setError(null); }}
                className="text-gold-400 text-xs mt-2 underline"
              >Réessayer</button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Quick badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge label={`Élément ${data.element || '?'}`} />
                <Badge label={`Maison ${house}`} />
                {data.temperament && <Badge label={`Tempérament: ${data.temperament}`} />}
              </div>

              {/* Aspects */}
              {data.aspects && data.aspects.length > 0 && (
                <div>
                  <SectionTitle>Aspects reçus</SectionTitle>
                  <div className="space-y-1.5 mt-2">
                    {data.aspects.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.03]"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: a.color }}
                        />
                        <span className="text-night-200 text-xs flex-1">{a.text}</span>
                        <span className="text-night-500 text-xs font-mono">
                          {a.orb > 0 ? '+' : ''}{a.orb.toFixed(1)}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* General meaning */}
              <div>
                <SectionTitle>
                  {data.planetName} <span className="text-night-500">en astrologie</span>
                </SectionTitle>
                <Paragraph text={data.general} />
              </div>

              {/* In sign */}
              <div>
                <SectionTitle>
                  {data.planetName} <span className="text-night-500">en {signName}</span>
                </SectionTitle>
                <Paragraph text={data.inSign} />
              </div>

              {/* Degree symbolism */}
              {data.degreeSymbolic && (
                <div>
                  <SectionTitle>
                    Degré symbolique <span className="text-night-500">{deg}° {signName}</span>
                  </SectionTitle>
                  <Paragraph text={data.degreeSymbolic} />
                </div>
              )}

              {/* Keywords */}
              {data.keywords && data.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.04]">
                  {data.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-gold-500/8 border border-gold-500/15 text-gold-400/80 text-xs"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-night-300 text-xs">
      {label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-gold-400/90 text-sm font-semibold mb-1.5 mt-1">{children}</h4>
  );
}

function Paragraph({ text }: { text: string | number }) {
  return (
    <p className="text-night-300 text-sm leading-relaxed">
      {text}
    </p>
  );
}
