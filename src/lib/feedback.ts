/**
 * P2#16 — Sons + haptiques centralisés.
 *
 * Philosophie : les feedbacks sensoriels doivent être subtils, jamais intrusifs.
 * Un tirage de tarot mérite un petit tintement ; un bouton de nav, juste une
 * vibration légère. L'utilisateur peut tout couper dans les Settings.
 *
 * Graceful degradation :
 *   - navigator.vibrate existe que sur Android/Chrome → no-op silencieux sur iOS
 *   - Web Audio API requiert un user gesture → on init au premier tap
 *   - Fichiers audio chargés paresseusement (pas de network au boot)
 *
 * Sons générés programmatiquement (Web Audio API) pour éviter de bundler
 * des fichiers mp3 — chaque son est une courte séquence de notes.
 */

// ─── Préférences ──────────────────────────────────────────────────
const STORAGE_KEY = 'celeste-feedback-prefs';

interface FeedbackPrefs {
  sound: boolean;
  haptic: boolean;
}

function loadPrefs(): FeedbackPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return { sound: true, haptic: true };
}

function savePrefs(prefs: FeedbackPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* noop */ }
}

let prefs: FeedbackPrefs = loadPrefs();

export function setSoundEnabled(enabled: boolean) {
  prefs.sound = enabled;
  savePrefs(prefs);
}

export function setHapticEnabled(enabled: boolean) {
  prefs.haptic = enabled;
  savePrefs(prefs);
}

export function isSoundEnabled() { return prefs.sound; }
export function isHapticEnabled() { return prefs.haptic; }

// ─── Haptics ──────────────────────────────────────────────────────
export function haptic(pattern: number | number[] = 10) {
  if (!prefs.haptic) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* noop */ }
}

// ─── Audio (Web Audio API) ────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Doit être appelé suite à un user gesture (click/tap) pour débloquer l'audio
 * sur iOS Safari. Sans ça, tous les sons restent muets.
 */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* noop */ });
  }
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  startDelay?: number;
  sweepTo?: number; // glissando vers cette fréquence
}

function playTone({ freq, duration, type = 'sine', volume = 0.15, startDelay = 0, sweepTo }: ToneOptions) {
  if (!prefs.sound) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (sweepTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), start + duration);
    }
    // Enveloppe ADSR simplifiée (attack + release, pas de sustain)
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  } catch { /* noop */ }
}

// ─── Sound presets ────────────────────────────────────────────────
// Fréquences en Hertz. Inspirées des harmoniques sacrées (Solfège).

/** Petit tintement cristallin pour un tirage de carte. */
export function playCardReveal() {
  playTone({ freq: 523.25, duration: 0.4, type: 'sine', volume: 0.30 });       // C5
  playTone({ freq: 659.25, duration: 0.4, type: 'sine', volume: 0.20, startDelay: 0.08 }); // E5
  playTone({ freq: 783.99, duration: 0.6, type: 'sine', volume: 0.16, startDelay: 0.16 }); // G5
  haptic([10, 30, 20]);
}

/** Son plus grave et mystérieux pour un tirage de rune. */
export function playRuneReveal() {
  playTone({ freq: 196.00, duration: 0.8, type: 'triangle', volume: 0.32, sweepTo: 174.61 }); // G3 → F3
  playTone({ freq: 392.00, duration: 0.5, type: 'sine', volume: 0.18, startDelay: 0.1 });     // G4
  haptic([15, 40, 25]);
}

/** Notification douce (révélation de horoscope, quête complétée). */
export function playChime() {
  playTone({ freq: 880.00, duration: 0.3, type: 'sine', volume: 0.20 }); // A5
  playTone({ freq: 1108.73, duration: 0.4, type: 'sine', volume: 0.16, startDelay: 0.05 }); // C#6
  haptic(15);
}

/** Click léger pour les CTA principaux. */
export function playClick() {
  playTone({ freq: 440, duration: 0.05, type: 'square', volume: 0.06 });
  haptic(8);
}

/** Erreur discrète. */
export function playError() {
  playTone({ freq: 220, duration: 0.15, type: 'sawtooth', volume: 0.08 });
  haptic([20, 40, 20]);
}

/** Succès de quête (montée harmonique). */
export function playQuestComplete() {
  playTone({ freq: 523.25, duration: 0.2, type: 'sine', volume: 0.14 }); // C5
  playTone({ freq: 659.25, duration: 0.2, type: 'sine', volume: 0.14, startDelay: 0.1 });  // E5
  playTone({ freq: 783.99, duration: 0.3, type: 'sine', volume: 0.14, startDelay: 0.2 });  // G5
  playTone({ freq: 1046.50, duration: 0.5, type: 'sine', volume: 0.12, startDelay: 0.3 }); // C6
  haptic([10, 30, 10, 30, 40]);
}
