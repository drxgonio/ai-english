/**
 * A small typed error used across the API routes so that every failure can be
 * translated into a predictable JSON payload:
 *   { error: { message, code, details } }
 */
export class AppError extends Error {
  constructor(
    message,
    { status = 500, code = "internal_error", details = null, cause } = {},
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Shape-check an unknown error coming out of a route handler. */
function statusOf(error) {
  if (typeof error?.status === "number" && error.status >= 400)
    return error.status;
  if (error?.name === "AbortError") return 504;
  if (error?.name === "TimeoutError") return 504;
  return 502;
}

const UPSTREAM_MESSAGES = {
  400: "OpenAI rejected the request. Please try a shorter recording.",
  401: "OpenAI rejected the API key. Check OPENAI_API_KEY in your environment.",
  403: "This OpenAI project is not allowed to use the requested model.",
  404: "The requested OpenAI model is unavailable for this project.",
  413: "That recording is too large. Please keep it under 60 seconds.",
  429: "OpenAI rate limit or quota reached. Please wait a moment and try again.",
  500: "OpenAI had an internal error. Please try again.",
  503: "OpenAI is temporarily unavailable. Please try again in a moment.",
  504: "The request to OpenAI timed out. Please try again.",
};

/**
 * Converts any thrown value into `{ status, body }` that is safe to send to the
 * browser. Upstream provider details are only included outside production.
 */
export function toApiError(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      },
    };
  }

  const status = statusOf(error);
  const code =
    error?.code ||
    (status === 429
      ? "rate_limited"
      : status >= 500
        ? "upstream_error"
        : "bad_request");

  // Server-side logging keeps the real cause visible without leaking it to users.
  console.error("[api] unhandled error:", {
    name: error?.name,
    message: error?.message,
    status,
    code,
  });

  return {
    status,
    body: {
      error: {
        message:
          UPSTREAM_MESSAGES[status] ||
          "Something went wrong while processing your recording. Please try again.",
        code,
        details:
          process.env.NODE_ENV === "production"
            ? null
            : {
                name: error?.name ?? "Error",
                message: error?.message ?? String(error),
              },
      },
    },
  };
}
