/**
 * Voice/text comparison engine: preprocess, similarity (Levenshtein), diff for feedback.
 */

import type { CompareResult } from '@/types';

/** French liaisons and elisions: normalize for comparison. */
const LIAISON_ELISION = [
  [/s\s+([aeiouàâäéèêëïîôùûü])/gi, ' $1'],
  [/n\s+([aeiouàâäéèêëïîôùûü])/gi, ' $1'],
  [/t\s+([aeiouàâäéèêëïîôùûü])/gi, ' $1'],
  [/\bl'(\w)/gi, 'le $1'],
  [/\bqu'/gi, 'que '],
  [/\bj'/gi, 'je '],
  [/\bd'/gi, 'de '],
];

/** Remove punctuation, lowercase, normalize spaces. Optionally strip accents. */
export function preprocess(text: string, accentInsensitive: boolean = false): string {
  let s = text.replaceAll(/[^\w\s\u00C0-\u024F]/gu, ' ');
  s = s.toLowerCase().trim();
  s = s.replaceAll(/\s+/g, ' ');
  if (accentInsensitive) {
    s = s.normalize('NFD').replaceAll(/\p{M}/gu, '');
  }
  return s;
}

/** Preprocess with French liaisons/elisions normalization. */
export function preprocessFrench(text: string, accentInsensitive: boolean = false): string {
  let s = preprocess(text, accentInsensitive);
  for (const [re, repl] of LIAISON_ELISION) {
    s = s.replaceAll(re, repl as string);
  }
  return s.replaceAll(/\s+/g, ' ').trim();
}

/** Levenshtein distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = new Array(m + 1)
    .fill(null)
    .map(() => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** Similarity 0–100: 1 - (distance / maxLen). Optionally accent-insensitive. */
export function calculateSimilarity(spoken: string, reference: string, accentInsensitive: boolean = false): number {
  const pre = (t: string) => preprocessFrench(t, accentInsensitive);
  const s = pre(spoken);
  const r = pre(reference);
  if (r.length === 0) return s.length === 0 ? 100 : 0;
  const dist = levenshtein(s, r);
  const maxLen = Math.max(s.length, r.length);
  const sim = 1 - dist / maxLen;
  return Math.round(Math.max(0, Math.min(100, sim * 100)));
}

function tokenize(text: string): string[] {
  return preprocess(text).split(/\s+/).filter(Boolean);
}

/** Find words in reference that are missing in spoken. */
function findMissingWords(spoken: string, reference: string): string[] {
  const sSet = new Set(tokenize(spoken));
  return tokenize(reference).filter((w) => !sSet.has(w));
}

/** Find words in spoken that are not in reference (wrong/extra). */
function findWrongWords(spoken: string, reference: string): string[] {
  const rSet = new Set(tokenize(reference));
  return tokenize(spoken).filter((w) => !rSet.has(w));
}

/** Simple word-order hint: compare sequences. */
function checkWordOrder(spoken: string, reference: string): string[] {
  const sWords = tokenize(spoken);
  const rWords = tokenize(reference);
  const hints: string[] = [];
  const minLen = Math.min(sWords.length, rWords.length);
  for (let i = 0; i < minLen; i++) {
    if (sWords[i] !== rWords[i]) {
      hints.push(`Position ${i + 1}: expected "${rWords[i]}" got "${sWords[i]}"`);
    }
  }
  if (rWords.length > sWords.length) {
    hints.push(`Missing ${rWords.length - sWords.length} word(s) at the end`);
  }
  if (sWords.length > rWords.length) {
    hints.push(`Extra ${sWords.length - rWords.length} word(s)`);
  }
  return hints;
}

function generateFeedback(errors: CompareResult['errors']): string {
  const parts: string[] = [];
  if (errors.missingWords.length) {
    parts.push(`Missing: ${errors.missingWords.slice(0, 5).join(', ')}`);
  }
  if (errors.wrongWords.length) {
    parts.push(`Check: ${errors.wrongWords.slice(0, 5).join(', ')}`);
  }
  if (errors.wordOrder.length) {
    parts.push(errors.wordOrder[0] ?? '');
  }
  return parts.join('. ') || 'Try again.';
}

/** Word-level diff for UI: align by position, mark correct/missing/wrong. */
export function generateDiff(spoken: string, reference: string): CompareResult['diff'] {
  const sWords = tokenize(spoken);
  const rWords = tokenize(reference);
  const rSet = new Set(rWords);
  const used = new Set<number>();
  const result: Array<{ word: string; status: 'correct' | 'missing' | 'wrong' }> = [];

  for (const rw of rWords) {
    const si = sWords.indexOf(rw, 0);
    const found = si >= 0 && !used.has(si);
    if (found) {
      used.add(si);
      result.push({ word: rw, status: 'correct' });
    } else {
      result.push({ word: rw, status: 'missing' });
    }
  }
  sWords.forEach((w, i) => {
    if (used.has(i)) return;
    if (!rSet.has(w)) {
      result.push({ word: w, status: 'wrong' });
    }
  });
  return result;
}

/**
 * Compare spoken/typed text to reference. Returns score, passed, errors, suggestion, diff.
 * Options: accentInsensitive (from settings), strictWordMatch (disable phonetic match in diff).
 */
export function compareTexts(
  spoken: string,
  reference: string,
  thresholdPercent: number = 85,
  options?: { accentInsensitive?: boolean; strictWordMatch?: boolean }
): CompareResult {
  const accentInsensitive = options?.accentInsensitive ?? false;
  const spokenClean = preprocess(spoken, accentInsensitive);
  const referenceClean = preprocess(reference, accentInsensitive);
  const score = calculateSimilarity(spoken, reference, accentInsensitive);
  const passed = score >= thresholdPercent;
  const errors = {
    missingWords: findMissingWords(spokenClean, referenceClean),
    wrongWords: findWrongWords(spokenClean, referenceClean),
    wordOrder: checkWordOrder(spokenClean, referenceClean),
  };
  const suggestion = generateFeedback(errors);
  const diff = generateDiff(spoken, reference);
  return { score, passed, errors, suggestion, diff };
}
