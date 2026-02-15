/**
 * Global app state (Zustand): current track, phrase, playback mode, UI.
 */

import { create } from 'zustand';
import type { AppState as AppStateType, AppSettings } from '@/types';
import { loadSettings, saveSettings } from './settings';

/** Learning app view: dashboard, library (sentence list), phase 1–4, or track (legacy audio). */
export type LearningView = 'dashboard' | 'library' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'track';

interface UIState {
  settingsOpen: boolean;
  helpOpen: boolean;
  navDrawerOpen: boolean;
  nav: 'library' | 'recent' | 'favorites';
  showTranslation: boolean;
  /** Track IDs in order of last opened (most recent first) */
  recentTrackIds: string[];
  favoriteTrackIds: string[];
  /** Version counter for track updates (increments when any track data changes) */
  trackVersion: number;
  /** Learning app: current view (dashboard = practice home, library = sentence list, phase1–4 = learning phases) */
  learningView: LearningView;
  /** Current sentence ID when in a phase (for Phase 1–4). */
  currentSentenceId: string | null;
  /** Sentence version: bump when sentences or progress change (for dashboard/phase refresh). */
  sentenceVersion: number;
  /** Selected course ID for listen/speak/write. */
  currentCourseId: string | null;
  /** Selected lesson ID for listen/speak/write. */
  currentLessonId: string | null;
  /** Listen & Repeat: persisted position per lessonId. */
  listenRepeatState: Record<string, { currentIndex: number; repeatIndex: number }>;
  /** Listen & Repeat: auto-advance to next sentence after repeats (default on). */
  listenRepeatAutoAdvance: boolean;
}

interface Store extends AppStateType, UIState {
  settings: AppSettings;
  setLearningView: (v: LearningView) => void;
  setCurrentSentenceId: (id: string | null) => void;
  incrementSentenceVersion: () => void;
  setCurrentCourseId: (id: string | null) => void;
  setCurrentLessonId: (id: string | null) => void;
  setListenRepeatState: (lessonId: string, currentIndex: number, repeatIndex: number) => void;
  clearListenRepeatStateForLessonIds: (lessonIds: string[]) => void;
  setListenRepeatAutoAdvance: (v: boolean) => void;
  /** Clear course/lesson selection and listen-repeat state (e.g. after deleting all data). */
  resetTrainingState: () => void;
  setSettings: (s: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setCurrentTrack: (id: string | null) => void;
  setCurrentPhraseIndex: (i: number) => void;
  setPlaybackMode: (m: AppStateType['playbackMode']) => void;
  setPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setAbLoop: (v: { a: number; b: number } | null) => void;
  setZoom: (z: number) => void;
  setScrollOffset: (o: number) => void;
  setSettingsOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setNavDrawerOpen: (v: boolean) => void;
  setNav: (n: UIState['nav']) => void;
  setShowTranslation: (v: boolean) => void;
  addRecent: (trackId: string) => void;
  toggleFavorite: (trackId: string) => void;
  incrementTrackVersion: () => void;
}

export const useStore = create<Store>((set) => ({
  currentTrackId: null,
  currentPhraseIndex: 0,
  playbackMode: 'stopped',
  isPlaying: false,
  currentTime: 0,
  abLoop: null,
  zoom: 100,
  scrollOffset: 0,
  settings: loadSettings(),
  settingsOpen: false,
  helpOpen: false,
  navDrawerOpen: false,
  nav: 'library',
  showTranslation: true,
  recentTrackIds: [],
  favoriteTrackIds: [],
  trackVersion: 0,
  learningView: 'dashboard',
  currentSentenceId: null,
  sentenceVersion: 0,
  currentCourseId: null,
  currentLessonId: null,
  listenRepeatState: {},
  listenRepeatAutoAdvance: true,

  setLearningView: (v: LearningView) => set({ learningView: v }),
  setCurrentSentenceId: (id: string | null) => set({ currentSentenceId: id }),
  incrementSentenceVersion: () => set((s) => ({ sentenceVersion: s.sentenceVersion + 1 })),
  setCurrentCourseId: (id: string | null) => set({ currentCourseId: id }),
  setCurrentLessonId: (id: string | null) => set({ currentLessonId: id }),
  setListenRepeatState: (lessonId: string, currentIndex: number, repeatIndex: number) =>
    set((s) => ({
      listenRepeatState: { ...s.listenRepeatState, [lessonId]: { currentIndex, repeatIndex } },
    })),
  clearListenRepeatStateForLessonIds: (lessonIds: string[]) =>
    set((s) => {
      const next = { ...s.listenRepeatState };
      for (const id of lessonIds) delete next[id];
      return { listenRepeatState: next };
    }),
  setListenRepeatAutoAdvance: (v: boolean) => set({ listenRepeatAutoAdvance: v }),
  resetTrainingState: () =>
    set({
      currentCourseId: null,
      currentLessonId: null,
      listenRepeatState: {},
    }),

  setSettings: (s) =>
    set((state) => {
      const next = typeof s === 'function' ? s(state.settings) : s;
      saveSettings(next);
      return { settings: next };
    }),

  setCurrentTrack: (id) =>
    set((state) => ({
      currentTrackId: id,
      currentPhraseIndex: 0,
      isPlaying: false,
      playbackMode: 'stopped',
      recentTrackIds:
        id == null
          ? state.recentTrackIds
          : [id, ...state.recentTrackIds.filter((x) => x !== id)].slice(0, 100),
    })),
  setCurrentPhraseIndex: (i) => set({ currentPhraseIndex: i }),
  setPlaybackMode: (m) => set({ playbackMode: m }),
  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setAbLoop: (v) => set({ abLoop: v }),
  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(100, z)) }),
  setScrollOffset: (o) => set({ scrollOffset: Math.max(0, Math.min(1, o)) }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setHelpOpen: (v) => set({ helpOpen: v }),
  setNavDrawerOpen: (v) => set({ navDrawerOpen: v }),
  setNav: (n) => set({ nav: n }),
  setShowTranslation: (v) => set({ showTranslation: v }),
  addRecent: (trackId: string) =>
    set((s) => ({
      recentTrackIds: [trackId, ...s.recentTrackIds.filter((x) => x !== trackId)].slice(0, 100),
    })),
  toggleFavorite: (trackId: string) =>
    set((s) => ({
      favoriteTrackIds: s.favoriteTrackIds.includes(trackId)
        ? s.favoriteTrackIds.filter((x) => x !== trackId)
        : [...s.favoriteTrackIds, trackId],
    })),
  incrementTrackVersion: () => set((s) => ({ trackVersion: s.trackVersion + 1 })),
}));
