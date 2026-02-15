/**
 * Text-to-Speech (French) via Web Speech API.
 * iOS Safari: voices load asynchronously—must wait for voiceschanged before getVoices() returns Premium/natural voices.
 */

import { useState, useEffect } from 'react';

const FRENCH_LANG = 'fr-FR';
const VOICES_LOAD_TIMEOUT_MS = 3000;

let synth: SpeechSynthesis | null = null;

function getSynth(): SpeechSynthesis | null {
  if (globalThis.window === undefined) return null;
  if (!synth) {
    synth = (globalThis as Window & typeof globalThis).speechSynthesis;
    // iOS: calling getVoices() primes async load; voiceschanged fires when ready
    synth?.getVoices();
  }
  return synth;
}

/** French voices (fr-*). Populated after onvoiceschanged (async on iOS). */
function getFrenchVoices(): SpeechSynthesisVoice[] {
  const s = getSynth();
  if (!s) return [];
  return s.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
}

/** Wait for voices to load. Required on iOS Safari where getVoices() is initially empty. */
function waitForVoicesLoaded(): Promise<void> {
  const s = getSynth();
  if (!s) return Promise.resolve();
  if (getFrenchVoices().length > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), VOICES_LOAD_TIMEOUT_MS);
    const onVoicesChanged = () => {
      clearTimeout(timeout);
      s.removeEventListener('voiceschanged', onVoicesChanged);
      resolve();
    };
    s.addEventListener('voiceschanged', onVoicesChanged);
  });
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

/** Prefer voices that often sound more natural on mobile (e.g. Premium, Amélie, Google, enhanced). */
function isLikelyNaturalVoice(v: SpeechSynthesisVoice): boolean {
  const n = (v.name + ' ' + (v.voiceURI || '')).toLowerCase();
  return /google|enhanced|premium|natural|samsung|female|male|online|amélie/.test(n);
}

/** iOS Safari: Premium and Amélie are the natural-sounding voices; robotic without them. */
function getPreferredNaturalVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const lower = (n: string) => n.toLowerCase();
  return list.find((v) => lower(v.name).includes('premium') || lower(v.name).includes('amélie')) ?? list.find((v) => v.lang === FRENCH_LANG) ?? null;
}

/** First available fr-* voice for fallback when stored voice is missing or not French. On mobile, prefer Premium/Amélie (iOS) or other natural voices. */
export function getDefaultFrenchVoice(): SpeechSynthesisVoice | null {
  const list = getFrenchVoices();
  if (list.length === 0) return null;
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const preferred = getPreferredNaturalVoice(list);
    if (preferred) return preferred;
  }
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
  if (!options?.voice) return fallback;
  if (typeof options.voice === 'string') {
    const list = getFrenchVoices();
    const v = list.find((x) => x.name === options.voice || x.voiceURI === options.voice);
    if (!v?.lang?.toLowerCase().startsWith('fr')) return fallback;
    return v;
  }
  if (!options.voice?.lang?.toLowerCase().startsWith('fr')) return fallback;
  return options.voice;
}

/** Speak French text. Returns a promise that resolves when utterance ends. */
export async function speakFrench(
  text: string,
  options: { rate?: number; volume?: number; voice?: SpeechSynthesisVoice } = {}
): Promise<void> {
  const rate = options.rate ?? 1;
  const s = getSynth();
  if (!s) {
    throw new Error('Speech synthesis not supported');
  }
  await waitForVoicesLoaded();
  const voice = options.voice ?? getDefaultFrenchVoice();
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = FRENCH_LANG;
    u.rate = rate;
    u.volume = options.volume ?? 1;
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = (e) => reject(e instanceof Error ? e : new Error(String(e.error ?? 'Speech synthesis error')));
    s.speak(u);
  });
}

export interface SpeakOptions {
  rate?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice | string;
}

/** Speak sentence and return approximate duration in ms (for repeat window). */
export async function speakSentence(text: string, options: SpeakOptions = {}): Promise<number> {
  const rate = options.rate ?? 1;
  const s = getSynth();
  if (!s) {
    throw new Error('Speech synthesis not supported');
  }
  await waitForVoicesLoaded();
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
    u.onerror = (e) => reject(e instanceof Error ? e : new Error(String(e.error ?? 'Speech synthesis error')));
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
