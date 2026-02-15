/**
 * Translation engine: local/offline translation via @xenova/transformers.
 * Translates French text to English using a local model.
 */

import {
  env,
  pipeline as createPipeline,
  type TranslationPipeline,
} from '@xenova/transformers';

const TRANSLATION_MODEL = 'Xenova/opus-mt-fr-en';
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';

// Apply environment settings
env.allowLocalModels = false;
env.useBrowserCache = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = CDN_WASM;
}

let translationPipeline: TranslationPipeline | null = null;

async function getTranslationPipeline(): Promise<TranslationPipeline> {
  if (translationPipeline) return translationPipeline;
  translationPipeline = (await createPipeline(
    'translation',
    TRANSLATION_MODEL
  )) as TranslationPipeline;
  return translationPipeline;
}

/**
 * Translate text from French to English using local model.
 */
export async function translateText(
  text: string
): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  
  try {
    const pipe = await getTranslationPipeline();
    const result = await pipe(text) as { translation_text?: string } | { translation_text?: string }[];
    
    if (Array.isArray(result) && result[0]?.translation_text) {
      return result[0].translation_text;
    }
    if (result && typeof result === 'object' && 'translation_text' in result) {
      return (result as { translation_text: string }).translation_text ?? '';
    }
    return '';
  } catch (error) {
    console.error('Translation failed:', error);
    return '';
  }
}

/**
 * Translate multiple texts in batch.
 */
export async function translateBatch(
  texts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  const total = texts.length;
  
  for (let i = 0; i < total; i++) {
    const translation = await translateText(texts[i]);
    results.push(translation);
    onProgress?.(i + 1, total);
  }
  
  return results;
}
