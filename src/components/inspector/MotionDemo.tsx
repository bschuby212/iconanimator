"use client";

import type { MotionToolId } from "@/lib/animation/motions";
import { cn } from "@/lib/utils/cn";

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/></svg>`;

export function MotionDemo({
  toolId,
  iconSvg,
  className,
}: {
  toolId: MotionToolId;
  iconSvg?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "motion-demo flex h-10 w-full items-center justify-center overflow-hidden",
        className,
      )}
    >
      <span
        className={cn(
          "motion-demo-icon block h-5 w-5 text-[var(--text)] [&_svg]:h-full [&_svg]:w-full",
          `motion-demo--${toolId}`,
        )}
        dangerouslySetInnerHTML={{ __html: iconSvg || FALLBACK_SVG }}
      />
    </div>
  );
}
