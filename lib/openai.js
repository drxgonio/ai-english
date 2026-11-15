import OpenAI from "openai";

import { AppError } from "@/lib/errors";

/**
 * Central place for every model identifier used by the app. Values can be
 * overridden with env vars so a deployment can pin (or roll back) a model
 * without a code change.
 *
 * When you point the app at a gateway such as OpenRouter, use the provider
 * prefixes: `openai/gpt-4o`, `openai/whisper-1`, `google/gemini-3.8-flash-tts`, …
 */
export const MODELS = {
  transcription: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
  chat: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
  speech: process.env.OPENAI_TTS_MODEL || "tts-1",
};

export const DEFAULT_TTS_VOICE =
  process.env.OPENAI_TTS_VOICE?.trim() || "alloy";

/** Optional delivery instructions (honoured by gpt-4o-mini-tts, Gemini TTS, …). */
export const TTS_INSTRUCTIONS =
  process.env.OPENAI_TTS_INSTRUCTIONS?.trim() || "";

/** Voices accepted by OpenAI's own speech endpoint. */
export const TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
];

/**
 * Every capability resolves its own connection settings, so a deployment can
 * mix providers (e.g. OpenRouter for the brain, OpenAI for audio):
 *
 *   OPENAI_TRANSCRIBE_BASE_URL / OPENAI_TRANSCRIBE_API_KEY
 *   OPENAI_CHAT_BASE_URL       / OPENAI_CHAT_API_KEY
 *   OPENAI_TTS_BASE_URL        / OPENAI_TTS_API_KEY
 *
 * Anything unset falls back to OPENAI_BASE_URL / OPENAI_API_KEY, which makes
 * single-provider setups — OpenAI itself or any OpenAI-compatible gateway such
 * as OpenRouter, LiteLLM, Azure OpenAI or Groq — a two-variable change.
 */
const CAPABILITIES = {
  transcription: {
    baseUrlEnv: "OPENAI_TRANSCRIBE_BASE_URL",
    apiKeyEnv: "OPENAI_TRANSCRIBE_API_KEY",
    label: "speech-to-text",
  },
  chat: {
    baseUrlEnv: "OPENAI_CHAT_BASE_URL",
    apiKeyEnv: "OPENAI_CHAT_API_KEY",
    label: "chat",
  },
  speech: {
    baseUrlEnv: "OPENAI_TTS_BASE_URL",
    apiKeyEnv: "OPENAI_TTS_API_KEY",
    label: "text-to-speech",
  },
};

/** One cached SDK client per capability. */
const clients = new Map();

/**
 * Optional attribution headers. OpenRouter uses these for app leaderboards;
 * other gateways simply ignore them.
 */
function attributionHeaders() {
  const headers = {};
  const siteUrl = process.env.OPENAI_APP_URL?.trim();
  const siteName = process.env.OPENAI_APP_NAME?.trim();

  if (siteUrl) headers["HTTP-Referer"] = siteUrl;
  if (siteName) {
    headers["X-OpenRouter-Title"] = siteName;
    headers["X-Title"] = siteName; // legacy OpenRouter header
  }

  return headers;
}

/** Resolves the key + base URL used for one capability. */
export function resolveConnection(capability = "chat") {
  const config = CAPABILITIES[capability];
  if (!config) {
    throw new AppError(`Unknown capability "${capability}".`, {
      status: 500,
      code: "invalid_capability",
    });
  }

  const apiKey =
    process.env[config.apiKeyEnv]?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    throw new AppError(
      `The server is not configured for ${config.label}: set OPENAI_API_KEY (or ${config.apiKeyEnv}) in .env.local and restart the server.`,
      { status: 503, code: "missing_api_key" },
    );
  }

  const baseURL =
    process.env[config.baseUrlEnv]?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    undefined;

  return { apiKey, baseURL, label: config.label };
}

/**
 * Lazily creates the SDK client for `capability` ("transcription" | "chat" |
 * "speech"). Throwing a typed `AppError` (instead of crashing the route) lets
 * the UI show an actionable message when configuration is missing.
 */
export function getClient(capability = "chat") {
  const cached = clients.get(capability);
  if (cached) return cached;

  const { apiKey, baseURL } = resolveConnection(capability);

  const client = new OpenAI({
    apiKey,
    // Undefined = the SDK default (https://api.openai.com/v1).
    baseURL,
    defaultHeaders: attributionHeaders(),
    // Keep requests inside the platform's function timeout budget.
    timeout: 45_000,
    // The SDK retries 408/409/429/5xx with exponential backoff automatically.
    maxRetries: 2,
  });

  clients.set(capability, client);
  return client;
}

/** @deprecated Prefer `getClient("chat" | "transcription" | "speech")`. */
export function getOpenAIClient() {
  return getClient("chat");
}

/** True when at least one API key is configured. */
export function isOpenAIConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.OPENAI_CHAT_API_KEY?.trim() ||
      process.env.OPENAI_TRANSCRIBE_API_KEY?.trim() ||
      process.env.OPENAI_TTS_API_KEY?.trim(),
  );
}
