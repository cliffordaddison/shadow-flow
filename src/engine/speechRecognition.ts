/**
 * Browser Speech Recognition (Web Speech API) for French STT.
 * Uses global types from types/speech.d.ts when available.
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: unknown; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (globalThis.window === undefined) return false;
  const win = globalThis.window as Window & { webkitSpeechRecognition?: unknown };
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  if (globalThis.window === undefined) return null;
  const win = globalThis.window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'fr-FR';
  rec.continuous = true;   // Keep listening across pauses until user stops
  rec.interimResults = true; // Get partial results; improves responsiveness
  rec.maxAlternatives = 3;   // Request more alternatives for better pick-up
  return rec;
}

export function listenForSpeech(): Promise<string> {
  return recognizeSpeech({ lang: 'fr-FR' });
}

export interface RecognizeOptions {
  lang?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Collect transcript from SpeechRecognitionResultList. With continuous mode, iterates over all results. */
function collectTranscriptFromResults(
  results: { [i: number]: { isFinal: boolean; length: number; 0?: { transcript: string; confidence?: number } } },
  resultIndex: number
): { final: string[]; lastInterim: string } {
  const finals: string[] = [];
  let lastInterim = '';
  const len = (results as unknown as { length: number }).length ?? resultIndex + 1;
  for (let i = 0; i < len; i++) {
    const item = results[i];
    if (!item) continue;
    const alt0 = item[0];
    const text = alt0?.transcript?.trim() ?? '';
    if (!text) continue;
    if (item.isFinal) {
      finals.push(text);
    } else {
      lastInterim = text;
    }
  }
  return { final: finals, lastInterim };
}

/** Recognize speech. Returns Promise with transcript or empty string on timeout. Uses continuous mode; user can click "Done speaking" to stop. */
export function recognizeSpeech(options: RecognizeOptions = {}): Promise<string> {
  const lang = options.lang ?? 'fr-FR';
  const timeoutMs = options.timeoutMs ?? 10000;
  return new Promise((resolve, reject) => {
    const rec = createSpeechRecognition();
    if (!rec) {
      reject(new Error('Speech recognition not supported'));
      return;
    }
    rec.lang = lang;
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const collected: string[] = [];
    let lastInterim = '';
    const finish = (value: string) => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      try {
        rec.abort();
      } catch {
        // Ignore abort errors when cleaning up
      }
      resolve(value);
    };
    const onAbort = () => {
      try {
        rec.stop(); // Returns results; abort() would discard them
      } catch {
        rec.abort();
      }
    };
    timeoutId = setTimeout(() => finish(''), timeoutMs);
    if (options.signal) {
      if (options.signal.aborted) {
        finish('');
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }
    rec.onresult = (e: { results: unknown; resultIndex: number }) => {
      if (resolved) return;
      const results = e.results as { [i: number]: { isFinal: boolean; length: number; 0?: { transcript: string; confidence?: number } } };
      const { final: newFinals, lastInterim: interim } = collectTranscriptFromResults(results, e.resultIndex);
      for (const t of newFinals) collected.push(t);
      if (interim) lastInterim = interim;
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speechRecognition.ts:onresult',message:'result',data:{resultIndex:e.resultIndex,finalsCount:newFinals.length,lastInterim:(interim||'').slice(0,60),collectedTotal:collected.length},timestamp:Date.now(),hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    };
    rec.onend = () => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speechRecognition.ts:onend',message:'end',data:{resolved,collectedLen:collected.length,lastInterimLen:lastInterim.length},timestamp:Date.now(),hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
      if (!resolved) {
        const combined = collected.length > 0
          ? collected.join(' ').trim()
          : lastInterim.trim();
        finish(combined || '');
      }
    };
    rec.onerror = (e: { error: string }) => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speechRecognition.ts:onerror',message:'error',data:{error:e?.error},timestamp:Date.now(),hypothesisId:'H8'})}).catch(()=>{});
      // #endregion
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (options.signal) options.signal.removeEventListener('abort', onAbort);
        const fallback = collected.length > 0
          ? collected.join(' ').trim()
          : lastInterim.trim();
        if (fallback && (e?.error === 'no-speech' || e?.error === 'aborted')) {
          resolve(fallback);
        } else {
          reject(new Error(e?.error ?? 'Speech recognition error'));
        }
      }
    };
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speechRecognition.ts',message:'rec.start()',data:{lang},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    rec.start();
  });
}
