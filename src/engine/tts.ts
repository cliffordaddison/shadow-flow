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

/** Detect voice gender from voice name and properties. */
function detectVoiceGender(voice: SpeechSynthesisVoice): 'female' | 'male' | 'unknown' {
  const name = (voice.name || '').toLowerCase();
  const uri = (voice.voiceURI || '').toLowerCase();
  const combined = `${name} ${uri}`;
  
  // Look for explicit gender markers in name and URI
  if (/\bfemale\b|\bwoman\b|\bgirl\b|\bfeminina?\b|\bféminin/.test(combined)) return 'female';
  if (/\bmale\b|\bman\b|\bboy\b|\bmasculin|\bmarc\b/.test(combined)) return 'male';
  
  // Google voices: format is usually "Google <Language> <Name>"
  if (/google.*female|google.*woman/.test(combined)) return 'female';
  if (/google.*male|google.*man/.test(combined)) return 'male';
  
  // Common French female voice names
  if (/amélie|joséphine|marie|claire|sophie|julia|emma|alice|catherine|pauline|véronique|margot|isabelle|nathalie|christine/.test(name)) return 'female';
  
  // Common French male voice names  
  if (/marco|bruno|thomas|jean|pierre|jacques|louis|christophe|françois|patrick|raymond/.test(name)) return 'male';
  
  // macOS/iOS common patterns
  if (/victoria|karen|moira|samantha|susan|zira|eva|juliette/.test(name)) return 'female';
  if (/alexander|david|jorge|carlos|juan|diego|tom|mark/.test(name)) return 'male';
  
  return 'unknown';
}

/** Filter French voices by gender, with fallback logic. */
function getFrenchVoicesByGender(gender: 'female' | 'male'): SpeechSynthesisVoice[] {
  const allFrench = getFrenchVoices();
  if (allFrench.length === 0) return [];
  
  // First priority: voices explicitly detected as the requested gender
  const detected = allFrench.filter((v) => detectVoiceGender(v) === gender);
  if (detected.length > 0) return detected;
  
  // Second: if only one voice available, we can't differentiate
  if (allFrench.length === 1) return allFrench;
  
  // Third: try to pick different voices by selecting different indices for different genders
  // This provides variation even if we can't detect gender
  const sorted = [...allFrench].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (gender === 'male' && sorted.length > 1) {
    // For male, prefer the last voice in sorted order (often a different speaker)
    return [sorted[sorted.length - 1]];
  } else if (gender === 'female') {
    // For female, prefer the first voice
    return [sorted[0]];
  }
  
  // Fallback to all voices
  return allFrench;
}

/** iOS Safari: Premium and Amélie are the natural-sounding voices; robotic without them. */
function getPreferredNaturalVoice(list: SpeechSynthesisVoice[], preferredGender?: 'female' | 'male'): SpeechSynthesisVoice | null {
  const lower = (n: string) => n.toLowerCase();
  
  // Prefer voices matching the requested gender
  if (preferredGender) {
    const genderMatched = list.filter((v) => detectVoiceGender(v) === preferredGender);
    if (genderMatched.length > 0) {
      return genderMatched.find((v) => lower(v.name).includes('premium') || lower(v.name).includes('amélie')) ?? genderMatched.find((v) => v.lang === FRENCH_LANG) ?? genderMatched[0] ?? null;
    }
  }
  
  // Fallback to any premium or Amélie voice
  return list.find((v) => lower(v.name).includes('premium') || lower(v.name).includes('amélie')) ?? list.find((v) => v.lang === FRENCH_LANG) ?? null;
}

/** First available fr-* voice for fallback when stored voice is missing or not French. On mobile, prefer Premium/Amélie (iOS) or other natural voices. */
export function getDefaultFrenchVoice(gender?: 'female' | 'male'): SpeechSynthesisVoice | null {
  const list = gender ? getFrenchVoicesByGender(gender) : getFrenchVoices();
  if (list.length === 0) return null;
  
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const preferred = getPreferredNaturalVoice(list, gender);
    if (preferred) return preferred;
  }
  
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    // On mobile, prefer natural-sounding voices that match the gender if possible
    const genderMatched = gender ? list.filter((v) => detectVoiceGender(v) === gender) : [];
    const searchList = genderMatched.length > 0 ? genderMatched : list;
    const natural = searchList.find(isLikelyNaturalVoice);
    if (natural) return natural;
  }
  
  // Return first voice that matches gender if available
  if (gender) {
    const genderMatched = list.filter((v) => detectVoiceGender(v) === gender);
    if (genderMatched.length > 0) return genderMatched[0];
  }
  
  return list[0];
}

/**
 * Resolve options.voice to a French voice; fall back to default French if missing or not French.
 */
function resolveFrenchVoice(options: { voice?: SpeechSynthesisVoice | string; voiceGender?: 'female' | 'male' }): SpeechSynthesisVoice | null {
  const fallback = getDefaultFrenchVoice(options.voiceGender);
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
  options: SpeakOptions = {}
): Promise<void> {
  const rate = options.rate ?? 1;
  const s = getSynth();
  if (!s) {
    throw new Error('Speech synthesis not supported');
  }
  await waitForVoicesLoaded();
  const voice = resolveFrenchVoice(options);
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
  voiceGender?: 'female' | 'male';
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
  options: SpeakOptions = {}
): Promise<void> {
  for (let i = 0; i < n; i++) {
    await speakFrench(text, options);
  }
}

export function cancelTTS(): void {
  const s = getSynth();
  if (s) s.cancel();
}
