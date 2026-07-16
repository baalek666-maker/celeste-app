import type { NatalChart } from '../types';

/**
 * Choisit LA planète perso à mettre en avant aujourd'hui.
 * - Rotation basée sur le jour de l'année → change chaque jour mais reste stable dans la journée.
 * - Préfère les planètes "personnelles" (Mercure, Vénus, Mars) qui parlent à l'utilisateur
 *   avant les transats (Jupiter, Saturne).
 */
const PERSONAL_PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars'];

export function getDailyHighlightPlanet(chart: NatalChart | null | undefined) {
  if (!chart?.positions || chart.positions.length === 0) return null;

  const personal = chart.positions.filter(p => PERSONAL_PLANETS.includes(p.planet));
  const pool = personal.length > 0 ? personal : chart.positions;

  // Day-of-year seed
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const idx = dayOfYear % pool.length;

  return pool[idx];
}