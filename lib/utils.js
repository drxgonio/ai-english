/** Tiny class-name joiner (avoids pulling in a dependency for this). */
export function cn(...values) {
  return values.filter(Boolean).join(" ");
}

/** 65000 -> "1:05" */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Timestamp -> "just now" / "3 min ago" / "14:05" */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 45_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;

  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Seconds left before auto-stop, capped at 0. */
export function remainingMs(elapsedMs, maxMs) {
  return Math.max(0, maxMs - elapsedMs);
}

export function scoreTone(score) {
  if (typeof score !== "number") return "text-slate-400";
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-sky-300";
  if (score >= 40) return "text-amber-300";
  return "text-rose-300";
}

export function scoreStroke(score) {
  if (typeof score !== "number") return "#475569";
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#38bdf8";
  if (score >= 40) return "#fbbf24";
  return "#fb7185";
}
