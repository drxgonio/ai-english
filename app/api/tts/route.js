import { NextResponse } from "next/server";

import { MAX_TTS_CHARS } from "@/lib/constants";
import { AppError, toApiError } from "@/lib/errors";
import {
  DEFAULT_TTS_VOICE,
  getClient,
  MODELS,
  TTS_INSTRUCTIONS,
} from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Voice identifiers are provider-specific (`alloy` on OpenAI, `Kore` on Gemini
 * TTS, `Rachel` on ElevenLabs, …), so we only reject obviously unsafe values
 * instead of allow-listing a single provider's names.
 */
const VOICE_PATTERN = /^[\w .:+-]{1,64}$/;

/**
 * Output containers differ per model: Gemini TTS and HeyGen Voice only return
 * `pcm`, MiniMax only returns `mp3`. We try the configured preference first and
 * transparently fall back to the other container when a provider rejects it.
 */
const PREFERRED_FORMAT =
  (process.env.OPENAI_TTS_FORMAT || "").trim().toLowerCase() === "pcm"
    ? "pcm"
    : "mp3";
const FORMAT_CANDIDATES =
  PREFERRED_FORMAT === "pcm" ? ["pcm", "mp3"] : ["mp3", "pcm"];

/** Raw PCM has no container, so we wrap it as WAV (openai/gemini PCM is 24 kHz mono 16-bit). */
const PCM_SAMPLE_RATE = Number(process.env.OPENAI_TTS_SAMPLE_RATE) || 24_000;

/** Identifies the container of the bytes a provider returned. */
function sniffContainer(bytes) {
  const head = bytes.toString("latin1", 0, 4);
  if (head === "RIFF") return { kind: "wav", contentType: "audio/wav" };
  if (head === "OggS") return { kind: "ogg", contentType: "audio/ogg" };
  if (head === "fLaC") return { kind: "flac", contentType: "audio/flac" };
  if (head === "ID3") return { kind: "mp3", contentType: "audio/mpeg" };
  if (bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { kind: "mp3", contentType: "audio/mpeg" };
  }
  // No recognisable header => treat it as raw PCM and give it one.
  return { kind: "pcm", contentType: "audio/wav" };
}

/** Wraps raw PCM in a WAV container so `decodeAudioData` can play it. */
function pcmToWav(
  pcm,
  sampleRate = PCM_SAMPLE_RATE,
  channels = 1,
  bitsPerSample = 16,
) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Turns an upstream TTS failure into an actionable error. */
function mapSpeechError(error) {
  const status = typeof error?.status === "number" ? error.status : 502;
  const details =
    process.env.NODE_ENV === "production"
      ? null
      : { upstreamMessage: error?.message, upstreamStatus: status };

  if (status === 401 || status === 403) {
    return new AppError(
      "The provider rejected the API key. Check OPENAI_API_KEY (or OPENAI_TTS_API_KEY).",
      { status: 502, code: "openai_auth_failed", details },
    );
  }
  if (status === 402) {
    return new AppError(
      "The provider refused the request (HTTP 402 — usually no credit left). Top up the account and try again.",
      { status: 502, code: "provider_payment_required", details },
    );
  }
  if (status === 404) {
    return new AppError(
      "The configured provider has no /audio/speech endpoint. Check OPENAI_TTS_BASE_URL and OPENAI_TTS_MODEL.",
      { status: 502, code: "tts_unsupported_endpoint", details },
    );
  }
  if (status === 429) {
    return new AppError("TTS rate limit reached. Please try again shortly.", {
      status: 429,
      code: "openai_rate_limited",
      details,
    });
  }
  if (status === 408 || error?.name === "TimeoutError") {
    return new AppError(
      "The text-to-speech request timed out. Please try again.",
      {
        status: 504,
        code: "openai_timeout",
        details,
      },
    );
  }
  if (status === 400 || status === 415 || status === 422) {
    return new AppError(
      "The TTS model, voice or audio format was rejected. Check OPENAI_TTS_MODEL, OPENAI_TTS_VOICE and OPENAI_TTS_FORMAT.",
      { status: 502, code: "tts_bad_request", details },
    );
  }

  return new AppError("Could not generate the spoken reply.", {
    status: 502,
    code: "tts_failed",
    details,
  });
}

