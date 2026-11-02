"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

const LABEL = "Edit";
const LETTER_MS = 320;
const START_MS = 220;

type WritingEditButtonProps = {
  onClick?: () => void;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

/**
 * Edit CTA where a pencil writes the word "Edit".
 * Letters ink in under the pencil tip as it scribbles across.
 */
export function WritingEditButton({
  onClick,
  className,
  title = "Edit",
  "aria-label": ariaLabel = "Edit",
}: WritingEditButtonProps) {
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [runId, setRunId] = useState(0);
  const preferReduced = useRef(false);

  useEffect(() => {
    preferReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (preferReduced.current) {
      setPhase(LABEL.length);
      setPlaying(false);
      return;
    }
    setPhase(0);
    setPlaying(true);
    const timers: number[] = [];
    for (let i = 1; i <= LABEL.length; i++) {
      timers.push(
        window.setTimeout(() => setPhase(i), START_MS + i * LETTER_MS),
      );
    }
    timers.push(
      window.setTimeout(
        () => {
          setPhase(LABEL.length);
          setPlaying(false);
        },
        START_MS + (LABEL.length + 1) * LETTER_MS,
      ),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [runId]);

  const tipProgress = phase / Math.max(LABEL.length, 1);
  // Track across the word width (~48px content)
  const tipX = 2 + tipProgress * 42;
  const tipY = 15 + Math.sin(tipProgress * Math.PI * 3.5) * 2.4;
  const tipRotate = playing
    ? -48 + Math.sin(tipProgress * Math.PI * 5) * 16
    : -28;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      data-testid="writing-edit-button"
      onMouseEnter={() => {
        if (!playing) setRunId((n) => n + 1);
      }}
      className={cn(
        "writing-edit-btn group relative inline-flex h-8 items-center overflow-visible rounded-full border border-[var(--border)] bg-white pl-2 pr-3 text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[#0f9f8a]/45 hover:bg-[#0f9f8a]/6",
        className,
      )}
    >
      <span className="relative inline-flex h-5 min-w-[56px] items-center pl-0.5">
        <span
          aria-hidden
          className="pointer-events-none select-none text-[13px] font-semibold tracking-[0.06em] text-transparent"
        >
          {LABEL}
        </span>
        <span
          className="pointer-events-none absolute left-0.5 top-1/2 flex -translate-y-1/2 select-none text-[13px] font-semibold tracking-[0.06em] text-[#0b7f6e]"
          aria-hidden
          data-testid="writing-edit-label"
        >
          {LABEL.split("").map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className={cn(
                "writing-edit-letter inline-block",
                i < phase ? "opacity-100" : "opacity-0",
              )}
              style={{
                transition: "opacity 160ms ease-out",
              }}
            >
              {ch}
            </span>
          ))}
        </span>

        <svg
          aria-hidden
          viewBox="0 0 72 28"
          className="pointer-events-none absolute -left-1 -top-1 h-7 w-[72px] overflow-visible"
        >
          {playing && phase > 0 && (
            <path
              d={`M4 16 C ${4 + tipProgress * 16} ${16 - tipProgress * 4}, ${4 + tipProgress * 28} ${16 + Math.sin(tipProgress * 9)}, ${tipX + 4} ${tipY}`}
              fill="none"
              stroke="#0f9f8a"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.45"
            />
          )}
          <g
            className={cn(
              "writing-edit-pencil",
              playing && "writing-edit-pencil--active",
            )}
            style={{
              transform: `translate(${tipX}px, ${tipY - 10}px) rotate(${tipRotate}deg)`,
              transition: playing
                ? "transform 260ms ease-in-out"
                : "transform 500ms ease-out",
              transformOrigin: "2px 14px",
            }}
          >
            {/* Pencil body */}
            <rect
              x="3"
              y="2"
              width="11"
              height="4.2"
              rx="0.8"
              transform="rotate(35 3 2)"
              fill="#0f9f8a"
            />
            {/* Ferrule */}
            <rect
              x="12.5"
              y="0.6"
              width="2.2"
              height="4.2"
              rx="0.4"
              transform="rotate(35 12.5 0.6)"
              fill="#086557"
            />
            {/* Tip */}
            <path
              d="M2.2 13.8 L5.4 9.6 L7.6 11.2 Z"
              fill="#f3e0c2"
              stroke="#086557"
              strokeWidth="0.5"
            />
            <path
              d="M2.2 13.8 L3.4 12.2"
              stroke="#171717"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </span>
      <span className="sr-only">{LABEL}</span>
    </button>
  );
}
