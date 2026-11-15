"use client";

import {
  AlertIcon,
  LoopIcon,
  RefreshIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "@/components/icons";
import LevelMeter from "@/components/LevelMeter";
import MicButton from "@/components/MicButton";
import { cn, formatClock } from "@/lib/utils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

const STATUS_DOT = {
  idle: "bg-emerald-400",
  requesting: "bg-amber-400 animate-pulse",
  recording: "bg-rose-500 animate-pulse",
  speaking: "bg-sky-400 animate-pulse",
  stopping: "bg-amber-400 animate-pulse",
  processing: "bg-indigo-400 animate-pulse",
};

/**
 * The recording dock: big mic control, live status, level meter, options and
 * any error/notice coming from the API or the microphone.
 */
export default function RecorderDock({
  micState = "idle",
  elapsedMs = 0,
  maxMs = 60_000,
  level = 0,
  continuous = false,
  onToggleContinuous,
  micMode,
  micHint,
  micDisabled,
  onMicStart,
  onMicStop,
  handsFree = false,
  onToggleHandsFree,
  ttsEnabled = true,
  onToggleTts,
  isSpeaking = false,
  onStopSpeaking,
  onStart,
  onStop,
  error,
  onDismissError,
  onRetry,
  isSupported,
  statusText,
  detailText,
}) {
  const isBusy = micState === "processing" || micState === "stopping";
  const modeLocked =
    micState === "recording" || micState === "requesting" || isBusy;
  const isWarning = error?.tone === "warning";

  return (
    <section
      className="rounded-3xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-xl sm:p-5"
      aria-label="Voice recorder"
    >
      {error && (
        <div
          role="alert"
          className={cn(
            "mb-4 flex flex-wrap items-start gap-3 rounded-2xl border px-3.5 py-3",
            isWarning
              ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
              : "border-rose-400/25 bg-rose-500/10 text-rose-100",
          )}
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed">
            {error.message}
          </p>
          <div className="flex items-center gap-1.5">
            {error.canRetry && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-medium transition hover:bg-white/10"
              >
                <RefreshIcon className="h-3 w-3" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Dismiss message"
              className="rounded-full px-1.5 py-0.5 text-base leading-none opacity-70 transition hover:bg-white/10 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              STATUS_DOT[micState] ?? STATUS_DOT.idle,
              micState !== "idle" && "motion-reduce:animate-none",
            )}
          />
          {statusText}
        </div>

        <MicButton
          state={micState}
          mode={micMode ?? (handsFree ? "toggle" : "hold")}
          level={level}
          elapsedMs={elapsedMs}
          maxMs={maxMs}
          disabled={micDisabled ?? micState === "processing"}
          hint={micHint}
          onStart={onMicStart ?? onStart}
          onStop={onMicStop ?? onStop}
        />

        <div className="flex w-full max-w-lg items-center gap-3">
          <LevelMeter
            className="flex-1"
            active={micState === "recording"}
            level={level}
          />
          <span
            className={cn(
              "w-16 shrink-0 text-right text-[11px] font-medium tabular-nums",
              micState === "recording" ? "text-rose-300" : "text-slate-500",
            )}
          >
            {formatClock(elapsedMs)} / {formatClock(maxMs)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onToggleContinuous}
            aria-pressed={continuous}
            className={cn(
              chipBase,
              continuous
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200",
            )}
            title="Hands-free loop: the app listens, notices when you stop talking, replies and listens again"
          >
            <LoopIcon className="h-3.5 w-3.5" />
            {continuous ? "Continuous talk on" : "Continuous talk"}
          </button>

          <button
            type="button"
            onClick={onToggleHandsFree}
            aria-pressed={handsFree}
            disabled={modeLocked || continuous}
            className={cn(
              chipBase,
              handsFree
                ? "border-violet-400/30 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25"
                : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200",
            )}
            title="Tap to start and stop instead of holding the button"
          >
            {handsFree ? "Hands-free on" : "Hands-free off"}
          </button>

          <button
            type="button"
            onClick={onToggleTts}
            aria-pressed={ttsEnabled}
            className={cn(
              chipBase,
              ttsEnabled
                ? "border-sky-400/30 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200",
            )}
          >
            {ttsEnabled ? (
              <VolumeIcon className="h-3.5 w-3.5" />
            ) : (
              <VolumeOffIcon className="h-3.5 w-3.5" />
            )}
            {ttsEnabled ? "Spoken replies" : "Silent replies"}
          </button>

          {isSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className={cn(
                chipBase,
                "border-rose-400/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
              )}
            >
              Stop voice
            </button>
          )}
        </div>

        <p className="max-w-md text-center text-[11px] leading-relaxed text-slate-600">
          {isSupported === false
            ? "Audio recording is not available in this browser. Use the latest Chrome, Edge, Firefox or Safari."
            : detailText}
        </p>
      </div>
    </section>
  );
}
