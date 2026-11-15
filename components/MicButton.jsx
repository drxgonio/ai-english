"use client";

import { useCallback, useRef } from "react";

import { MicIcon, SpinnerIcon, StopIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const STATE_STYLES = {
  idle: "bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 shadow-[0_20px_60px_-18px_rgba(56,189,248,0.85)] hover:scale-[1.03] hover:shadow-[0_26px_70px_-16px_rgba(56,189,248,0.95)]",
  requesting:
    "bg-gradient-to-br from-slate-600 to-slate-700 shadow-[0_16px_40px_-18px_rgba(148,163,184,0.6)] cursor-progress",
  recording:
    "bg-gradient-to-br from-rose-500 via-red-500 to-rose-600 shadow-[0_22px_70px_-14px_rgba(244,63,94,0.9)] scale-[1.02]",
  speaking:
    "bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 shadow-[0_18px_50px_-16px_rgba(56,189,248,0.85)]",
  stopping:
    "bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_18px_50px_-16px_rgba(249,115,22,0.8)] cursor-progress",
  processing:
    "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_18px_50px_-16px_rgba(99,102,241,0.8)] cursor-wait",
};

const STATE_LABELS = {
  idle: "Ready when you are",
  requesting: "Allow microphone…",
  recording: "Listening",
  speaking: "Speaking",
  stopping: "Finishing…",
  processing: "Thinking…",
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 46;

/**
 * The hero control. Two interaction modes:
 *  - "hold": press and hold (pointer or Space) to record, release to send.
 *  - "toggle": hands-free, tap to start and tap again to send.
 */
export default function MicButton({
  state = "idle",
  mode = "hold",
  level = 0,
  elapsedMs = 0,
  maxMs = 60_000,
  disabled = false,
  onStart,
  onStop,
  hint,
}) {
  const holdingRef = useRef(false);

  const isRecording = state === "recording";
  const isBusy = state === "processing" || state === "stopping";
  const isRequesting = state === "requesting";
  const locked = disabled || isBusy;

  const progress = maxMs > 0 ? Math.min(1, Math.max(0, elapsedMs / maxMs)) : 0;

  const handlePointerDown = useCallback(
    (event) => {
      if (mode === "toggle" || locked) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      holdingRef.current = true;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onStart?.();
    },
    [locked, mode, onStart],
  );

  const handlePointerEnd = useCallback(
    (event) => {
      if (mode === "toggle") return;
      if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!holdingRef.current) return;
      holdingRef.current = false;
      onStop?.();
    },
    [mode, onStop],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (mode === "toggle" || locked) return;
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (event.repeat || holdingRef.current) return;
      holdingRef.current = true;
      onStart?.();
    },
    [locked, mode, onStart],
  );

  const handleKeyUp = useCallback(
    (event) => {
      if (mode === "toggle") return;
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (!holdingRef.current) return;
      holdingRef.current = false;
      onStop?.();
    },
    [mode, onStop],
  );

  const handleClick = useCallback(() => {
    if (mode !== "toggle" || locked) return;
    if (isRecording) onStop?.();
    else onStart?.();
  }, [isRecording, locked, mode, onStart, onStop]);

  const defaultHint =
    mode === "toggle"
      ? isRecording
        ? "Tap the button again to stop and send"
        : "Hands-free: tap once to start"
      : "Hold to talk — release to send · Space works too";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-40 w-40 items-center justify-center sm:h-44 sm:w-44">
        {isRecording && (
          <>
            <span className="pointer-events-none absolute inset-2 animate-pulse-ring rounded-full bg-rose-500/25 motion-reduce:animate-none" />
            <span className="pointer-events-none absolute inset-2 animate-pulse-ring-late rounded-full bg-rose-500/20 motion-reduce:animate-none" />
          </>
        )}

        {/* Countdown ring: shows how much of the 60s budget is left. */}
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            className="fill-none stroke-white/[0.07]"
            strokeWidth="2.5"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke="currentColor"
            className={cn(
              "transition-[stroke-dashoffset,opacity] duration-150",
              isRecording ? "text-rose-300/80" : "text-sky-300/70 opacity-0",
            )}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
          />
        </svg>

        <button
          type="button"
          aria-label={
            isRecording
              ? "Stop recording and send"
              : "Record your answer with the microphone"
          }
          aria-pressed={mode === "toggle" ? isRecording : undefined}
          aria-busy={isBusy || isRequesting}
          disabled={locked}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            "relative flex h-28 w-28 touch-none select-none flex-col items-center justify-center gap-1 rounded-full text-white transition-all duration-200 active:scale-95 sm:h-32 sm:w-32",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950",
            "disabled:cursor-not-allowed disabled:opacity-90 disabled:active:scale-100",
            STATE_STYLES[state] ?? STATE_STYLES.idle,
          )}
        >
          {isRecording || state === "speaking" ? (
            <StopIcon className="h-9 w-9" />
          ) : isBusy || isRequesting ? (
            <SpinnerIcon className="h-9 w-9" />
          ) : (
            <MicIcon className="h-9 w-9" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
            {STATE_LABELS[state] ?? STATE_LABELS.idle}
          </span>

          {/* Subtle live level glow behind the label. */}
          {isRecording && (
            <span
              className="pointer-events-none absolute inset-0 rounded-full bg-white/10 transition-opacity duration-100"
              style={{ opacity: 0.15 + level * 0.5 }}
            />
          )}
        </button>
      </div>

      <p className="text-xs text-slate-500">{hint ?? defaultHint}</p>
    </div>
  );
}
