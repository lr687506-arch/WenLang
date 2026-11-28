# Word-level audio alignment

This Edge Function is the authenticated WenLang adapter between the reader and an external forced-alignment worker (for example, a WhisperX-based service).

## Supabase secrets

Configure these server-side secrets; never put them in frontend environment variables:

- `ALIGNMENT_SERVICE_URL`: base URL of the alignment worker.
- `ALIGNMENT_SERVICE_API_KEY`: optional bearer token expected by that worker.

The Edge Function is deployed with JWT verification enabled and independently checks the Supabase user. Only the author of the publication can request alignment.

## Worker contract

The function sends a `POST` request to `{ALIGNMENT_SERVICE_URL}/v1/align` with:

```json
{
  "audio_url": "https://<project>.supabase.co/storage/v1/object/public/wenlang-audios/...",
  "text": "Exact original text, including whitespace and line breaks",
  "language": "FR",
  "word_timestamps": true,
  "return_character_offsets": true
}
```

The worker must return JSON with `words`. Each item must include the exact source-character offsets (zero-based, end-exclusive) of the original word/token, plus audio times in seconds:

```json
{
  "words": [
    {
      "word": "Bonjour",
      "start": 0.12,
      "end": 0.58,
      "start_index": 0,
      "end_index": 7,
      "paragraph_index": 0
    }
  ]
}
```

Character offsets are essential: WenLang uses them to map repeated words to the correct occurrence in the article. The worker should include punctuation in the source span where it is part of the whitespace-delimited token. Times must be ordered, non-negative, and have `end > start`.

On success, the function saves an array in `texts.audio_timestamps` with `paragraphIndex`, `wordIndex`, `word`, `startSeconds`, `endSeconds`, `startIndex`, and `endIndex`. The existing column is JSONB, so no database migration is required.

## Current limitation

The Edge Function is ready, but alignment will return `503 ALIGNMENT_SERVICE_NOT_CONFIGURED` until an actual forced-alignment worker is hosted and its secrets are configured. The frontend's native TTS for selected text works independently of this worker.
