import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Read a markdown string aloud using the browser's built-in Web Speech API.
 * - Voices: prefers French female voices (Audrey, Amélie, Aquarelle, …), falls back to any fr-*.
 * - Cleans markdown noise (##, *, _, ornament dividers, emojis) so TTS reads naturally.
 * - No external dependency, no API key, no quota.
 * - Returns { supported, speaking, toggle, stop }.
 */
export function useSpeech(text: string) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const clean = useCallback((raw: string) => {
    if (!raw) return '';
    return raw
      .replace(/^#{1,6}\s+/gm, '')      // strip ## headings
      .replace(/[*_~`]/g, '')            // strip markdown emphasis
      .replace(/[\u2726\u2727\u2728✦]/g, '') // strip ornament stars
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const cleaned = clean(text);
    if (!cleaned) return;
    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang = 'fr-FR';
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;
    // Try to pick a French voice (Audrey on macOS / Amélie on iOS / Aquarelle on Android)
    const voices = synth.getVoices();
    const frVoice =
      voices.find(v => v.lang === 'fr-FR' && /female|audrey|am[eé]lie|aquarelle|celine|virginie/i.test(v.name)) ||
      voices.find(v => v.lang === 'fr-FR') ||
      voices.find(v => v.lang?.startsWith('fr')) ||
      null;
    if (frVoice) u.voice = frVoice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  }, [clean, speaking, supported, text]);

  return { supported, speaking, toggle, stop };
}