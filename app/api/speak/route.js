import { NextResponse } from "next/server";
import { toFile } from "openai";

import { extensionForMime } from "@/lib/audio";
import {
  DEFAULT_LEVEL,
  DEFAULT_MODE,
  DEFAULT_TOPIC,
  LEVEL_VALUES,
  MAX_AUDIO_BYTES,
  MODES,
  findPersona,
} from "@/lib/constants";
import { AppError, toApiError } from "@/lib/errors";
import {
  extractJsonObject,
  normalizeTurn,
  sanitizeHistory,
} from "@/lib/feedback";
import { getClient, MODELS } from "@/lib/openai";
import {
  buildSystemPrompt,
  buildUserPrompt,
  TRANSCRIPTION_PROMPT,
} from "@/lib/prompts";

// Whisper + GPT-4o need Node APIs (Buffer, multipart parsing) and more than a few
// seconds of runtime, so this route is always the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AUDIO_FIELD = "audio";
const ACCEPTED_MIME_PREFIXES = [
  "audio/",
  "video/webm",
  "application/octet-stream",
];
const MAX_DURATION_MS = 10 * 60 * 1000;

function normalizeLevel(value) {
  return LEVEL_VALUES.includes(value) ? value : DEFAULT_LEVEL;
}

/** Only "coach" and "persona" are accepted; anything else falls back to coach. */
function normalizeMode(value) {
  return MODES.some((mode) => mode.value === value) ? value : DEFAULT_MODE;
}

/** Resolves the virtual person used in "persona" mode (null when unknown). */
function normalizePersona(value) {
  return typeof value === "string" ? findPersona(value) : null;
}

