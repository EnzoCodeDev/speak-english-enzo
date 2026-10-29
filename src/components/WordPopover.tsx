"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { DICT } from "@/data/dictionary";

export type PopoverState = { key: string; display: string; anchor: DOMRect };

/** Recuadro con significado y pronunciación de una palabra, bajo la palabra. */
export function WordPopover({ state, onSay }: { state: PopoverState; onSay: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const entry = DICT[state.key];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const a = state.anchor;
    let left = a.left + a.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    let top = a.bottom + 10;
    if (top + h > window.innerHeight - 12) top = a.top - h - 10;
    setPos({ left, top });
  }, [state]);

  if (!entry) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Palabra ${state.display}`}
      onClick={(e) => e.stopPropagation()}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className="fixed z-40 w-72 rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.7)] animate-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight">{state.display}</p>
          <p className="mt-1 font-mono text-sm text-signal">{entry[1]}</p>
        </div>
        <button
          type="button"
          onClick={onSay}
          aria-label={`Escuchar ${state.display}`}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-signal text-ink-950 transition hover:scale-105 active:scale-95"
        >
          <Volume2 className="size-4" />
        </button>
      </div>
      <p className="mt-3 border-t border-ink-700 pt-3 text-sm leading-relaxed text-ink-300">{entry[0]}</p>
    </div>
  );
}
