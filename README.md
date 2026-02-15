# ShadowFlow

A browser-based WorkAudioBook-style audio player for **language shadowing**: load your own audio (MP3, M4A, WAV, etc.), get automatic phrase segmentation from silence detection, and practice with phrase-level playback, looping, non-stop mode, and keyboard shortcuts. No subtitles or text—focus on listening and shadowing.

## Run the app

```bash
npm install
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`). Load an audio file via **Upload Track** or drag-and-drop. Select a track to open the practice view with waveform and phrase boundaries. Use the bottom bar and keyboard to control playback.

## Speech (TTS & STT)

The app supports two modes for text-to-speech (TTS) and speech-to-text (STT):

- **Web Speech API (default)** – Uses the browser’s built-in speech synthesis and recognition. Fast, no model download, works best in **Chrome** and **Edge**. Requires an internet connection for some engines. Playback speed (0.75–1.5×) is supported.
- **Offline models** – Uses Xenova Transformers.js (MMS-TTS for French, Whisper-tiny for STT). Slower first-time load (models download once), then works fully offline. Enable “Use offline TTS” and/or “Use offline STT” in **Settings → Learning** if you need offline use or your browser lacks Web Speech support.

**Browser compatibility:**

- **Chrome / Edge**: Full Web Speech API support (TTS and STT); recommended.
- **Firefox / Safari**: TTS is supported; speech recognition is limited or unavailable—use offline STT if needed.

When Web Speech API is not available, the app falls back to offline models automatically for that engine.

## Features

- **Audio**: Load local files (MP3, M4A, WAV, OGG, WebM). Decoding and phrase segmentation run in the browser; no upload to servers.
- **Phrase segmentation**: Silence-based splitting with configurable min/max phrase length, silence threshold, and min silence duration. Results cached in localStorage by file hash for fast re-open.
- **Waveform**: Full-track waveform, phrase boundaries, current phrase highlight, playhead. Click to seek and select phrase. Zoom slider.
- **Playback**: Play current phrase, next/previous phrase, non-stop (with configurable pause % between phrases), auto-repeat (off / 1 / 2 / infinite). Playback speed 0.5x–2x, volume.
- **Keyboard**: Space (play/pause), N (next), P (previous), R (repeat), Ctrl+Space (non-stop), Home/End (first/last phrase), ? (help).
- **Settings**: Segmentation params, playback options, recording length multiplier, shortcuts list. Persisted in localStorage.
- **Recording (shadowing)**: Mic recording and A/B comparison are prepared (engine in `src/engine/recording.ts`); full UI for “record after phrase” and “play my recording” can be wired in next.

## Limitations (MVP)

- No subtitles, transcripts, or text features.
- No cloud sync or user accounts.
- Track list is in-memory only (refresh clears it); segmentation cache and settings survive refresh.
- Re-analyzing a track after changing segmentation requires re-uploading the file (or a future “Re-analyze” action).

## Project structure

- `src/engine/` – Audio decoding, silence-based segmentation, waveform peaks, playback (Web Audio), recording.
- `src/store/` – Zustand app state, settings load/save, track cache and phrase cache.
- `src/components/` – Library (sidebar + upload), PracticeView (waveform + zoom), PlaybackControls, Settings modal.
- `src/types/` – Track, Phrase, settings and app state types.

Design uses **universal tokens** in `src/index.css`: `--sf-primary` (#135bec), `--sf-bg`, `--sf-bg-card`, `--sf-bg-sidebar`, `--sf-border`, `--sf-text-muted`, and `--sf-font` (Inter). These match the existing UI designs in the parent folder (`stt_&_playback_configuration`, `stt_shadowing_practice_dashboard`). No STT/subtitle features are implemented; the app is phrase + waveform + playback + recording only.
