"use client";

import clsx from "clsx";
import { DICT } from "@/data/dictionary";
import type { WordResult } from "@/lib/scoring";

export type WordPick = { key: string; display: string; el: HTMLElement };

const strip = (t: string) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, "");

/** La frase en inglés con cada palabra tocable (si está en el diccionario). */
export function PhraseText({
  text, activeKey, onPick,
}: { text: string; activeKey: string | null; onPick: (p: WordPick) => void }) {
  const tokens = text.split(/\s+/);
  return (
    <p className="font-display text-[clamp(1.6rem,7vw,2.5rem)] leading-[1.06] md:text-[clamp(2.5rem,5vw,4rem)] md:leading-[1.04] font-bold tracking-[-0.035em] text-balance text-ink-100">
      {tokens.map((token, i) => {
        const clean = strip(token);
        const key = clean.toLowerCase();
        const sep = i < tokens.length - 1 ? " " : "";
        if (!clean || !DICT[key]) return <span key={i}>{token + sep}</span>;
        return (
          <span key={i}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPick({ key, display: clean, el: e.currentTarget });
              }}
              className={clsx(
                "-mx-1 rounded-lg px-1 decoration-ink-600 decoration-dotted decoration-2 underline-offset-[0.18em] transition-colors duration-150 hover:bg-ink-800 hover:underline",
                activeKey === key && "bg-signal-soft text-signal underline decoration-signal",
              )}
            >
              {token}
            </button>
            {sep}
          </span>
        );
      })}
    </p>
  );
}

const toneOf = (sim: number) => (sim >= 0.85 ? "good" : sim >= 0.55 ? "meh" : "bad");

/** Lo que se oyó, palabra por palabra y coloreado según la precisión. */
export function WordFeedback({ words, onPick }: { words: WordResult[]; onPick: (p: WordPick) => void }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Resultado palabra por palabra">
      {words.map((w, i) => {
        const tone = toneOf(w.sim);
        const clickable = !!DICT[w.word];
        return (
          <li key={i} className="animate-pop" style={{ animationDelay: `${i * 35}ms` }}>
            <button
              type="button"
              disabled={!clickable}
              title={`Precisión ${Math.round(w.sim * 100)}%${clickable ? " · toca para oírla" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onPick({ key: w.word, display: w.word, el: e.currentTarget });
              }}
              className={clsx(
                "rounded-lg px-2.5 py-1 font-mono text-sm font-medium transition hover:brightness-125 disabled:cursor-default",
                tone === "good" && "bg-good-soft text-good",
                tone === "meh" && "bg-meh-soft text-meh",
                tone === "bad" && "bg-bad-soft text-bad underline decoration-wavy decoration-1 underline-offset-4",
              )}
            >
              {w.word}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
