/**
 * STT: browser Web Speech API for French.
 */

import {
  recognizeSpeech as browserRecognizeSpeech,
  isSpeechRecognitionSupported,
} from './speechRecognition';
import type { RecognizeOptions } from './speechRecognition';

export { isSpeechRecognitionSupported };

export type { RecognizeOptions };

export function listenForSpeech(options: RecognizeOptions = {}): Promise<string> {
  return recognizeSpeech({ lang: 'fr-FR', ...options });
}

/**
 * Recognize speech using browser Web Speech API. Rejects if not supported.
 */
export async function recognizeSpeech(options: RecognizeOptions = {}): Promise<string> {
  if (!isSpeechRecognitionSupported()) {
    throw new Error('Speech recognition is not supported in this browser. Try Chrome or Edge.');
  }
  return browserRecognizeSpeech(options);
}
