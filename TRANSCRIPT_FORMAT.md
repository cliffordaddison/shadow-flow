# Transcript JSON Format

ShadowAudio supports loading transcript files in JSON format. The transcript should have the same base name as your audio file.

## File Naming

For an audio file named `lesson01.mp3`, the transcript should be named `lesson01.json`.

## JSON Structure

```json
{
  "segments": [
    {
      "text": "Bonjour",
      "translation": "Hello",
      "startTime": 0.0,
      "endTime": 0.5
    },
    {
      "text": "Comment allez-vous?",
      "translation": "How are you?",
      "startTime": 0.5,
      "endTime": 1.8
    }
  ]
}
```

## Field Descriptions

### Required Fields

- **`segments`** (array): Array of transcript segments
  - **`text`** (string): The original language text (e.g., French)

### Optional Fields

- **`translation`** (string): Translation of the text (e.g., English)
- **`startTime`** (number): Start time in seconds (defaults to phrase start time)
- **`endTime`** (number): End time in seconds (defaults to phrase end time)

## Notes

- Segments are aligned to audio phrases by index
- If `startTime`/`endTime` are omitted, they will be inferred from the audio phrase segmentation
- If no transcript JSON is provided, the app will attempt to auto-generate transcripts using Speech-to-Text (STT)
- Transcripts are cached in browser localStorage by audio file hash for faster loading

## Example: Minimal Transcript

If you only have the text without timing information:

```json
{
  "segments": [
    { "text": "Bonjour" },
    { "text": "Comment allez-vous?" },
    { "text": "Je vais bien, merci." }
  ]
}
```

The app will automatically align these to the detected audio phrases.

## Example: With Translations Only

```json
{
  "segments": [
    { "text": "Bonjour", "translation": "Hello" },
    { "text": "Comment allez-vous?", "translation": "How are you?" },
    { "text": "Je vais bien, merci.", "translation": "I'm fine, thank you." }
  ]
}
```
