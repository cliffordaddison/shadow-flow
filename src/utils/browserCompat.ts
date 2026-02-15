/**
 * Browser capability checks for Web Speech API.
 * Used to show warnings and to fall back to offline TTS/STT when unsupported.
 */

export function isWebSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

export { isSpeechRecognitionSupported as isWebSpeechRecognitionSupported } from '@/engine/speechRecognition';
