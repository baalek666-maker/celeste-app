/**
 * P1#13 — i18n infrastructure.
 *
 * L'app reste 100% française pour l'instant, mais cette couche prépare
 * la migration future vers d'autres langues (EN, ES).
 *
 * Usage :
 *   import { useTranslation } from '../i18n';
 *   const { t } = useTranslation();
 *   <Text>{t('home.greeting_morning', { name: 'Léa' })}</Text>
 *
 * Les clés sont dans src/i18n/fr.json. Si une clé manque, on retourne la clé
 * elle-même (visible en dev, jamais crash).
 */

import fr from './fr.json';

// ─── Types ────────────────────────────────────────────────────────
type Dict = Record<string, unknown>;
type Interpolation = Record<string, string | number>;

const translations: Dict = fr as Dict;

// ─── Core lookup ──────────────────────────────────────────────────
function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split('.');
  let cursor: unknown = dict;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in (cursor as Dict)) {
      cursor = (cursor as Dict)[part];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function interpolate(template: string, vars?: Interpolation): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{{${k}}}`
  );
}

export function translate(key: string, vars?: Interpolation): string {
  const raw = lookup(translations, key);
  if (raw === undefined) {
    // En dev, alerte ; en prod, retourne la clé pour ne jamais crash.
    if (import.meta.env.DEV) {
      console.warn(`[i18n] clé manquante: "${key}"`);
    }
    return key;
  }
  return interpolate(raw, vars);
}

// ─── React hook ───────────────────────────────────────────────────
import { useCallback } from 'react';

export function useTranslation() {
  const t = useCallback((key: string, vars?: Interpolation) => translate(key, vars), []);
  return { t };
}

// ─── Language management (futur) ──────────────────────────────────
// Quand on ajoutera EN/ES, on chargera dynamiquement le bon fichier
// et on switchera `translations` via un contexte React.
export const AVAILABLE_LANGUAGES = ['fr'] as const;
export type Language = (typeof AVAILABLE_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'fr';
