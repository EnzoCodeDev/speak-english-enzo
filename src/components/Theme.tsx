"use client";

import { useSyncExternalStore } from "react";
import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { setPref, snapshot, subscribe, type Theme, type ThemePref } from "@/lib/theme";
import { IconButton } from "./ui";

function useTheme(): { pref: ThemePref; theme: Theme } {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "system|dark");
  const [pref, theme] = snap.split("|") as [ThemePref, Theme];
  return { pref, theme };
}

/** Botón de la cabecera: alterna entre claro y oscuro. */
export function ThemeToggle() {
  const { theme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} onClick={() => setPref(next)}>
      <span className="relative grid size-[18px] place-items-center">
        <Sun className={clsx("absolute size-[18px] transition duration-500 ease-[var(--ease-out-expo)]",
          theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")} />
        <Moon className={clsx("absolute size-[18px] transition duration-500 ease-[var(--ease-out-expo)]",
          theme === "light" ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0")} />
      </span>
    </IconButton>
  );
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Selector de Ajustes: sistema, claro u oscuro. */
export function ThemePicker() {
  const { pref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-xl border border-ink-800 bg-ink-850/60 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setPref(value)}
            className={clsx(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              on ? "bg-ink-900 text-ink-100 shadow-[0_4px_12px_-6px_var(--color-shadow)] ring-1 ring-ink-700" : "text-ink-400 hover:text-ink-100",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        );
      })}
    </div>
  );
}
