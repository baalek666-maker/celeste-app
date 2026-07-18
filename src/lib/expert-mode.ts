/**
 * P2#18 — Mode expert.
 *
 * Certain·e·s utilisateur·rice·s veulent voir les données astronomiques brutes :
 * degrés exacts des planètes, maisons, aspects technique, lunaison en %, etc.
 * Par défaut, Céleste reste lisible et poétique. Le mode expert révèle la couche
 * technique pour les astro-curieux·ses.
 *
 * Le toggle est persistant (localStorage) ET synchronisé avec les préférences
 * serveur via /me/preferences (futur). Pour l'instant, local suffit.
 *
 * Usage dans un écran :
 *   import { useExpertMode } from '../lib/expert-mode';
 *   const expert = useExpertMode();
 *   {expert && <span className="text-xs">{planet.lon.toFixed(2)}°</span>}
 */

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'celeste-expert-mode';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Lecture synchrone (utile hors React, ex. dans des helpers de formatage). */
export function isExpertMode(): boolean {
  return readStored();
}

/** Active/désactive le mode expert. */
export function setExpertMode(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    // Notifier les abonnés (listeners React)
    window.dispatchEvent(new CustomEvent('celeste:expert-mode', { detail: enabled }));
  } catch { /* noop */ }
}

/** Hook React : renvoie l'état courant + toggle. */
export function useExpertMode(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readStored());

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setEnabled(ce.detail);
    };
    window.addEventListener('celeste:expert-mode', handler);
    return () => window.removeEventListener('celeste:expert-mode', handler);
  }, []);

  const toggle = useCallback((v: boolean) => {
    setExpertMode(v);
  }, []);

  return [enabled, toggle];
}

// ─── Helpers de formatage ──────────────────────────────────────────
// Utilisés par les écrans pour afficher conditionnellement les données techniques.

/** Format degré décimal → D°M'S"  (ex. 142.5 → "142°30'00"). */
export function formatDegrees(decimal: number): string {
  const sign = decimal < 0 ? '-' : '';
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = Math.round((minFull - min) * 60);
  return `${sign}${deg}°${String(min).padStart(2, '0')}'${String(sec).padStart(2, '0')}"`;
}

/** Retourne le sigle d'un signe à partir d'une longitude écliptique. */
export function signFromLongitude(lon: number): string {
  const signs = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  const idx = Math.floor(((lon % 360) + 360) % 360 / 30);
  return signs[idx];
}

/** Position dans le signe (0-29°59'). */
export function degreeInSign(lon: number): string {
  const normalized = ((lon % 360) + 360) % 360;
  const degInSign = normalized % 30;
  const deg = Math.floor(degInSign);
  const min = Math.floor((degInSign - deg) * 60);
  return `${deg}°${String(min).padStart(2, '0')}'${signFromLongitude(lon)}`;
}
