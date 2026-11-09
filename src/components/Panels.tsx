"use client";

import { useRef } from "react";
import clsx from "clsx";
import { Download, Trash2, Upload } from "lucide-react";
import { PHRASES, SET_GROUPS } from "@/data/phrases";
import {
  SET_VALUES, currentRound, optionLabel, progressOf, roundsDone,
  type AppState, type Lang, type Settings,
} from "@/lib/state";
import { ThemePicker } from "./Theme";
import { Toggle } from "./ui";

const LANGS: { value: Lang; label: string }[] = [
  { value: "en-US", label: "Americano (en-US)" },
  { value: "en-GB", label: "Británico (en-GB)" },
  { value: "en-AU", label: "Australiano (en-AU)" },
  { value: "en-CA", label: "Canadiense (en-CA)" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="mb-3 text-sm font-semibold text-ink-300">{title}</h3>
      {children}
    </section>
  );
}

function Slider({
  label, value, unit, min, max, step, onChange,
}: { label: string; value: number; unit?: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block py-2">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink-100">{label}</span>
        <span className="font-mono text-base text-signal-fg tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="mt-2 w-full"
      />
    </label>
  );
}

export function SettingsPanel({
  state, onSettings, onCategory, onExport, onImport, onReset,
}: {
  state: AppState;
  onSettings: (patch: Partial<Settings>) => void;
  onCategory: (value: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}) {
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);

  const option = (value: string) => {
    const p = progressOf(state, value);
    const r = roundsDone(state, value);
    return (
      <option key={value} value={value}>
        {optionLabel(value)} · {p.done}/{p.total}{r > 0 ? ` · ${r}×` : ""}
      </option>
    );
  };

  return (
    <div>
      <Section title="Tanda">
        <select
          aria-label="Tanda en ajustes"
          value={s.category}
          onChange={(e) => onCategory(e.target.value)}
          className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-ink-100"
        >
          {SET_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.sets.map((set) => option(`set:${set.id}`))}
            </optgroup>
          ))}
        </select>
      </Section>

      <Section title="Apariencia">
        <ThemePicker />
      </Section>

      <Section title="Exigencia">
        <Slider label="Precisión mínima" value={s.threshold} unit="%" min={50} max={100} step={5}
          onChange={(v) => onSettings({ threshold: v })} />
        <Slider label="Aciertos seguidos" value={s.hitsNeeded} min={1} max={5} step={1}
          onChange={(v) => onSettings({ hitsNeeded: v })} />
      </Section>

      <Section title="Voz">
        <label className="block">
          <span className="text-sm font-medium text-ink-100">Acento</span>
          <select
            value={s.lang}
            onChange={(e) => onSettings({ lang: e.target.value as Lang })}
            className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-ink-100"
          >
            {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <div className="mt-2 divide-y divide-ink-800">
          <Toggle label="Leer la frase al aparecer" hint="La oyes antes de decirla."
            checked={s.autoplay} onChange={(v) => onSettings({ autoplay: v })} />
          <Toggle label="Ocultar la traducción" hint="Modo difícil: tócala para verla."
            checked={s.hideEs} onChange={(v) => onSettings({ hideEs: v })} />
        </div>
      </Section>

      <Section title="Tu progreso">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-700 px-3.5 py-2 text-sm text-ink-100 transition hover:border-ink-600 hover:bg-ink-850">
            <Download className="size-4" /> Exportar
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-700 px-3.5 py-2 text-sm text-ink-100 transition hover:border-ink-600 hover:bg-ink-850">
            <Upload className="size-4" /> Importar
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          <button type="button" onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-bad/40 px-3.5 py-2 text-sm text-bad-fg transition hover:bg-bad-soft">
            <Trash2 className="size-4" /> Borrar todo
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          El progreso se guarda en este navegador. Para llevarlo a otro, expórtalo aquí e impórtalo allí.
        </p>
      </Section>
    </div>
  );
}

export function StatsPanel({ state }: { state: AppState }) {
  const masteredIds = Object.keys(state.mastered);
  const acc = state.stats.totalAttempts
    ? Math.round((state.stats.totalSuccess / state.stats.totalAttempts) * 100) : 0;
  const scores = masteredIds.map((i) => state.mastered[i].score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const figures: [string, string | number][] = [
    ["Dominadas", masteredIds.length],
    ["Ronda", currentRound(state)],
    ["Intentos", state.stats.totalAttempts],
    ["Precisión media", avg + "%"],
    ["Tasa de acierto", acc + "%"],
    ["Mejor racha", state.stats.bestStreak],
  ];

  const sets = SET_VALUES.map((v) => ({ name: optionLabel(v), ...progressOf(state, v) }));

  const hard = Object.entries(state.records)
    .filter(([id, r]) => r.fails > 0 && PHRASES[+id])
    .sort((a, b) => b[1].fails - a[1].fails)
    .slice(0, 10);

  return (
    <div>
      <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border border-ink-800">
        {figures.map(([k, v], i) => (
          <div key={k} className={clsx("p-4", i % 3 !== 0 && "border-l border-ink-800", i >= 3 && "border-t border-ink-800")}>
            <dd className="font-mono text-2xl font-semibold tabular-nums text-ink-100">{v}</dd>
            <dt className="mt-1 text-xs text-ink-400">{k}</dt>
          </div>
        ))}
      </dl>

      <Section title="Por tanda">
        <ul className="space-y-3">
          {sets.map((c) => (
            <li key={c.name} className="grid grid-cols-[minmax(0,1.5fr)_1fr_3rem] items-center gap-3 text-sm">
              <span className="truncate text-ink-300" title={c.name}>{c.name}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                <span className="block h-full rounded-full bg-signal transition-[width] duration-700"
                  style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
              </span>
              <span className="text-right font-mono text-xs text-ink-400 tabular-nums">{c.done}/{c.total}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Las que más te cuestan">
        {hard.length ? (
          <ol className="space-y-2">
            {hard.map(([id, r], i) => (
              <li key={id} className="flex gap-3 rounded-xl bg-ink-850/60 px-3.5 py-2.5 text-sm">
                <span className="w-4 shrink-0 font-mono text-ink-400 tabular-nums">{i + 1}</span>
                <span className="flex-1">
                  <span className="font-medium text-ink-100">{PHRASES[+id][0]}</span>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {r.fails} {r.fails === 1 ? "fallo" : "fallos"} · mejor {r.bestScore}%
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-400">Aún no hay fallos registrados. Cuando falles alguna, aparecerá aquí.</p>
        )}
      </Section>
    </div>
  );
}
