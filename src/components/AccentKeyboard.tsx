/**
 * Accent keyboard for French: vowel/accent groups and special ligatures.
 * Inserts character at cursor in the bound textarea via onInsertChar.
 */

import { useState, useCallback } from 'react';

const ACCENT_MAP: Record<string, { lower: string[]; upper: string[] }> = {
  a: { lower: ['à', 'â', 'ä'], upper: ['À', 'Â', 'Ä'] },
  e: { lower: ['é', 'è', 'ê', 'ë'], upper: ['É', 'È', 'Ê', 'Ë'] },
  i: { lower: ['ï', 'î'], upper: ['Ï', 'Î'] },
  o: { lower: ['ô'], upper: ['Ô'] },
  u: { lower: ['ù', 'û', 'ü'], upper: ['Ù', 'Û', 'Ü'] },
  y: { lower: ['ÿ'], upper: ['Ÿ'] },
  c: { lower: ['ç'], upper: ['Ç'] },
  '*': { lower: ['œ', 'æ'], upper: ['Œ', 'Æ'] },
};

type VowelKey = 'a' | 'e' | 'i' | 'o' | 'u' | 'y' | 'c' | '*';

const ROW_KEYS: VowelKey[] = ['a', 'e', 'i', 'o', 'u', 'y', 'c', '*'];

type Props = Readonly<{
  onInsertChar: (char: string) => void;
}>;

export function AccentKeyboard({ onInsertChar }: Props) {
  const [capsLock, setCapsLock] = useState(false);
  const [selectedVowel, setSelectedVowel] = useState<VowelKey | null>(null);

  const handleVowelClick = useCallback((key: VowelKey) => {
    setSelectedVowel((prev) => (prev === key ? null : key));
  }, []);

  const handleAccentClick = useCallback(
    (char: string) => {
      onInsertChar(char);
    },
    [onInsertChar]
  );

  const accents = selectedVowel ? ACCENT_MAP[selectedVowel] : null;
  let accentChars: string[] = [];
  if (accents) {
    accentChars = capsLock ? accents.upper : accents.lower;
  }

  return (
    <div
      className="w-full min-h-[3.25rem] sm:min-h-[3.5rem] flex flex-col gap-2 sm:gap-2.5"
      role="toolbar"
      aria-label="French accent keyboard"
    >
      {/* Main row: UP arrow | a | e | i | o | u | y | c | * — scrolls horizontally on very small screens */}
      <div className="overflow-x-auto overflow-y-hidden w-full -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max sm:min-w-0">
          <button
            type="button"
            onClick={() => setCapsLock((c) => !c)}
            className={`min-w-[2.75rem] min-h-[2.75rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] h-11 sm:h-9 px-2 rounded-lg border text-sm font-medium transition-all shrink-0 flex items-center justify-center ${
              capsLock
                ? 'bg-primary text-white border-primary'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={capsLock ? 'Uppercase (click for lowercase)' : 'Lowercase (click for uppercase)'}
            aria-pressed={capsLock}
          >
            ↑
          </button>
          {ROW_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleVowelClick(key)}
              className={`min-w-[2.75rem] min-h-[2.75rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] h-11 sm:h-9 px-2 rounded-lg border text-sm font-medium transition-all shrink-0 flex items-center justify-center ${
                selectedVowel === key
                  ? 'bg-primary/20 dark:bg-primary/30 border-primary text-primary'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              aria-expanded={selectedVowel === key}
              aria-label={`Accents for ${key}`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      {/* Accent row: only the selected letter's accents (or œ, æ / Œ, Æ for *) */}
      {accentChars.length > 0 && (
        <div className="overflow-x-auto overflow-y-hidden w-full -mx-1 px-1 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max sm:min-w-0 pl-8 sm:pl-10 md:pl-12">
            {accentChars.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => handleAccentClick(char)}
                className="min-w-[2.75rem] min-h-[2.75rem] sm:min-w-[2.5rem] sm:min-h-[2.5rem] h-11 sm:h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 flex items-center justify-center"
                aria-label={`Insert ${char}`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
