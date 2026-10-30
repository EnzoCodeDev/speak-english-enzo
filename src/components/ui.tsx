"use client";

import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-ink-700 border-b-2 bg-ink-850 px-1.5 font-mono text-[10px] font-medium text-ink-300",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function IconButton({
  label, onClick, children, className,
}: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "grid size-10 place-items-center rounded-xl border border-ink-800 bg-ink-900/70 text-ink-300 transition duration-200 hover:-translate-y-px hover:border-ink-600 hover:bg-ink-850 hover:text-ink-100 active:translate-y-0",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Panel lateral (ajustes, estadísticas). Se cierra con Esc o tocando fuera. */
export function Sheet({
  title, open, onClose, children,
}: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/70 animate-[pop_0.3s_ease-out_both]"
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-ink-800 bg-ink-900 shadow-[-30px_0_80px_-20px_var(--color-shadow)] animate-slide-in">
        <header className="flex items-center justify-between border-b border-ink-800 px-6 py-5">
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <IconButton label="Cerrar panel" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-400">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full border border-ink-700 bg-ink-800 transition peer-checked:border-signal peer-checked:bg-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-ink-300 shadow transition duration-300 ease-[var(--ease-out-expo)] peer-checked:translate-x-5 peer-checked:bg-ink-950" />
      </span>
    </label>
  );
}