/**
 * POST /api/tts
 * Body: { text: string, voice?: string, speed?: number, instructions?: string }
 * Returns: playable audio — `audio/mpeg`, or `audio/wav` when the provider only
 * speaks raw PCM (Gemini TTS, HeyGen Voice).
 *
 * Keeping TTS behind a route handler means the API key never reaches the
 * browser, and we can cap the input length (most providers allow ~4096 chars).
 */
export async function POST(request) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      throw new AppError("Expected a JSON body with a `text` field.", {
        status: 400,
        code: "invalid_json",
      });
    }

    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) {
      throw new AppError("`text` is required to generate speech.", {
        status: 400,
        code: "missing_text",
      });
    }
    if (text.length > MAX_TTS_CHARS) {
      throw new AppError(
        `\`text\` must be ${MAX_TTS_CHARS} characters or fewer.`,
        {
          status: 413,
          code: "text_too_long",
        },
      );
    }

    const requestedVoice =
      typeof payload?.voice === "string" ? payload.voice.trim() : "";
    const voice = VOICE_PATTERN.test(requestedVoice)
      ? requestedVoice
      : DEFAULT_TTS_VOICE;

    const requestedSpeed = Number(payload?.speed);
    const speed = Number.isFinite(requestedSpeed)
      ? Math.min(4, Math.max(0.25, requestedSpeed))
      : null;

    const instructions =
      typeof payload?.instructions === "string" && payload.instructions.trim()
        ? payload.instructions.trim().slice(0, 300)
        : TTS_INSTRUCTIONS;

    const client = getClient("speech");

    const speechRequest = {
      model: MODELS.speech,
      input: text,
      voice,
    };
    // Provider-specific extras are only sent when requested: unknown fields are
    // rejected outright by several providers.
    if (speed !== null) speechRequest.speed = speed;
    if (instructions) speechRequest.instructions = instructions;

    // Try the preferred container, then the other one (Gemini TTS is pcm-only,
    // MiniMax is mp3-only). Auth/quota/network errors are not worth retrying.
    let audioBuffer = null;
    let usedFormat = null;
    let firstError = null;

    for (const format of FORMAT_CANDIDATES) {
      try {
        const speech = await client.audio.speech.create({
          ...speechRequest,
          response_format: format,
        });
        audioBuffer = Buffer.from(await speech.arrayBuffer());
        usedFormat = format;
        break;
      } catch (error) {
        firstError = firstError ?? error;
        console.error(
          `[api/tts] request with response_format="${format}" failed`,
          {
            name: error?.name,
            status: error?.status,
            message: error?.message,
          },
        );

        if (![400, 415, 422].includes(error?.status)) break;
      }
    }

    if (!audioBuffer)
      throw mapSpeechError(firstError ?? new Error("Unknown TTS failure"));

    // Some providers ignore the requested container and return raw PCM.
    const { kind, contentType } = sniffContainer(audioBuffer);
    if (kind !== usedFormat) {
      console.warn(
        `[api/tts] requested "${usedFormat}" but the provider returned "${kind}"`,
      );
    }

    const body = kind === "pcm" ? pcmToWav(audioBuffer) : audioBuffer;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        // Replies are unique per turn; avoid caching them in shared proxies.
        "Cache-Control": "no-store",
        // Handy when debugging which container a model actually returned.
        "X-TTS-Format": kind,
        "X-TTS-Model": MODELS.speech,
      },
    });
  } catch (error) {
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: {
        message: "Use POST with a JSON body: { text, voice?, speed? }.",
        code: "method_not_allowed",
      },
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
