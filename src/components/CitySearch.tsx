/**
 * CitySearch — composant de recherche de ville via OSM Nominatim (P0#2).
 *
 * Remplace la liste de 117 villes hardcodées. Permet à n'importe quel user
 * francophone (Sénégal, Liban, Vietnam, Antilles...) de trouver son lieu
 * de naissance.
 *
 * Debounce 400ms + AbortController pour respecter la politique OSM (1 req/sec).
 */

import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type GeoPlace } from '../lib/geocode';

interface CitySearchProps {
  /** Placeholder du champ */
  placeholder?: string;
  /** Appelé quand l'utilisateur sélectionne un lieu */
  onSelect: (place: GeoPlace) => void;
  /** Valeur déjà sélectionnée (pour ré-afficher) */
  value?: GeoPlace | null;
  /** Classe CSS additionnelle pour le container */
  className?: string;
}

export function CitySearch({ placeholder = '🔎 Rechercher une ville...', onSelect, value, className = '' }: CitySearchProps) {
  const [query, setQuery] = useState(value ? value.city : '');
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GeoPlace | null>(value ?? null);
  const [showResults, setShowResults] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (selected && query === selected.city) return;

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    debounceRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      const places = await searchPlaces(query, abortRef.current.signal);
      setResults(places);
      setLoading(false);
      setShowResults(true);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  const handleSelect = (place: GeoPlace) => {
    setSelected(place);
    setQuery(place.city);
    setShowResults(false);
    onSelect(place);
  };

  const handleReset = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (selected) setSelected(null); }}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={placeholder}
          className="w-full py-3 px-4 rounded-xl glass border border-night-700 text-night-100 text-sm focus:outline-none focus:border-cosmic-500 transition-colors"
        />
        {selected && (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Changer de ville"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-night-800 text-night-300 text-xs hover:bg-night-700"
          >
            ✕
          </button>
        )}
      </div>

      {showResults && !selected && (
        <div className="w-full mt-2 space-y-2 max-h-64 overflow-y-auto">
          {loading && (
            <p className="text-night-500 text-sm text-center py-3">
              <span className="inline-block animate-pulse">Recherche…</span>
            </p>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <p className="text-night-500 text-sm text-center py-3">
              Aucune ville trouvée. Essaie « Paris, France » ou le nom du pays.
            </p>
          )}
          {!loading && results.map((place, idx) => (
            <button
              key={`${place.city}-${idx}`}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full py-3 px-4 rounded-xl text-left transition-all glass border border-transparent hover:border-gold-500/40 flex items-center gap-3"
            >
              <span className="shrink-0 w-5 h-5 rounded-full bg-night-800/60 text-night-600 flex items-center justify-center text-xs" aria-hidden="true">○</span>
              <span className="flex-1 min-w-0">
                <span className="text-night-100 block truncate">{place.city}</span>
                <span className="text-night-400 text-xs block truncate">{place.country}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="w-full mt-3 px-4 py-3 rounded-2xl glass border border-gold-500/30 bg-gold-500/5 animate-fade-in">
          <p className="text-night-400 text-xs uppercase tracking-widest mb-1">Ville sélectionnée</p>
          <p className="text-gold-300 text-sm font-medium">✦ {selected.city}, {selected.country}</p>
          <p className="text-night-500 text-xs mt-1">
            Fuseau UTC{selected.tzOffset >= 0 ? '+' : ''}{selected.tzOffset} · {selected.latitude.toFixed(2)}°, {selected.longitude.toFixed(2)}°
          </p>
        </div>
      )}
    </div>
  );
}
