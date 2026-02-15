/**
 * Text-to-Speech (French) via Web Speech API.
 */

import { useState, useEffect } from 'react';

const FRENCH_LANG = 'fr-FR';

let synth: SpeechSynthesis | null = null;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!synth) synth = window.speechSynthesis;
  return synth;
}

/** French voices (fr-*). Populated after onvoiceschanged. */
function getFrenchVoices(): SpeechSynthesisVoice[] {
  const s = getSynth();
  if (!s) return [];
  return s.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
}

export function getTTSVoices(): SpeechSynthesisVoice[] {
  return getFrenchVoices();
}

/** React hook: French voices list, updates when speechSynthesis fires voiceschanged. */
export function useFrenchVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getFrenchVoices());
  useEffect(() => {
    const s = getSynth();
    if (!s) return;
    const update = () => setVoices(getFrenchVoices());
    update();
    s.addEventListener('voiceschanged', update);
    return () => s.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

/** Prefer voices that often sound more natural on mobile (e.g. Google, enhanced). */
function isLikelyNaturalVoice(v: SpeechSynthesisVoice): boolean {
  const n = (v.name + ' ' + (v.voiceURI || '')).toLowerCase();
  return /google|enhanced|premium|natural|samsung|female|male|online/.test(n);
}

/** First available fr-* voice for fallback when stored voice is missing or not French. On mobile, prefer voices that typically sound less robotic. */
export function getDefaultFrenchVoice(): SpeechSynthesisVoice | null {
  const list = getFrenchVoices();
  if (list.length === 0) return null;
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    const natural = list.find(isLikelyNaturalVoice);
    if (natural) return natural;
  }
  return list[0];
}

/**
 * Resolve options.voice to a French voice; fall back to default French if missing or not French.
 */
function resolveFrenchVoice(options: { voice?: SpeechSynthesisVoice | string }): SpeechSynthesisVoice | null {
  const fallback = getDefaultFrenchVoice();
  if (!options.voice) return fallback;
  if (typeof options.voice === 'string') {
    const list = getFrenchVoices();
    const v = list.find((x) => x.name === options.voice || x.voiceURI === options.voice);
    if (!v || !v.lang.toLowerCase().startsWith('fr')) return fallback;
    return v;
  }
  if (!options.voice.lang.toLowerCase().startsWith('fr')) return fallback;
  return options.voice;
}

/** Speak French text. Returns a promise that resolves when utterance ends. */
export function speakFrench(
  text: string,
  options: { rate?: number; volume?: number; voice?: SpeechSynthesisVoice } = {}
): Promise<void> {
  const rate = options.rate ?? 1;
  const s = getSynth();
  if (!s) {
    return Promise.reject(new Error('Speech synthesis not supported'));
  }
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = FRENCH_LANG;
    u.rate = rate;
    u.volume = options.volume ?? 1;
    if (options.voice) u.voice = options.voice;
    u.onend = () => resolve();
    u.onerror = (e) => reject(e);
    s.speak(u);
  });
}

export interface SpeakOptions {
  rate?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | string;
}

/** Speak sentence and return approximate duration in ms (for repeat window). */
export function speakSentence(text: string, options: SpeakOptions = {}): Promise<number> {
  const rate = options.rate ?? 1;
  const s = getSynth();
  if (!s) {
    return Promise.reject(new Error('Speech synthesis not supported'));
  }
  const start = performance.now();
  const voice = resolveFrenchVoice(options);
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = FRENCH_LANG;
    u.rate = rate;
    u.volume = options.volume ?? 1;
    if (voice) u.voice = voice;
    u.onend = () => {
      const durationMs = Math.round(performance.now() - start);
      resolve(durationMs);
    };
    u.onerror = (e) => reject(e);
    s.speak(u);
  });
}

/** Speak text N times in sequence. */
export async function speakNTimes(
  text: string,
  n: number,
  options: { rate?: number; volume?: number; voice?: SpeechSynthesisVoice } = {}
): Promise<void> {
  for (let i = 0; i < n; i++) {
    await speakFrench(text, options);
  }
}

export function cancelTTS(): void {
  const s = getSynth();
  if (s) s.cancel();
}
