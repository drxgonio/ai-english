"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

/**
 * Lightweight RMS visualiser. Bars are deterministic per index so the idle
 * state looks like a flat waveform instead of random noise.
 * `variant` picks the palette: "mic" for your voice, "ai" for the reply.
 */
export default function LevelMeter({
  level = 0,
  active = false,
  bars = 34,
  variant = "mic",
  className,
}) {
  const weights = useMemo(
    () =>
      Array.from(
        { length: bars },
        (_, index) => 0.35 + 0.65 * Math.abs(Math.sin(index * 0.72 + 0.4)),
      ),
    [bars],
  );

  const activeGradient =
    variant === "ai"
      ? "bg-gradient-to-t from-violet-500/90 via-indigo-400 to-sky-300"
      : "bg-gradient-to-t from-rose-500/90 via-rose-400 to-amber-300";

  return (
    <div
      className={cn(
        "flex h-10 items-center justify-center gap-[3px]",
        className,
      )}
      aria-hidden="true"
    >
      {weights.map((weight, index) => {
        const height = active
          ? Math.max(8, Math.min(100, 8 + level * 100 * weight))
          : 8 + (index % 3) * 2;

        return (
          <span
            key={index}
            style={{ height: `${height}%` }}
            className={cn(
              "w-[3px] rounded-full transition-[height,background-color] duration-100 ease-out",
              active ? activeGradient : "bg-slate-700/80",
            )}
          />
        );
      })}
    </div>
  );
}
