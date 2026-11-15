"use client";

import {
  ChevronDownIcon,
  MicIcon,
  SparklesIcon,
  UserIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "@/components/icons";
import {
  CEFR_LEVELS,
  MODES,
  PERSONAS,
  TOPICS,
  findPersona,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const controlClass =
  "relative inline-flex items-center rounded-full border border-white/10 bg-slate-950/60 text-xs text-slate-200 transition hover:border-white/20 focus-within:border-sky-400/50";

export default function TopBar({
  level,
  topic,
  mode,
  personaId,
  onLevelChange,
  onTopicChange,
  onModeChange,
  onPersonaChange,
  ttsEnabled,
  onToggleTts,
  onNewSession,
  isSpeaking = false,
  canReset = false,
  disabled = false,
}) {
  const activePersona = findPersona(personaId) || PERSONAS[0];
  const isPersonaMode = mode === "persona";

  return (
    <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/50 px-4 py-3 backdrop-blur-xl sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 text-white shadow-[0_12px_30px_-14px_rgba(56,189,248,0.95)]">
          <MicIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-slate-50 sm:text-base">
            SpeakFlow
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {isPersonaMode
              ? `Talking with ${activePersona.name} · ${activePersona.tagline}`
              : "AI English speaking coach"}
          </p>
        </div>
        <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300 xl:inline-flex">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-emerald-400 motion-reduce:animate-none" />
          Whisper · GPT-4o · TTS
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Conversation mode: coach vs. talking to a virtual person */}
        <div
          className="flex items-center gap-0.5 rounded-full border border-white/10 bg-slate-950/60 p-0.5"
          role="group"
          aria-label="Conversation mode"
        >
          {MODES.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onModeChange?.(option.value)}
                disabled={disabled}
                aria-pressed={active}
                title={option.hint}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-[0_8px_24px_-12px_rgba(56,189,248,0.95)]"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {option.value === "coach" ? (
                  <SparklesIcon className="h-3 w-3" />
                ) : (
                  <UserIcon className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* Who you are talking to (persona mode only) */}
        {isPersonaMode && (
          <label className={controlClass}>
            <span className="sr-only">Virtual person</span>
            <span
              aria-hidden="true"
              className={cn(
                "ml-2.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br",
                activePersona.avatarClass,
              )}
            />
            <select
              value={activePersona.id}
              onChange={(event) => onPersonaChange?.(event.target.value)}
              disabled={disabled}
              className="appearance-none rounded-full bg-transparent py-1.5 pl-2 pr-8 font-medium outline-none disabled:opacity-50"
            >
              {PERSONAS.map((persona) => (
                <option
                  key={persona.id}
                  value={persona.id}
                  className="bg-slate-900"
                >
                  {persona.name} — {persona.tagline}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-500" />
          </label>
        )}

        <label className={controlClass}>
          <span className="sr-only">Your CEFR level</span>
          <select
            value={level}
            onChange={(event) => onLevelChange?.(event.target.value)}
            disabled={disabled}
            className="appearance-none rounded-full bg-transparent py-1.5 pl-3 pr-8 font-medium outline-none disabled:opacity-50"
          >
            {CEFR_LEVELS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-slate-900"
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-500" />
        </label>

        <label className={controlClass}>
          <span className="sr-only">Conversation topic</span>
          <select
            value={topic}
            onChange={(event) => onTopicChange?.(event.target.value)}
            disabled={disabled}
            className="appearance-none rounded-full bg-transparent py-1.5 pl-3 pr-8 outline-none disabled:opacity-50"
          >
            {TOPICS.map((option) => (
              <option key={option} value={option} className="bg-slate-900">
                {option}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-500" />
        </label>

        <button
          type="button"
          onClick={onToggleTts}
          aria-pressed={ttsEnabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            ttsEnabled
              ? "border-sky-400/30 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
              : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200",
          )}
          title={ttsEnabled ? "Mute spoken replies" : "Speak replies aloud"}
        >
          {ttsEnabled ? (
            <VolumeIcon className="h-3.5 w-3.5" />
          ) : (
            <VolumeOffIcon className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isSpeaking ? "Speaking…" : ttsEnabled ? "Voice on" : "Voice off"}
          </span>
        </button>

        <button
          type="button"
          onClick={onNewSession}
          disabled={disabled || !canReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          New session
        </button>
      </div>
    </header>
  );
}
