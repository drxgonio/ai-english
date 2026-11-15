"use client";

import { useId } from "react";

import LevelMeter from "@/components/LevelMeter";
import { cn } from "@/lib/utils";

const STATE_LABEL = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const STATE_BADGE = {
  idle: "border-white/10 bg-slate-950/80 text-slate-400",
  listening: "border-rose-400/30 bg-rose-500/20 text-rose-100",
  thinking: "border-indigo-400/30 bg-indigo-500/20 text-indigo-100",
  speaking: "border-sky-400/30 bg-sky-500/20 text-sky-100",
};

/** Warm, stylised skin tones — the persona palette drives hair, clothes, halo. */
const SKIN = "#f3cba6";
const SKIN_SHADOW = "#dfae87";

/**
 * The virtual person on screen: a stylised face whose mouth follows the real
 * amplitude of the spoken reply (`level` comes from an AnalyserNode tapping the
 * TTS output), with blinking eyes and attentive/thinking/speaking states.
 */
export default function AvatarStage({
  speaker,
  state = "idle",
  level = 0,
  caption = "",
}) {
  // `useId()` returns ":r1:" which is not a valid CSS/SVG id — strip the colons.
  const gradientId = `avatar${useId().replace(/:/g, "")}`;
  const [from, to] = speaker?.palette ?? ["#818cf8", "#a78bfa"];

  const isSpeaking = state === "speaking";
  const isListening = state === "listening";
  const isThinking = state === "thinking";

  const mouthOpen = isSpeaking ? Math.min(1, level * 1.3) : 0;
  const headLift = isSpeaking ? -(1.2 + mouthOpen * 1.6) : 0;
  const pupilShift = isThinking ? -1.5 : isListening ? 0.6 : 0;
  const brush = `url(#${gradientId})`;

  return (
    <section
      className="relative overflow-hidden border-b border-white/5 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent px-4 py-4 sm:px-5"
      aria-label={`${speaker?.name ?? "Speaking partner"} — ${STATE_LABEL[state] ?? "Ready"}`}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          {isListening && (
            <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full bg-rose-500/20 motion-reduce:animate-none" />
          )}
          {isSpeaking && (
            <span
              className="pointer-events-none absolute -inset-1 rounded-full blur-xl transition-opacity duration-100"
              style={{
                background: `radial-gradient(circle, ${from}66, transparent 68%)`,
                opacity: 0.35 + mouthOpen * 0.5,
              }}
            />
          )}

          <svg viewBox="0 0 120 120" className="relative h-full w-full">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={from} />
                <stop offset="100%" stopColor={to} />
              </linearGradient>
            </defs>

            {/* Halo */}
            <circle
              cx="60"
              cy="58"
              r="56"
              fill={brush}
              opacity={isSpeaking ? 0.22 : 0.13}
              className="transition-opacity duration-300"
            />

            {/* Shoulders / clothes */}
            <path d="M16 120c0-17 20-26 44-26s44 9 44 26z" fill={brush} />

            {/* Neck */}
            <path d="M50 74h20v18H50z" fill={SKIN_SHADOW} />

            <g
              className="transition-transform duration-75"
              style={{ transform: `translateY(${headLift}px)` }}
            >
              {/* Ears */}
              <ellipse cx="33" cy="57" rx="4.5" ry="6.5" fill={SKIN_SHADOW} />
              <ellipse cx="87" cy="57" rx="4.5" ry="6.5" fill={SKIN_SHADOW} />

              {/* Face */}
              <ellipse cx="60" cy="55" rx="27" ry="30" fill={SKIN} />

              {/* Hair */}
              <path
                d="M31 54c-1-15 12-25 29-25s30 10 29 25c-1-7-7-11-13-13-7-2-13 1-21 0-8-1-15 3-24 13z"
                fill={brush}
              />
              <path
                d="M31 54c-3 12-2 22 1 30-6-6-8-20-1-30z"
                fill={brush}
                opacity="0.92"
              />
              <path
                d="M89 54c3 12 2 22-1 30 6-6 8-20 1-30z"
                fill={brush}
                opacity="0.92"
              />

              {/* Eyebrows (raise slightly while talking) */}
              <g
                className="transition-transform duration-150"
                style={{ transform: `translateY(${isSpeaking ? -1.6 : 0}px)` }}
              >
                <path
                  d="M45 45c2-2 6-2 8-1"
                  stroke={SKIN_SHADOW}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M67 44c2-1 6-1 8 1"
                  stroke={SKIN_SHADOW}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Eyes */}
              <ellipse
                cx="50"
                cy="53"
                rx="5.4"
                ry={isListening ? 5.8 : 5}
                fill="#ffffff"
              />
              <ellipse
                cx="70"
                cy="53"
                rx="5.4"
                ry={isListening ? 5.8 : 5}
                fill="#ffffff"
              />
              <g
                className="transition-transform duration-300"
                style={{ transform: `translateY(${pupilShift}px)` }}
              >
                <circle cx="50.5" cy="53.4" r="2.6" fill="#1f2937" />
                <circle cx="70.5" cy="53.4" r="2.6" fill="#1f2937" />
              </g>

              {/* Eyelids (hidden while open, flash closed when blinking) */}
              <g className="animate-avatar-blink motion-reduce:animate-none">
                <rect
                  className="avatar-eyelid"
                  x="44"
                  y="47.5"
                  width="12"
                  height="11"
                  rx="5.5"
                  fill={SKIN}
                />
                <rect
                  className="avatar-eyelid"
                  x="64"
                  y="47.5"
                  width="12"
                  height="11"
                  rx="5.5"
                  fill={SKIN}
                />
              </g>

              {/* Nose */}
              <path
                d="M60 57v6c0 1.4-1.2 2-2.6 2"
                stroke={SKIN_SHADOW}
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />

              {/* Mouth: opens with the real amplitude of the voice */}
              {mouthOpen > 0.08 ? (
                <ellipse
                  cx="60"
                  cy="72"
                  rx={9 + mouthOpen * 3.5}
                  ry={1.4 + mouthOpen * 7}
                  fill="#8b3a3a"
                />
              ) : (
                <path
                  d="M52 71c3.5 4 12 4 16 0"
                  stroke="#a5525a"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              )}

              {/* Blush */}
              <ellipse
                cx="41"
                cy="64"
                rx="4.5"
                ry="2.6"
                fill="#f08d8d"
                opacity="0.35"
              />
              <ellipse
                cx="79"
                cy="64"
                rx="4.5"
                ry="2.6"
                fill="#f08d8d"
                opacity="0.35"
              />
            </g>
          </svg>

          <span
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur",
              STATE_BADGE[state] ?? STATE_BADGE.idle,
            )}
          >
            {STATE_LABEL[state] ?? STATE_LABEL.idle}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">
              {speaker?.name}
            </p>
            {speaker?.role && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                {speaker.role}
              </span>
            )}
            {isSpeaking && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400 motion-reduce:animate-none" />
                speaking now
              </span>
            )}
          </div>

          <p
            className={cn(
              "mt-1.5 line-clamp-3 text-sm leading-relaxed",
              isSpeaking ? "text-slate-100" : "text-slate-400",
            )}
            aria-live="polite"
          >
            {caption}
          </p>

          <LevelMeter
            variant="ai"
            bars={20}
            active={isSpeaking}
            level={level}
            className="mt-2 h-6 justify-start"
          />
        </div>
      </div>
    </section>
  );
}
