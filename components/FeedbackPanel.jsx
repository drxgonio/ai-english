"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  CopyIcon,
  LightbulbIcon,
  SparklesIcon,
  TargetIcon,
} from "@/components/icons";
import { cn, formatClock, scoreStroke, scoreTone } from "@/lib/utils";

const METRICS = [
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "fluency", label: "Fluency" },
  { key: "naturalness", label: "Naturalness" },
];

function ScoreDonut({ score }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const value = typeof score === "number" ? score : null;
  const offset =
    value === null ? circumference : circumference * (1 - value / 100);

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="fill-none stroke-white/10"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={scoreStroke(value)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums",
            scoreTone(value),
          )}
        >
          {value ?? "–"}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          score
        </span>
      </div>
    </div>
  );
}

function MetricBar({ label, value }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold tabular-nums text-slate-200">
          {value ?? "–"}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${value ?? 0}%`,
            backgroundColor: scoreStroke(value),
          }}
        />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  accent = "text-sky-300",
  action,
  children,
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          <span className={accent}>{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function CorrectionItem({ correction }) {
  return (
    <li className="rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-rose-300/90">{correction.original}</span>
        <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="font-medium text-emerald-300">
          {correction.corrected}
        </span>
        <span className="ml-auto rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
          {correction.type}
        </span>
      </div>
      {correction.explanation && (
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {correction.explanation}
        </p>
      )}
    </li>
  );
}

function VocabularyItem({ item }) {
  return (
    <li className="rounded-xl border border-white/5 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-sky-200">{item.word}</span>
        {item.partOfSpeech && (
          <span className="text-[10px] italic text-slate-500">
            {item.partOfSpeech}
          </span>
        )}
        {item.level && (
          <span className="ml-auto rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300">
            {item.level}
          </span>
        )}
      </div>
      {item.meaning && (
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {item.meaning}
        </p>
      )}
      {item.example && (
        <p className="mt-1 text-xs italic leading-relaxed text-slate-500">
          “{item.example}”
        </p>
      )}
    </li>
  );
}

function FeedbackSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
        <div className="skeleton h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-1/2 rounded-full" />
          <div className="skeleton h-3 w-full rounded-full" />
          <div className="skeleton h-3 w-4/5 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
        {METRICS.map((metric) => (
          <div key={metric.key} className="space-y-1.5">
            <div className="skeleton h-2.5 w-2/3 rounded-full" />
            <div className="skeleton h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      {[0, 1].map((index) => (
        <div
          key={index}
          className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5"
        >
          <div className="skeleton h-2.5 w-1/3 rounded-full" />
          <div className="skeleton h-3 w-full rounded-full" />
          <div className="skeleton h-3 w-3/4 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function FeedbackEmptyState() {
  const items = [
    {
      icon: <CheckIcon className="h-3.5 w-3.5" />,
      label: "Line-by-line grammar corrections",
    },
    {
      icon: <SparklesIcon className="h-3.5 w-3.5" />,
      label: "A more natural way to phrase it",
    },
    {
      icon: <BookIcon className="h-3.5 w-3.5" />,
      label: "New vocabulary with examples",
    },
    {
      icon: <TargetIcon className="h-3.5 w-3.5" />,
      label: "Concrete next steps to practise",
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/25 to-indigo-500/10 text-violet-300">
        <SparklesIcon className="h-6 w-6" />
      </div>
      <div className="max-w-xs space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-100">
          Your coaching report appears here
        </h3>
        <p className="text-xs leading-relaxed text-slate-400">
          Finish your first spoken turn and SpeakFlow will break down what
          worked and what to fix — while your conversation partner keeps
          chatting.
        </p>
      </div>
      <ul className="grid gap-2 text-left">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-xs text-slate-400"
          >
            <span className="text-slate-500">{item.icon}</span>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="max-w-xs text-[11px] leading-relaxed text-slate-600">
        Feedback is based on the Whisper transcript, so it focuses on grammar
        and vocabulary rather than accent.
      </p>
    </div>
  );
}

/** Plain-text export for the "copy" button. */
function buildFeedbackText(turn) {
  const feedback = turn.feedback || {};
  const lines = [
    "SpeakFlow — coaching report",
    "",
    `You said: ${turn.transcript}`,
    `Ava: ${turn.aiSpeech}`,
    "",
    `Overall score: ${feedback.overallScore ?? "–"}/100`,
    feedback.summary ? `Summary: ${feedback.summary}` : "",
    "",
  ];

  if (feedback.corrections?.length) {
    lines.push("Corrections:");
    feedback.corrections.forEach((item) => {
      lines.push(`- "${item.original}" → "${item.corrected}" (${item.type})`);
      if (item.explanation) lines.push(`  ${item.explanation}`);
    });
    lines.push("");
  }

  if (feedback.betterPhrasing?.improved) {
    lines.push(`Better phrasing: "${feedback.betterPhrasing.improved}"`);
    if (feedback.betterPhrasing.why)
      lines.push(`Why: ${feedback.betterPhrasing.why}`);
    lines.push("");
  }

  if (feedback.vocabulary?.length) {
    lines.push("Vocabulary:");
    feedback.vocabulary.forEach((item) => {
      lines.push(
        `- ${item.word}${item.level ? ` (${item.level})` : ""}: ${item.meaning}`,
      );
      if (item.example) lines.push(`  e.g. ${item.example}`);
    });
    lines.push("");
  }

  if (feedback.praise?.length) {
    lines.push("What worked:");
    feedback.praise.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  if (feedback.nextSteps?.length) {
    lines.push("Next steps:");
    feedback.nextSteps.forEach((item) => lines.push(`- ${item}`));
  }

  return lines
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();
}

export default function FeedbackPanel({ turn, isLoading = false, className }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    setCopied(false);
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [turn?.id]);

  const handleCopy = useCallback(async () => {
    if (!turn) return;
    try {
      await navigator.clipboard.writeText(buildFeedbackText(turn));
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (insecure context) — silently ignore */
    }
  }, [turn]);

  const feedback = turn?.feedback;
  const meta = turn?.meta;

  return (
    <section
      className={cn(
        "flex min-h-[440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.9)] backdrop-blur-xl lg:min-h-0",
        className,
      )}
      aria-label="Grammar and vocabulary feedback"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <SparklesIcon className="h-4 w-4 text-violet-300" />
            Grammar &amp; Vocabulary
          </h2>
          <p className="text-xs text-slate-500">
            {turn
              ? `Feedback for your latest turn${meta?.level ? ` · ${meta.level}` : ""}`
              : "Waiting for your first turn"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!turn || isLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      <div className="app-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {isLoading ? (
          <FeedbackSkeleton />
        ) : !turn || !feedback ? (
          <FeedbackEmptyState />
        ) : (
          <div key={turn.id} className="animate-fade-in space-y-3">
            {/* Score + one-line verdict */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.06] to-transparent p-3.5">
              <ScoreDonut score={feedback.overallScore} />
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    CEFR {meta?.level ?? "—"}
                  </span>
                  {typeof meta?.durationMs === "number" &&
                    meta.durationMs > 0 && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                        {formatClock(meta.durationMs)} spoken
                      </span>
                    )}
                  {typeof feedback.corrections?.length === "number" && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                      {feedback.corrections.length} fix
                      {feedback.corrections.length === 1 ? "" : "es"}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {feedback.summary}
                </p>
              </div>
            </div>

            {/* Skill breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              {METRICS.map((metric) => (
                <MetricBar
                  key={metric.key}
                  label={metric.label}
                  value={feedback.scores?.[metric.key] ?? null}
                />
              ))}
            </div>

            {/* Corrections */}
            <SectionCard
              title={
                feedback.corrections?.length
                  ? `Corrections · ${feedback.corrections.length}`
                  : "Corrections"
              }
              icon={<CheckIcon className="h-3.5 w-3.5" />}
              accent="text-rose-300"
            >
              {feedback.corrections?.length ? (
                <ul className="space-y-2">
                  {feedback.corrections.map((correction, index) => (
                    <CorrectionItem
                      key={`${correction.original}-${correction.corrected}-${index}`}
                      correction={correction}
                    />
                  ))}
                </ul>
              ) : (
                <p className="flex items-start gap-2 text-xs leading-relaxed text-emerald-300">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  No grammar mistakes detected in this turn — that sentence was
                  clean.
                </p>
              )}
            </SectionCard>

            {/* Natural rewrite */}
            {feedback.betterPhrasing?.improved && (
              <SectionCard
                title="Say it like this"
                icon={<SparklesIcon className="h-3.5 w-3.5" />}
                accent="text-violet-300"
              >
                <div className="space-y-2">
                  {feedback.betterPhrasing.original && (
                    <p className="text-xs leading-relaxed text-slate-500">
                      <span className="text-slate-400">You said:</span>{" "}
                      {feedback.betterPhrasing.original}
                    </p>
                  )}
                  <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm leading-relaxed text-emerald-100">
                    “{feedback.betterPhrasing.improved}”
                  </p>
                  {feedback.betterPhrasing.why && (
                    <p className="flex gap-1.5 text-xs leading-relaxed text-slate-400">
                      <LightbulbIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                      {feedback.betterPhrasing.why}
                    </p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Vocabulary */}
            {feedback.vocabulary?.length > 0 && (
              <SectionCard
                title="Vocabulary boost"
                icon={<BookIcon className="h-3.5 w-3.5" />}
                accent="text-sky-300"
              >
                <ul className="grid gap-2">
                  {feedback.vocabulary.map((item, index) => (
                    <VocabularyItem key={`${item.word}-${index}`} item={item} />
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Praise */}
            {feedback.praise?.length > 0 && (
              <SectionCard
                title="What worked"
                icon={<SparklesIcon className="h-3.5 w-3.5" />}
                accent="text-emerald-300"
              >
                <ul className="space-y-1.5">
                  {feedback.praise.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="flex gap-2 text-xs leading-relaxed text-slate-300"
                    >
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Next steps */}
            {feedback.nextSteps?.length > 0 && (
              <SectionCard
                title="Next steps"
                icon={<TargetIcon className="h-3.5 w-3.5" />}
                accent="text-amber-300"
              >
                <ol className="space-y-1.5">
                  {feedback.nextSteps.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="flex gap-2 text-xs leading-relaxed text-slate-300"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[9px] font-semibold text-amber-300">
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </SectionCard>
            )}
          </div>
        )}
      </div>

      {turn && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
          {meta?.models?.transcription && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-sky-400" />
              STT {meta.models.transcription}
            </span>
          )}
          {typeof meta?.timings?.transcriptionMs === "number" && (
            <span>{(meta.timings.transcriptionMs / 1000).toFixed(1)}s</span>
          )}
          {meta?.models?.chat && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-violet-400" />
              Brain {meta.models.chat}
            </span>
          )}
          {typeof meta?.timings?.completionMs === "number" && (
            <span>{(meta.timings.completionMs / 1000).toFixed(1)}s</span>
          )}
          <span className="ml-auto">Latest turn</span>
        </footer>
      )}
    </section>
  );
}