/** Topic is user-supplied context, never instructions — strip anything exotic. */
function normalizeTopic(value) {
  if (typeof value !== "string") return DEFAULT_TOPIC;
  const cleaned = value
    .replace(/[\r\n\t"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned || DEFAULT_TOPIC;
}

/**
 * Converts an upstream (OpenAI) failure into an actionable, user-safe error.
 * The stage is logged and included in non-production details.
 */
function mapStageError(error, stage) {
  console.error(`[api/speak] stage "${stage}" failed`, {
    name: error?.name,
    status: error?.status,
    code: error?.code,
    message: error?.message,
  });

  if (error instanceof AppError) return error;

  const upstreamStatus =
    typeof error?.status === "number" &&
    error.status >= 400 &&
    error.status < 600
      ? error.status
      : 502;

  const details =
    process.env.NODE_ENV === "production"
      ? null
      : { stage, upstreamName: error?.name, upstreamMessage: error?.message };

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return new AppError(
      "The provider rejected the API key. Check OPENAI_API_KEY (or the per-capability key such as OPENAI_TRANSCRIBE_API_KEY) and restart the server.",
      { status: 502, code: "openai_auth_failed", details, cause: error },
    );
  }

  if (upstreamStatus === 404) {
    return new AppError(
      stage === "transcription"
        ? "The configured provider has no /audio/transcriptions endpoint. Check OPENAI_TRANSCRIBE_BASE_URL, OPENAI_TRANSCRIBE_MODEL and OPENAI_TRANSCRIBE_API_KEY."
        : "The configured provider has no /chat/completions endpoint for that model. Check OPENAI_CHAT_BASE_URL and OPENAI_CHAT_MODEL.",
      {
        status: 502,
        code: `${stage}_unsupported_endpoint`,
        details,
        cause: error,
      },
    );
  }

  if (upstreamStatus === 429) {
    return new AppError(
      "The provider's rate limit or quota was reached. Please wait a few seconds and try again.",
      { status: 429, code: "openai_rate_limited", details, cause: error },
    );
  }

  if (
    upstreamStatus === 408 ||
    error?.name === "TimeoutError" ||
    error?.name === "AbortError"
  ) {
    return new AppError(
      "The request to the provider timed out. Please try again.",
      {
        status: 504,
        code: "openai_timeout",
        details,
        cause: error,
      },
    );
  }

  return new AppError(
    stage === "transcription"
      ? "We could not transcribe that recording. Please try again."
      : "The coach could not prepare feedback. Please try again.",
    {
      status: upstreamStatus >= 500 ? 502 : upstreamStatus,
      code: `${stage}_failed`,
      details,
      cause: error,
    },
  );
}

/** GET is not supported; return a helpful 405 instead of a generic 404 page. */
export async function GET() {
  return NextResponse.json(
    {
      error: {
        message: "Use POST with multipart/form-data and an `audio` field.",
        code: "method_not_allowed",
      },
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(request) {
  const startedAt = Date.now();

  try {
    /* --------------------------------------------------------------------- */
    /* 0. Validate the request                                               */
    /* --------------------------------------------------------------------- */
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new AppError(
        "Expected multipart/form-data with an `audio` field.",
        {
          status: 415,
          code: "unsupported_media_type",
        },
      );
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      throw new AppError("The upload could not be read. Please record again.", {
        status: 400,
        code: "invalid_form_data",
      });
    }

    const audio = form.get(AUDIO_FIELD);
    if (
      !audio ||
      typeof audio === "string" ||
      typeof audio.arrayBuffer !== "function"
    ) {
      throw new AppError(
        "No audio file was received. Hold the microphone and try again.",
        {
          status: 400,
          code: "missing_audio",
        },
      );
    }
    if (!audio.size) {
      throw new AppError(
        "The recording is empty. Please speak a little longer.",
        {
          status: 400,
          code: "empty_audio",
        },
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      throw new AppError(
        "That recording is too large. Keep it under 60 seconds.",
        {
          status: 413,
          code: "audio_too_large",
        },
      );
    }
    if (
      audio.type &&
      !ACCEPTED_MIME_PREFIXES.some((prefix) => audio.type.startsWith(prefix))
    ) {
      throw new AppError(`Unsupported audio type: ${audio.type}.`, {
        status: 415,
        code: "unsupported_audio_type",
      });
    }

    const level = normalizeLevel(String(form.get("level") || ""));
    const topic = normalizeTopic(form.get("topic"));
    const mode = normalizeMode(String(form.get("mode") || ""));
    const persona = normalizePersona(form.get("persona"));
    const history = sanitizeHistory(form.get("history"));
    const parsedDuration = Number(form.get("durationMs"));
    const durationMs =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? Math.min(Math.round(parsedDuration), MAX_DURATION_MS)
        : null;

    // Resolve both connections up front so a misconfiguration fails fast with a
    // friendly 503 before we spend time on the upload. Each capability can use
    // its own provider (OPENAI_*_BASE_URL / OPENAI_*_API_KEY).
    const transcriptionClient = getClient("transcription");
    const chatClient = getClient("chat");

    /* --------------------------------------------------------------------- */
    /* Stage A — Speech to text (Whisper)                                    */
    /* --------------------------------------------------------------------- */
    const buffer = Buffer.from(await audio.arrayBuffer());
    const filename = `learner-turn.${extensionForMime(audio.type)}`;

    const transcriptionStartedAt = Date.now();
    let transcription;
    try {
      transcription = await transcriptionClient.audio.transcriptions.create({
        file: await toFile(buffer, filename, {
          type: audio.type || "audio/webm",
        }),
        model: MODELS.transcription,
        language: "en",
        response_format: "json",
        temperature: 0,
        // Biases Whisper towards the learner's phrasing; some gateways
        // (e.g. OpenRouter) accept but ignore this field.
        prompt: TRANSCRIPTION_PROMPT,
      });
    } catch (error) {
      throw mapStageError(error, "transcription");
    }

    const transcript = String(transcription?.text ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (!transcript) {
      throw new AppError(
        "We couldn't hear any speech in that recording. Try again in a quieter place and speak clearly.",
        { status: 422, code: "empty_transcript" },
      );
    }

    const transcriptionMs = Date.now() - transcriptionStartedAt;

    /* --------------------------------------------------------------------- */
    /* Stage B — Brain processing (GPT-4o with forced JSON output)           */
    /* --------------------------------------------------------------------- */
    const completionStartedAt = Date.now();
    let completion;
    try {
      completion = await chatClient.chat.completions.create({
        model: MODELS.chat,
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({ level, topic, mode, persona }),
          },
          {
            role: "user",
            content: buildUserPrompt({
              transcript,
              level,
              topic,
              history,
              assistantName: persona?.name || "Ava",
            }),
          },
        ],
      });
    } catch (error) {
      throw mapStageError(error, "chat");
    }
    const completionMs = Date.now() - completionStartedAt;

    const rawContent = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(rawContent);
    if (!parsed) {
      console.error(
        "[api/speak] model returned non-JSON content:",
        rawContent.slice(0, 400),
      );
      throw new AppError(
        "The AI returned an unreadable answer. Please try again.",
        {
          status: 502,
          code: "invalid_model_output",
        },
      );
    }

    /* --------------------------------------------------------------------- */
    /* Stage C — Normalise and return clean JSON to the client               */
    /* --------------------------------------------------------------------- */
    const turn = normalizeTurn(parsed, { transcript });

    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        transcript: turn.transcript,
        aiSpeech: turn.aiSpeech,
        feedback: turn.feedback,
        meta: {
          level,
          topic,
          mode,
          persona: persona ? { id: persona.id, name: persona.name } : null,
          durationMs,
          degraded: turn.degraded,
          models: { transcription: MODELS.transcription, chat: MODELS.chat },
          timings: {
            transcriptionMs,
            completionMs,
            totalMs: Date.now() - startedAt,
          },
          usage: completion?.usage ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}
