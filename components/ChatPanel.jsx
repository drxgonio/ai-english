"use client";

import { useEffect, useRef } from "react";

import {
  ArrowRightIcon,
  CheckIcon,
  MicIcon,
  PlayIcon,
  SparklesIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";
import AvatarStage from "@/components/AvatarStage";
import { COACH, findPersona } from "@/lib/constants";
import { cn, formatRelativeTime } from "@/lib/utils";

const COACH_SPEAKER = {
  name: COACH.name,
  role: COACH.role,
  avatarClass: COACH.avatarClass,
  textTone: COACH.textTone,
  palette: COACH.palette,
};

/** Resolves who said a given turn (the coach, or the virtual person used then). */
function speakerFor(turn) {
  const persona =
    turn?.meta?.mode === "persona"
      ? findPersona(turn?.meta?.persona?.id)
      : null;

  if (persona) {
    return {
      name: persona.name,
      role: persona.tagline,
      avatarClass: persona.avatarClass,
      textTone: persona.textTone,
      palette: persona.palette,
    };
  }

  return COACH_SPEAKER;
}

function Avatar({ role, speaker, label }) {
  if (role === "assistant") {
    return (
      <span
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-slate-950",
          speaker.avatarClass,
        )}
        aria-hidden="true"
      >
        {speaker.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-gradient-to-br from-sky-500/30 to-cyan-500/10 text-[10px] font-semibold uppercase tracking-wide text-sky-200"
      aria-hidden="true"
    >
      {label || "You"}
    </span>
  );
}

function PendingTurn({ label, speaker }) {
  return (
    <div className="animate-fade-in-up space-y-3" aria-live="polite">
      <div className="flex items-end justify-end gap-2">
        <div className="w-[70%] rounded-3xl rounded-br-lg border border-sky-400/20 bg-sky-500/10 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/80">
            You said
          </p>
          <div className="space-y-2">
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-4/5 rounded-full" />
          </div>
        </div>
        <Avatar role="user" />
      </div>

      <div className="flex items-start gap-2">
        <Avatar role="assistant" speaker={speaker} />
        <div className="w-[78%] rounded-3xl rounded-bl-lg border border-indigo-400/25 bg-indigo-500/10 px-4 py-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300/80">
            <SpinnerIcon className="h-3 w-3" />
            {label || "Transcribing and coaching"}
          </p>
          <div className="space-y-2">
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-11/12 rounded-full" />
            <div className="skeleton h-3 w-3/5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnBlock({ turn, isActive, isSpeaking, onSelect, onPlay }) {
  const speaker = speakerFor(turn);

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* Learner bubble */}
      <div className="flex items-end justify-end gap-2">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg border border-sky-400/20 bg-gradient-to-br from-sky-500/20 to-indigo-500/10 px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/80">
            You said
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-50">
            {turn.transcript}
          </p>
        </div>
        <Avatar role="user" />
      </div>

      {/* Conversation partner bubble */}
      <div className="flex items-start gap-2">
        <Avatar role="assistant" speaker={speaker} />
        <div
          role="button"
          tabIndex={0}
          aria-label="Show feedback for this reply"
          aria-pressed={isActive}
          onClick={() => onSelect?.(turn.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect?.(turn.id);
            }
          }}
          className={cn(
            "group max-w-[88%] cursor-pointer rounded-3xl rounded-bl-lg border px-4 py-3 text-left transition",
            isActive
              ? "border-indigo-400/40 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(129,140,248,0.15)]"
              : "border-white/10 bg-slate-900/70 hover:border-white/20 hover:bg-slate-900",
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80",
                speaker.textTone,
              )}
            >
              {speaker.name} · {speaker.role}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPlay?.(turn);
              }}
              aria-label="Play this reply aloud"
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-sky-300"
            >
              {isSpeaking ? (
                <SpinnerIcon className="h-3.5 w-3.5" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
            {turn.aiSpeech}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500">
              {formatRelativeTime(turn.createdAt)}
            </span>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-indigo-300">
                <SparklesIcon className="h-3 w-3" />
                Shown in feedback
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-500 transition group-hover:text-indigo-300">
                <ArrowRightIcon className="h-3 w-3" />
                View feedback
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ speaker }) {
  const tips = [
    "Hold the mic and speak naturally — one or two sentences is plenty.",
    `${speaker.name} replies out loud, answers your questions and asks their own.`,
    "Grammar, vocabulary and a better phrasing appear on the right.",
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/25 to-indigo-500/10 text-sky-300">
        <MicIcon className="h-7 w-7" />
      </div>
      <div className="max-w-sm space-y-2">
        <h3 className="text-balance text-lg font-semibold text-slate-100">
          Your conversation starts here
        </h3>
        <p className="text-sm leading-relaxed text-slate-400">
          Ask a question, answer theirs, or simply say hello — every turn gets
          instant coaching feedback.
        </p>
      </div>
      <ul className="grid max-w-md gap-2 text-left">
        {tips.map((tip) => (
          <li
            key={tip}
            className="flex items-start gap-2 text-xs text-slate-400"
          >
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChatPanel({
  turns = [],
  activeTurnId,
  isPending = false,
  pendingLabel,
  isSpeaking = false,
  speaker = COACH_SPEAKER,
  avatarState = "idle",
  avatarLevel = 0,
  caption = "",
  onSelectTurn,
  onPlayReply,
  onClear,
  className,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [turns.length, isPending]);

  return (
    <section
      className={cn(
        "flex min-h-[440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.9)] backdrop-blur-xl lg:min-h-0",
        className,
      )}
      aria-label="Conversation history"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Conversation</h2>
          <p className="text-xs text-slate-500">
            {turns.length === 0
              ? "No turns yet"
              : `${turns.length} turn${turns.length === 1 ? "" : "s"} this session`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={turns.length === 0 || isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          New session
        </button>
      </header>

      <AvatarStage
        speaker={speaker}
        state={avatarState}
        level={avatarLevel}
        caption={caption}
      />

      <div
        ref={scrollRef}
        className="app-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {turns.length === 0 && !isPending ? (
          <EmptyState speaker={speaker} />
        ) : (
          turns.map((turn) => (
            <TurnBlock
              key={turn.id}
              turn={turn}
              isActive={turn.id === activeTurnId}
              isSpeaking={isSpeaking}
              onSelect={onSelectTurn}
              onPlay={onPlayReply}
            />
          ))
        )}

        {isPending && <PendingTurn label={pendingLabel} speaker={speaker} />}
      </div>

      <footer className="border-t border-white/5 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5">
        Click any reply to review its feedback on the right.
      </footer>
    </section>
  );
}
