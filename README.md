# SpeakFlow — AI English Speaking Coach

A single-page English speaking practice app. Hold the microphone, speak, and get:

1. **A real conversation** — your speech is transcribed with Whisper and GPT-4o answers in character as a friendly coach.
2. **A detailed coaching report** — corrections, a natural rewrite, new vocabulary, praise and next steps for every turn.
3. **A spoken reply** — the AI answer is read aloud with OpenAI TTS and played through the Web Audio API.

Built with **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS v4** and the official **OpenAI Node SDK**.

---

## Features

| Area         | Details                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard    | Dark, responsive dashboard with a large hero microphone button, CEFR level + topic selectors.                                                                                                                           |
| Modes        | Switch between **Coach** (Ava) and **Virtual person** mode — talk to a character who answers your questions and asks their own. Four personas (Mia, Leo, Sofia, Daniel) with their own name, background and colour.     |
| Avatar       | Animated virtual person on screen: a face with blinking eyes whose **mouth moves in sync with the real amplitude of the spoken reply**, plus live captions of the sentence being said.                                  |
| Continuous   | **Continuous talk** toggle: a hands-free loop — the app auto-listens, detects the end of your turn by silence, replies out loud and listens again, and nudges you if you go quiet. The mic button becomes pause/resume. |
| Mic states   | **Idle** (blue gradient) → **Recording** (red + double pulse ring + level meter + countdown ring) → **Processing** (spinning loader), all announced to screen readers.                                                  |
| Recording    | `MediaRecorder` with codec negotiation (Opus/WebM → AAC/MP4 for Safari), press-and-hold **or** hands-free tap mode, 60 s cap, minimum-length guard, live RMS meter and timer.                                           |
| Conversation | Left column keeps the full history (your transcript vs. the coach's reply). Click any turn to review its feedback.                                                                                                      |
| Feedback     | Right column: score ring, 4 skill bars, corrections with exact quotes, native-style rewrite, vocabulary cards, praise, next steps.                                                                                      |
| Voice        | Spoken-reply toggle, per-message play button, stop-voice control, TTS failures degrade to a dismissible warning.                                                                                                        |
| Resilience   | Retry with the same audio blob, actionable microphone errors, abortable requests, `localStorage` session restore.                                                                                                       |
| A11y         | Keyboard-operable mic (`Space`/`Enter`), `aria-live` status, focus-visible rings, `motion-reduce` support.                                                                                                              |

---

## Tech stack

- **Next.js 15.5** — App Router, Node.js route handlers (`app/api/speak`, `app/api/tts`)
- **React 19** — client page + the `useVoiceRecorder` hook
- **Tailwind CSS v4** — CSS-first config in `app/globals.css` (`@theme` tokens + keyframes)
- **openai 6.x** — `whisper-1`, `gpt-4o` (JSON mode), `tts-1`
- **No extra UI/runtime dependencies** — icons and helpers are local

---

## Quick start

```bash
# 1. Install dependencies (Node.js >= 20.9 required)
npm install

# 2. Configure your key
cp .env.example .env.local
#    then edit .env.local and set OPENAI_API_KEY=sk-...
#    (using OpenRouter or another gateway? see "Using OpenRouter …" below)

# 3. Run
npm run dev          # http://localhost:3000

# Production
npm run build && npm start
```

> **Microphone requirements:** `getUserMedia` only works in a **secure context** — `http://localhost`,
> `http://127.0.0.1` or any **HTTPS** origin. Safari on iOS also requires a user gesture before audio playback,
> which the app handles by unlocking the `AudioContext` when you press the mic.

### Environment variables

| Variable                                                   | Required | Default     | Purpose                                                                                                    |
| ---------------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                                           | ✅       | –           | Server-only key used by `/api/speak` and `/api/tts`. Never exposed to the browser.                         |
| `OPENAI_CHAT_MODEL`                                        | –        | `gpt-4o`    | Model that writes `ai_speech` + feedback JSON.                                                             |
| `OPENAI_TRANSCRIBE_MODEL`                                  | –        | `whisper-1` | Speech-to-text model.                                                                                      |
| `OPENAI_TTS_MODEL`                                         | –        | `tts-1`     | Text-to-speech model.                                                                                      |
| `OPENAI_TTS_VOICE`                                         | –        | `alloy`     | Voice for spoken replies. Provider-specific (OpenAI: `alloy…verse`, Gemini TTS: `Kore`).                   |
| `OPENAI_BASE_URL`                                          | –        | OpenAI API  | Base URL for every capability. Point at an OpenAI-compatible gateway, e.g. `https://openrouter.ai/api/v1`. |
| `OPENAI_CHAT_BASE_URL` / `OPENAI_CHAT_API_KEY`             | –        | fall back   | Per-capability override — lets you mix providers.                                                          |
| `OPENAI_TRANSCRIBE_BASE_URL` / `OPENAI_TRANSCRIBE_API_KEY` | –        | fall back   | Per-capability override.                                                                                   |
| `OPENAI_TTS_BASE_URL` / `OPENAI_TTS_API_KEY`               | –        | fall back   | Per-capability override.                                                                                   |
| `OPENAI_TTS_INSTRUCTIONS`                                  | –        | –           | Delivery instructions for TTS models that support them (gpt-4o-mini-tts, Gemini TTS).                      |
| `OPENAI_APP_URL` / `OPENAI_APP_NAME`                       | –        | –           | Sent as `HTTP-Referer` / `X-OpenRouter-Title` for OpenRouter attribution.                                  |

`.env.local` is git-ignored. If the key is missing the API answers `503 missing_api_key` with a clear message
instead of crashing.

### Using OpenRouter (or any OpenAI-compatible provider)

Every capability talks to a plain OpenAI-compatible REST API, and each one can use a different provider.
OpenRouter supports all three endpoints the app needs (`/chat/completions`, `/audio/transcriptions`,
`/audio/speech`), so it can run the whole app:

```bash
# .env.local
OPENAI_API_KEY=sk-or-v1-…
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_CHAT_MODEL=openai/gpt-4o
OPENAI_TRANSCRIBE_MODEL=openai/whisper-1
OPENAI_TTS_MODEL=google/gemini-3.8-flash-tts
OPENAI_TTS_VOICE=Kore
# optional attribution on the OpenRouter leaderboards
OPENAI_APP_URL=https://your-app.example
OPENAI_APP_NAME=SpeakFlow
```

Notes:

- **Model slugs must be provider-prefixed** on a gateway (`openai/gpt-4o`, `openai/whisper-1`,
  `openai/gpt-4o-transcribe`, `elevenlabs/eleven-flash-v2.5`, `minimax/speech-2.8-turbo`, …). Discover them
  with `GET /api/v1/models?output_modalities=transcription` and `?output_modalities=speech`.
- **Voices are provider-specific.** `alloy…verse` only exist on OpenAI's TTS models; Gemini TTS uses e.g.
  `Kore`, ElevenLabs its own ids. Set `OPENAI_TTS_VOICE` to match.
- The route negotiates the audio container: it tries `mp3` then falls back to `pcm`, and wraps raw PCM
  into a WAV so the browser can play it. For pcm-only models (Gemini TTS, HeyGen Voice) set
  `OPENAI_TTS_FORMAT=pcm` to skip the retry.
- `prompt` is sent to Whisper but ignored by OpenRouter; multipart uploads there cap at 25 MB and the upstream
  provider times out after ~60 s per request — well outside our 60 s recording cap.
- Structured output (`response_format: {"type":"json_object"}`) is passed through. If a model/provider rejects
  it, the prompt still demands JSON (and the app extracts fenced/braced JSON), but a model that supports
  structured outputs will be noticeably more reliable.
- **Mixing providers** works per capability — e.g. OpenRouter for the brain, OpenAI for audio:

```bash
OPENAI_API_KEY=sk-…                         # fallback for everything
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_CHAT_MODEL=openai/gpt-4o
OPENAI_TRANSCRIBE_BASE_URL=https://api.openai.com/v1
OPENAI_TRANSCRIBE_API_KEY=sk-…
OPENAI_TRANSCRIBE_MODEL=whisper-1
OPENAI_TTS_BASE_URL=https://api.openai.com/v1
OPENAI_TTS_API_KEY=sk-…
OPENAI_TTS_MODEL=tts-1
```

If a provider lacks an endpoint, the API answers `502 <stage>_unsupported_endpoint` with a message naming the
variable to fix.

### Conversation modes (coach vs. virtual person)

The mode switch in the top bar changes **who you are talking to**:

| Mode               | Who replies               | Behaviour                                                                                                                                                                                              |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Coach**          | Ava, the English coach    | Keeps the conversation going, always ends with a follow-up question, and never lectures inside `ai_speech`.                                                                                            |
| **Virtual person** | Mia, Leo, Sofia or Daniel | A character with their own age, background, personality and colour. They **answer your question first**, then share or react, then **ask a question of their own** — like chatting with a real person. |

How it works:

- `lib/constants.js` holds `MODES` and `PERSONAS` (id, name, tagline, `prompt`, avatar colours).
- `buildSystemPrompt({ level, topic, mode, persona })` injects the persona description as the model's identity and
  swaps in persona-specific rules: answer first, ask next, stay in character, never mention the feedback object.
- The **same JSON contract** is used in both modes, so the right-hand coaching panel keeps working. In persona mode
  the character never sees or mentions that feedback.
- You can ask questions in _any_ mode (the coach answers too) — persona mode simply biases the reply towards a
  natural two-way chat instead of teaching.
- Every turn stores `mode` + `persona` in `meta`, so each chat bubble is labelled with whoever actually said it,
  even after you switch characters mid-session.
- Mode and persona are persisted in `localStorage` together with the rest of the session.
- Switching mode/persona stops any voice that is currently playing.

### The virtual person on screen (avatar + real lip-sync)

The avatar stage at the top of the conversation column always shows **who is talking to you**:

- **Mouth** — driven by `speakingLevel` (0..1), which comes from an `AnalyserNode` tapping the TTS output in
  `lib/audio.js`. The mouth opens with the real amplitude of the voice, so it is lip-sync, not a fake loop.
- **Eyes** — blink on a timer (`avatar-blink`), widen while you speak, and the pupils look up while the model thinks.
- **States** — `idle` → `listening` (mic open, rose pulse ring) → `thinking` (turn processing) → `speaking`
  (persona-coloured glow + rising equalizer bars), shown as a badge under the face.
- **Captions** — the sentence being spoken is written under the face (`aria-live`), so you can read along.
- **Identity** — name, tagline and colours come from the active persona's `palette`, shared with the small chat avatars.

Everything is local SVG + Web Audio: **no external avatar service and no extra dependency**. Because `AvatarStage`
is a plain component driven by `{ speaker, state, level, caption }`, you can later swap it for a real video avatar
(HeyGen, D-ID, Tavus) behind the same props, or add a `/api/avatar` route that mints their session token.

### Continuous talk (hands-free conversation)

Switch on **Continuous talk** in the recorder dock and the app behaves like a phone call — you never press
anything between turns:

1. The partner greets you out loud (when the session is empty).
2. The moment the voice stops, the **mic opens automatically**.
3. While you talk, a voice-activity detector watches the input. After ~1.5 s of silence your turn is ended,
   the audio is sent, and the coach answers.
4. The reply is spoken, then the mic opens again → the loop continues.
5. If you stay quiet for ~25 s, the partner **nudges** the conversation once (“No rush, I’m still here…”) and
   keeps listening.

Controls:

- The **big mic button becomes the loop control**: tap to pause (stops listening and stops the voice), tap again
  to resume. It also shows the loop phase — `Listening` (red) → `Thinking` (indigo) → `Speaking` (sky).
- The **Continuous talk** chip starts/stops the whole loop; turning it on also turns spoken replies on.
- An API error **pauses** the loop so the message is readable (no endless failure loop); the retry button still works.
- Short noises (a cough, a door slam) are discarded silently instead of showing “too short”.

How it works:

- `hooks/useVoiceRecorder.js` gained a VAD: while recording it remembers the last frame whose RMS exceeded
  `threshold` and fires `vad.onSpeech` / `vad.onSilence` (plus `vad.onDiscard` for takes that are too short).
- `app/page.js` orchestrates the loop with refs (`continuousRef`, `loopPausedRef`, `afterSpeakRef`,
  `beginListeningRef`) so async callbacks always read the latest state; `speak()` calls `afterSpeakRef` when the
  audio finishes, which re-opens the mic.
- Tuning knobs sit at the top of `app/page.js`: `TURN_SILENCE_MS` (1500 ms), `SPEECH_THRESHOLD` (0.045) and
  `LISTEN_NUDGE_MS` (25 s). Raise the threshold in a noisy room.
- The flag is remembered in `localStorage`, but a restored session starts **paused** so the mic never opens on
  page load without you asking.

Add your own character by appending an object to `PERSONAS`:

```js
{
  id: "emma",
  name: "Emma",
  tagline: "Nurse · weekend hiker",
  prompt: "You are Emma, 32, a nurse who loves hiking …",
  textTone: "text-fuchsia-300",
  avatarClass: "from-fuchsia-400 to-pink-400",
}
```

---

## Project structure

```
.
├── app/
│   ├── api/
│   │   ├── speak/route.js      # Whisper → GPT-4o JSON → clean response
│   │   └── tts/route.js        # tts-1 → audio/mpeg bytes
│   ├── globals.css             # Tailwind v4 theme, keyframes, utilities
│   ├── icon.svg                # favicon
│   ├── layout.js               # metadata + document shell
│   └── page.js                 # dashboard: state, recording flow, layout
├── components/
│   ├── ChatPanel.jsx           # history column (bubbles, pending skeleton)
│   ├── FeedbackPanel.jsx       # coaching report column
│   ├── LevelMeter.jsx          # deterministic RMS bar visualiser
│   ├── MicButton.jsx           # idle / recording / processing states
│   ├── RecorderDock.jsx        # mic + meter + toggles + error banner
│   ├── TopBar.jsx              # brand, CEFR level, topic, voice toggle
│   └── icons.jsx               # inline SVG icon set
├── hooks/
│   └── useVoiceRecorder.js     # MediaRecorder lifecycle, meter, error mapping
├── lib/
│   ├── audio.js                # codec detection, AudioContext playback
│   ├── constants.js            # levels, topics, limits (shared client/server)
│   ├── errors.js               # AppError + safe API error mapping
│   ├── feedback.js             # JSON extraction + defensive normalisation
│   ├── openai.js               # lazy SDK client + model config
│   ├── prompts.js              # system prompt & JSON contract
│   └── utils.js                # cn(), formatters, score colours
├── .env.example
├── jsconfig.json               # "@/*" path alias
├── next.config.mjs
├── package.json
└── postcss.config.mjs
```

---

## How a turn flows

```
Browser                                   Server (Node runtime)
─────────────────────────────────────────────────────────────────────────────
pointer down ──► getUserMedia
                 MediaRecorder.start(250ms)
                 AnalyserNode → live level meter
pointer up   ──► blob (audio/webm | audio/mp4)
                 POST /api/speak  (multipart: audio, level, topic, mode, persona, durationMs, history)
                                          │
                                          ├─ validate size / MIME / fields
                                          ├─ Whisper  (whisper-1, language=en)
                                          ├─ GPT-4o   (response_format: json_object)
                                          ├─ extract + normalise JSON
                                          └─ 200 { transcript, aiSpeech, feedback, meta }
◄────────────── JSON ────────────────────┘
render user + AI bubbles, render feedback
POST /api/tts { text } ──────────────────► tts-1 → audio/mpeg
◄────────────── bytes ────────────────────┘
decodeAudioData → AudioBufferSourceNode → speakers
```

- The **transcript** is always shown (never the raw model text).
- The **feedback** object is normalised server-side, so a malformed model response can never crash the UI
  (`meta.degraded` flags partial data).
- Conversation context sent to the model is the last 6 turns (text only), capped and sanitised.
- Every request is abortable; a new session or unmount cancels in-flight work and stops playback.

---

## API reference

### `POST /api/speak`

`Content-Type: multipart/form-data`

| Field        | Type        | Notes                                                                                                  |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------ |
| `audio`      | File        | Required. WebM/Opus, MP4/AAC, OGG, MP3 or WAV. Max 20 MB (Whisper's limit is 25 MB).                   |
| `level`      | string      | `A2 \| B1 \| B2 \| C1` (defaults to `B1` when unknown).                                                |
| `topic`      | string      | Conversation topic, max 60 chars, newlines stripped.                                                   |
| `mode`       | string      | `coach` (default) or `persona`. Unknown values fall back to `coach`.                                   |
| `persona`    | string      | Virtual-person id used when `mode=persona` (`mia`, `leo`, `sofia`, `daniel`). Unknown ids are ignored. |
| `durationMs` | number      | Recording length, echoed back in `meta`.                                                               |
| `history`    | JSON string | `[{ role: "user" \| "assistant", text }]` — the last 6 entries are used.                               |

Success `200`:

```json
{
  "id": "0f2c…",
  "transcript": "Yesterday I go to the market and buyed some vegetables.",
  "aiSpeech": "I love a good market trip! What did you cook with those vegetables?",
  "feedback": {
    "overallScore": 72,
    "summary": "Clear message with two small past-tense slips.",
    "scores": {
      "grammar": 65,
      "vocabulary": 70,
      "fluency": 80,
      "naturalness": 75
    },
    "corrections": [
      {
        "original": "I go",
        "corrected": "I went",
        "type": "tense",
        "explanation": "Use the past simple with 'yesterday'."
      }
    ],
    "betterPhrasing": { "original": "…", "improved": "…", "why": "…" },
    "vocabulary": [
      {
        "word": "produce",
        "partOfSpeech": "noun",
        "meaning": "Fresh fruit and vegetables.",
        "example": "…",
        "level": "B1"
      }
    ],
    "praise": ["You linked two actions with 'and' very clearly."],
    "nextSteps": ["Drill irregular past forms."]
  },
  "meta": {
    "level": "B1",
    "topic": "Daily life",
    "mode": "persona",
    "persona": { "id": "mia", "name": "Mia" },
    "durationMs": 4200,
    "degraded": false,
    "models": { "transcription": "whisper-1", "chat": "gpt-4o" },
    "timings": {
      "transcriptionMs": 1180,
      "completionMs": 2240,
      "totalMs": 3450
    },
    "usage": {
      "prompt_tokens": 420,
      "completion_tokens": 260,
      "total_tokens": 680
    }
  }
}
```

Errors share the envelope `{ "error": { "message", "code", "details" } }`:

| Status | Code                                                                                          | When                                                                                    |
| ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 400    | `missing_audio`, `empty_audio`, `invalid_form_data`                                           | Malformed request body.                                                                 |
| 413    | `audio_too_large`                                                                             | Upload above 20 MB.                                                                     |
| 415    | `unsupported_media_type`, `unsupported_audio_type`                                            | Wrong content type / codec.                                                             |
| 422    | `empty_transcript`                                                                            | Whisper heard nothing.                                                                  |
| 429    | `openai_rate_limited`                                                                         | Upstream quota / rate limit.                                                            |
| 502    | `transcription_failed`, `chat_failed`, `invalid_model_output`, `openai_auth_failed`           | Upstream or model failure.                                                              |
| 502    | `transcription_unsupported_endpoint`, `chat_unsupported_endpoint`, `tts_unsupported_endpoint` | The configured provider has no such endpoint — check the `OPENAI_*_BASE_URL` overrides. |
| 503    | `missing_api_key`                                                                             | `OPENAI_API_KEY` not configured.                                                        |
| 504    | `openai_timeout`                                                                              | Upstream timeout.                                                                       |
| 405    | `method_not_allowed`                                                                          | `GET` on a POST-only route.                                                             |

### `POST /api/tts`

Request `{ "text": "…", "voice": "alloy", "speed": 1, "instructions": "…" }` (max 600 chars) → `200` with
`audio/mpeg` (or `audio/wav` when the provider only speaks raw PCM), `Cache-Control: no-store`.

`voice` is provider-specific and can be any safe string (falls back to `OPENAI_TTS_VOICE`); `instructions` is
only sent when provided (or set via `OPENAI_TTS_INSTRUCTIONS`).

**Container negotiation:** the route tries `mp3` first (or `OPENAI_TTS_FORMAT`), and if the provider rejects it
with a 400/415/422 it retries the other container (`pcm`). If a model returns raw PCM it is wrapped into a WAV
server-side, so the browser can always decode it. `X-TTS-Format` echoes which container was actually returned.

Errors: `400 missing_text`, `413 text_too_long`, `429 openai_rate_limited`, `502 tts_failed`,
`502 tts_bad_request`, `502 tts_unsupported_endpoint`, `502 openai_auth_failed`, `502 provider_payment_required`,
`503 missing_api_key`, `504 openai_timeout`.

---

## The model contract

`lib/prompts.js` forces a single JSON object (no markdown) with this shape:

```json
{
  "transcript_clean": "string",
  "ai_speech": "string",
  "feedback": {
    "overall_score": 0,
    "summary": "string",
    "scores": { "grammar": 0, "vocabulary": 0, "fluency": 0, "naturalness": 0 },
    "corrections": [
      { "original": "", "corrected": "", "type": "tense", "explanation": "" }
    ],
    "better_phrasing": { "original": "", "improved": "", "why": "" },
    "vocabulary": [
      {
        "word": "",
        "part_of_speech": "",
        "meaning": "",
        "example": "",
        "level": "B1"
      }
    ],
    "praise": ["…"],
    "next_steps": ["…"]
  }
}
```

Guardrails baked into the prompt:

- `ai_speech` is 2–4 spoken sentences, level-appropriate, ending with **one** follow-up question.
- Corrections quote an **exact substring** of the transcript, use the smallest possible fix, max 5.
- Vocabulary suggestions must be words the learner did **not** use, at/above their level, max 3.
- The transcript is treated as **untrusted data** (prompt-injection resistant).
- Pronunciation is never judged from text alone.

`lib/feedback.js` then coerces scores, drops empty entries, de-duplicates corrections, caps array lengths and
provides safe fallbacks — the UI never receives a field it cannot render.

---

## Error handling & edge cases

| Situation                                       | Behaviour                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| Mic permission denied / no device / device busy | Friendly message in the recorder dock; nothing else breaks.         |
| Non-secure origin (LAN IP over HTTP)            | Explains that HTTPS or localhost is required.                       |
| Tap too short (< 0.7 s or ~1.2 KB)              | Local rejection with “hold a little longer” — no API call.          |
| Released before the permission prompt resolves  | Take is cancelled instead of recording indefinitely.                |
| 60 s limit reached                              | Auto-stops and sends the turn.                                      |
| Network / API failure                           | Error banner with **Retry** using the retained audio blob.          |
| Model returns non-JSON                          | `502 invalid_model_output` (logged server-side, never shown raw).   |
| TTS fails or is blocked                         | Turn still renders; dismissible warning only.                       |
| New session / unmount                           | Aborts in-flight requests, stops playback, releases the microphone. |

---

## Browser support

| Browser            | Recording format         | Notes                                                    |
| ------------------ | ------------------------ | -------------------------------------------------------- |
| Chrome / Edge      | `audio/webm;codecs=opus` | Fully supported.                                         |
| Firefox            | `audio/webm;codecs=opus` | Fully supported.                                         |
| Safari 14.1+ / iOS | `audio/mp4` (AAC)        | Requires HTTPS + a gesture; audio unlocked on mic press. |

---

## Deployment (Vercel or any Node host)

1. Push the repo and import it — Next.js is auto-detected.
2. Add `OPENAI_API_KEY` (and any optional overrides) in **Project → Settings → Environment Variables**.
3. Both routes declare `runtime = "nodejs"` and `maxDuration = 60`. Vercel Hobby caps functions lower than 60 s,
   so keep recordings short there or raise the limit on a Pro plan.
4. No database is required: conversation history lives in the browser (`localStorage`), and audio is never stored
   by the app.

**Cost control:** `max_tokens` is capped at 1200, context at 6 turns, TTS uses `tts-1` (not `tts-1-hd`) and
recordings stop at 60 s. Turn “Spoken replies” off to skip TTS entirely.

---

## Scripts

```bash
npm run dev     # dev server with fast refresh
npm run build   # production build
npm start       # serve the production build
```

> Running a build while `next dev` is up? Both write to `.next`, which can fail with
> `ENOENT … .next/server/…`. Build into a separate folder instead:
>
> ```bash
> NEXT_DIST_DIR=.next-verify npm run build
> ```

## Notes & limitations

- Feedback is derived from the Whisper **transcript**, so accent/pronunciation scoring is intentionally out of scope.
- The app is a single page by design; there is no auth and no server-side persistence.
- `localStorage` keeps only text (transcripts, replies, feedback), capped at the last 24 turns.
