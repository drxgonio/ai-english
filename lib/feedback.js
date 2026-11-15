import { AppError } from "@/lib/errors";
import { MAX_CONTEXT_TURNS } from "@/lib/constants";

const CORRECTION_TYPES = new Set([
  "grammar",
  "tense",
  "article",
  "preposition",
  "word-order",
  "vocabulary",
  "pronunciation",
  "spelling",
  "style",
  "naturalness",
]);

const VOCAB_LEVELS = new Set(["A2", "B1", "B2", "C1", "C2"]);

/** Safely pull a JSON object out of a model response (handles stray fences). */
export function extractJsonObject(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;

  let candidate = raw.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidate = fenced[1].trim();

  try {
    return JSON.parse(candidate);
  } catch {
    /* fall through to brace slicing */
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

const asText = (value, max = 600) => {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
};

const asLongText = (value, max = 2000) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

/** Accepts 0-100, 0-1 fractions and numeric strings; returns null when unusable. */
function asScore(value) {
  const raw =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(raw)) return null;
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.round(Math.min(100, Math.max(0, scaled)));
}

function asStringArray(value, maxItems = 3, maxLength = 220) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return source
    .map((item) => asText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeCorrections(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const corrections = [];

  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const original = asText(item.original, 300);
    const corrected = asText(item.corrected, 300);
    if (!original || !corrected || original === corrected) continue;

    const dedupeKey = `${original}→${corrected}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    corrections.push({
      original,
      corrected,
      type: CORRECTION_TYPES.has(item.type) ? item.type : "grammar",
      explanation: asText(item.explanation, 260),
    });

    if (corrections.length >= 5) break;
  }

  return corrections;
}

function normalizeVocabulary(value) {
  const source = Array.isArray(value) ? value : [];
  const items = [];

  for (const item of source) {
    const word =
      typeof item === "string"
        ? asText(item, 60)
        : asText(item?.word ?? item?.term, 60);
    if (!word) continue;

    items.push({
      word,
      partOfSpeech: asText(item?.part_of_speech ?? item?.partOfSpeech, 30),
      meaning: asText(item?.meaning ?? item?.definition, 220),
      example: asText(item?.example, 260),
      level: VOCAB_LEVELS.has(item?.level) ? item.level : "",
    });

    if (items.length >= 3) break;
  }

  return items;
}

function normalizeBetterPhrasing(value) {
  if (!value || typeof value !== "object") return null;
  const improved = asText(value.improved ?? value.better, 400);
  if (!improved) return null;

  return {
    original: asText(value.original, 400),
    improved,
    why: asText(value.why ?? value.reason, 260),
  };
}

/**
 * Turns the raw GPT-4o payload into a stable shape the UI can render without
 * defensive checks. Anything missing is filled with a sensible, non-invented
 * fallback and flagged through `degraded`.
 */
export function normalizeTurn(payload, { transcript }) {
  if (!payload || typeof payload !== "object") {
    throw new AppError(
      "The AI response could not be understood. Please try again.",
      {
        status: 502,
        code: "invalid_model_output",
      },
    );
  }

  const feedbackSource =
    payload.feedback && typeof payload.feedback === "object"
      ? payload.feedback
      : payload;

  const aiSpeech = asLongText(
    payload.ai_speech ?? payload.aiSpeech ?? payload.reply,
    1600,
  );
  if (!aiSpeech) {
    throw new AppError("The AI reply was empty. Please try again.", {
      status: 502,
      code: "invalid_model_output",
      details: { receivedKeys: Object.keys(payload).slice(0, 10) },
    });
  }

  const scoresSource =
    feedbackSource.scores && typeof feedbackSource.scores === "object"
      ? feedbackSource.scores
      : feedbackSource;

  const scores = {
    grammar: asScore(scoresSource.grammar),
    vocabulary: asScore(scoresSource.vocabulary),
    fluency: asScore(scoresSource.fluency),
    naturalness: asScore(scoresSource.naturalness),
  };

  const providedScores = Object.values(scores).filter(
    (score) => score !== null,
  );
  const averagedScore = providedScores.length
    ? Math.round(
        providedScores.reduce((sum, score) => sum + score, 0) /
          providedScores.length,
      )
    : null;

  const overallScore =
    asScore(feedbackSource.overall_score ?? feedbackSource.overallScore) ??
    averagedScore;

  const corrections = normalizeCorrections(
    feedbackSource.corrections ?? feedbackSource.mistakes,
  );

  const summary = asText(feedbackSource.summary ?? feedbackSource.overall, 400);

  return {
    transcript: asLongText(transcript, 4000),
    aiSpeech,
    feedback: {
      overallScore,
      summary:
        summary ||
        (corrections.length
          ? "Good effort — a few small tweaks will make this sound much more natural."
          : "Clear, easy-to-follow answer. Keep the momentum going."),
      scores,
      corrections,
      betterPhrasing: normalizeBetterPhrasing(
        feedbackSource.better_phrasing ?? feedbackSource.betterPhrasing,
      ),
      vocabulary: normalizeVocabulary(feedbackSource.vocabulary),
      praise: asStringArray(feedbackSource.praise),
      nextSteps: asStringArray(
        feedbackSource.next_steps ?? feedbackSource.nextSteps,
        3,
        240,
      ),
    },
    degraded: !summary || overallScore === null,
  };
}

/**
 * The client sends its recent turns as a JSON string. They are only used as
 * conversation context, so we validate loosely and cap the size.
 */
export function sanitizeHistory(input) {
  if (!input) return [];

  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const text = asText(item.text, 400);
      if (!text) return null;
      return { role: item.role === "assistant" ? "assistant" : "user", text };
    })
    .filter(Boolean)
    .slice(-MAX_CONTEXT_TURNS);
}
