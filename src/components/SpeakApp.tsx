"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import {
  ArrowRight, ChartColumn, ChevronDown, Eye, Flame, Hand, Lock, Mic, RotateCcw, Settings2, Snail, Square,
  TriangleAlert, Volume2,
} from "lucide-react";
import { PHRASES, SET_GROUPS } from "@/data/phrases";
import { cleanChunks, evaluateBest, normalize, type Chunk, type Evaluation, type WordResult } from "@/lib/scoring";
import {
  RECOGNITION_ERRORS, getRecognizerCtor, isMobile, speak, stopSpeaking, type Recognizer,
} from "@/lib/speech";
import {
  STORAGE_KEY, advance, defaultState, fromImported, optionLabel, progressOf,
  recordAttempt, roundsDone, setCategory, setOfPhrase, updateSettings, type Settings,
} from "@/lib/state";
import { Store } from "@/lib/store";
import { PhraseText, WordFeedback, type WordPick } from "./Phrase";
import { SettingsPanel, StatsPanel } from "./Panels";
import { ThemeToggle } from "./Theme";
import { IconButton, Kbd, Sheet } from "./ui";
import { WordPopover, type PopoverState } from "./WordPopover";

type Tone = "idle" | "rec" | "good" | "bad";
type Status = { text: string; tone: Tone };

const IDLE: Status = { text: "Pulsa el micrófono y repite la frase en voz alta.", tone: "idle" };

export default function SpeakApp() {
  const [store] = useState(() => new Store());
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const S = store.state;
  const phraseIndex = S.current ?? 0;
  const phrase = PHRASES[phraseIndex];
  const { threshold, hitsNeeded, lang } = S.settings;

  const [supported] = useState(() => !!getRecognizerCtor());
  const [mobile] = useState(isMobile);

  const [score, setScore] = useState<number | null>(null);
  const [words, setWords] = useState<WordResult[] | null>(null);
  const [heard, setHeard] = useState<{ label: string; text: string } | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [hits, setHits] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [revealEs, setRevealEs] = useState(false);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [panel, setPanel] = useState<"settings" | "stats" | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const recRef = useRef<Recognizer | null>(null);
  const chunksRef = useRef<Chunk[]>([]);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bestRef = useRef(0);

  /* ---------- utilidades ---------- */

  const showToast = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const commit = () => {
    if (!store.commit()) showToast("No se pudo guardar el progreso");
  };

  const say = (text: string, rate = 1) => speak(text, rate, store.state.settings.lang);

  const resetPhraseUI = () => {
    setScore(null);
    setWords(null);
    setHeard(null);
    setStatus(IDLE);
    setHits(0);
    setUnlocked(false);
    setRevealEs(false);
    setPopover(null);
    bestRef.current = 0;
  };

  /** Cambia de frase. `autoplay` solo tras un gesto: sin él el navegador bloquea la voz. */
  const afterPhraseChange = (newRound: number | null, autoplay = true) => {
    commit();
    resetPhraseUI();
    if (newRound) showToast(`¡Ciclo completo! Empieza la ronda ${newRound} de ${optionLabel(store.state.settings.category)}`);
    // Un respiro tras el cancel() de la locución anterior: si no, Chromium se traga la frase.
    if (autoplay && store.state.settings.autoplay) {
      const text = PHRASES[store.state.current ?? 0][0];
      setTimeout(() => say(text), 250);
    }
  };

  const goNext = () => {
    if (!unlocked) return;
    afterPhraseChange(advance(store.state));
  };

  const chooseCategory = (value: string) => {
    recRef.current?.abort();
    afterPhraseChange(setCategory(store.state, value));
    setPanel(null);
  };

  /* ---------- evaluación de un intento ---------- */

  const handleAttempt = (result: Evaluation) => {
    const st = store.state;
    const r = recordAttempt(st, result.score, hits, bestRef.current);
    bestRef.current = r.best;
    setScore(result.score);
    setWords(result.words);
    setHeard({ label: "Dijiste", text: result.transcript || "" });
    setHits(r.hits);

    if (r.passed) {
      if (r.mastered) {
        setStatus({ text: "¡Perfecto! Frase dominada.", tone: "good" });
        setUnlocked(true);
      } else {
        const falta = st.settings.hitsNeeded - r.hits;
        setStatus({ text: `¡Bien! Repítela ${falta} ${falta > 1 ? "veces" : "vez"} más para dominarla.`, tone: "good" });
      }
    } else {
      const diff = st.settings.threshold - result.score;
      // Muchas menos palabras de las que tiene la frase casi siempre es audio cortado, no pronunciación.
      const saidCount = normalize(result.transcript || "").length;
      const targetCount = normalize(PHRASES[st.current ?? 0][0]).length;
      let text: string;
      if (saidCount && targetCount >= 3 && saidCount < targetCount) {
        text = `Solo escuché ${saidCount} de ${targetCount} palabras. Espera a ver «Escuchando…» y di la frase completa.`;
      } else if (diff <= 10) text = "Casi. Fíjate en las palabras en rojo y repite.";
      else if (diff <= 25) text = "Vas bien. Escucha el audio y vuelve a intentarlo.";
      else text = "Otra vez, vocalizando más despacio.";
      setStatus({ text, tone: "bad" });
    }
    commit();
  };

  /* ---------- reconocimiento de voz ---------- */

  const onRecStart = useEffectEvent(() => {
    chunksRef.current = [];
    setRecording(true);
    setStatus({ text: "Escuchando… habla ahora", tone: "rec" });
  });

  const onRecResult = useEffectEvent((e: Parameters<NonNullable<Recognizer["onresult"]>>[0]) => {
    // El reconocedor puede partir la frase en varios segmentos finales: hay que juntarlos todos.
    let chunks: Chunk[] = [];
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) {
        const alts: string[] = [];
        for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
        chunks.push(alts);
      } else {
        interim += " " + res[0].transcript;
      }
    }
    chunks = cleanChunks(chunks, mobile);
    chunksRef.current = chunks;
    const live = (chunks.map((a) => a[0]).join(" ") + interim).trim();
    if (live) setHeard({ label: "Escuchando", text: live });
    // Cada vez que llega audio se reinicia la cuenta de silencio.
    clearTimeout(silenceRef.current);
    if (chunks.length) {
      silenceRef.current = setTimeout(() => {
        try { recRef.current?.stop(); } catch { /* ya parado */ }
      }, 1400);
    }
  });

  const onRecError = useEffectEvent((error: string) => {
    setRecording(false);
    if (error === "aborted") return; // parada propia, no es un error
    setStatus({ text: RECOGNITION_ERRORS[error] || `Error del reconocimiento: ${error}`, tone: "bad" });
  });

  const onRecEnd = useEffectEvent(() => {
    clearTimeout(silenceRef.current);
    setRecording(false);
    const chunks = cleanChunks(chunksRef.current, mobile);
    chunksRef.current = [];
    if (!chunks.length) {
      setStatus((s) => (s.tone === "rec" ? IDLE : s));
      return;
    }
    const best = evaluateBest(PHRASES[store.state.current ?? 0][0], chunks);
    if (best) handleAttempt(best);
  });

  useEffect(() => {
    const Ctor = getRecognizerCtor();
    if (!Ctor) return;
    const r = new Ctor();
    // Continuo en escritorio para que una pausa no corte la frase; el final lo decide el silencio.
    r.continuous = !mobile;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.onstart = () => onRecStart();
    r.onresult = (e) => onRecResult(e);
    r.onerror = (e) => onRecError(e.error);
    r.onend = () => onRecEnd();
    recRef.current = r;
    window.speechSynthesis?.getVoices(); // precarga de voces
    return () => {
      r.onstart = r.onresult = r.onerror = r.onend = null;
      try { r.abort(); } catch { /* nada que parar */ }
      recRef.current = null;
    };
  }, [mobile]);

  const toggleMic = () => {
    const r = recRef.current;
    if (!r) return;
    if (recording) { r.stop(); return; }
    stopSpeaking();
    setPopover(null);
    // El micrófono tarda un momento en abrirse: avisamos para que no se hable antes.
    setStatus({ text: "Preparando el micrófono…", tone: "idle" });
    setHeard(null);
    r.lang = lang;
    try { r.start(); } catch { /* ya estaba activo */ }
  };

  const retry = () => {
    setHits(0);
    setScore(null);
    setWords(null);
    setHeard(null);
    setStatus({ text: "Inténtalo de nuevo.", tone: "idle" });
  };

  /* ---------- palabras ---------- */

  const pickWord = (p: WordPick) => {
    setPopover({ key: p.key, display: p.display, anchor: p.el.getBoundingClientRect() });
    say(p.key, 0.75);
  };

  useEffect(() => {
    if (!popover) return;
    const close = () => setPopover(null);
    document.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close);
    };
  }, [popover]);

  /* ---------- atajos de teclado ---------- */

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.matches("input, select, textarea") || panel) return;
    if (e.code === "Space") { e.preventDefault(); toggleMic(); }
    else if (e.code === "Enter" && unlocked && !(t instanceof HTMLButtonElement)) goNext();
    else if (e.key.toLowerCase() === "l" && !e.ctrlKey && !e.metaKey) say(phrase[0]);
    else if (e.key === "Escape") setPopover(null);
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  /* ---------- ajustes y progreso ---------- */

  const changeSettings = (patch: Partial<Settings>) => {
    updateSettings(store.state, patch);
    if (patch.hitsNeeded !== undefined) setHits(0);
    commit();
  };

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "speak-english-enzo-progreso.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Progreso exportado");
  };

  const importProgress = (file: File) => {
    file.text().then((txt) => {
      try {
        store.replace(fromImported(JSON.parse(txt)));
        afterPhraseChange(setCategory(store.state, store.state.settings.category));
        setPanel(null);
        showToast("Progreso importado");
      } catch {
        showToast("Ese archivo no es un progreso válido");
      }
    });
  };

  const resetProgress = () => {
    if (!confirm("¿Borrar todo tu progreso? No se puede deshacer.")) return;
    localStorage.removeItem(STORAGE_KEY);
    store.replace(defaultState());
    afterPhraseChange(setCategory(store.state, store.state.settings.category));
    setPanel(null);
    showToast("Progreso borrado");
  };

  /* ---------- render ---------- */

  const progress = progressOf(S);
  const active = S.settings.category;
  const scoreTone = score === null ? "none" : score >= threshold ? "good" : score >= threshold - 20 ? "meh" : "bad";

  const optionText = (v: string) => {
    const p = progressOf(S, v);
    const r = roundsDone(S, v);
    return `${optionLabel(v)} · ${p.done}/${p.total}${r ? ` · ${r} ${r === 1 ? "ronda" : "rondas"}` : ""}`;
  };

  const roundBtn = "grid size-12 place-items-center rounded-full border border-ink-700 text-ink-100 transition hover:border-ink-600 hover:bg-ink-850 active:scale-95";
  const pillBtn = "inline-flex items-center gap-2 rounded-xl border border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-100 transition hover:border-ink-600 hover:bg-ink-850";

  return (
    // En móvil la app ocupa exactamente la pantalla (sin scroll de página); en escritorio fluye normal.
    <div className="mx-auto flex h-dvh max-w-5xl flex-col overflow-hidden px-3 pb-3 sm:px-6 md:h-auto md:min-h-dvh md:overflow-visible md:pb-8">
      {/* ---------- cabecera ---------- */}
      <header className="flex shrink-0 items-center justify-between gap-3 pt-3 md:pt-7">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-signal text-on-accent shadow-[0_10px_30px_-10px_var(--color-signal)] md:size-11 md:rounded-2xl">
            <Mic className="size-[18px] md:size-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-base leading-tight font-bold tracking-tight md:text-xl">Speak English Enzo</h1>
            <p className="hidden text-xs text-ink-400 sm:block">{PHRASES.length} frases · VRChat y entrevistas</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <ThemeToggle />
          <IconButton label="Estadísticas" onClick={() => setPanel("stats")}>
            <ChartColumn className="size-[18px]" />
          </IconButton>
          <IconButton label="Ajustes" onClick={() => setPanel("settings")}>
            <Settings2 className="size-[18px]" />
          </IconButton>
        </div>
      </header>

      {/* ---------- qué practicar + progreso ---------- */}
      <nav className="mt-3 flex shrink-0 items-center justify-between gap-3 md:mt-8" aria-label="Qué practicar">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Tanda</span>
          <select
            value={active}
            onChange={(e) => chooseCategory(e.target.value)}
            className="w-full appearance-none truncate rounded-xl border border-ink-800 bg-ink-900 py-2.5 pr-10 pl-3.5 text-sm font-medium text-ink-100 transition hover:border-ink-600 focus-visible:border-signal"
          >
            {SET_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.sets.map((set) => (
                  <option key={set.id} value={`set:${set.id}`}>{optionText(`set:${set.id}`)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" />
        </label>
        <div className="flex shrink-0 items-center gap-3 text-sm text-ink-400 md:gap-4">
          <span className="font-mono tabular-nums">Ronda {progress.round}</span>
          <span
            className={clsx("flex items-center gap-1 font-mono tabular-nums", S.streak > 0 ? "text-signal-fg" : "text-ink-400")}
            title="Aciertos seguidos"
          >
            <Flame className="size-4" /> {S.streak}
          </span>
        </div>
      </nav>

      <div className="mt-3 h-1 shrink-0 overflow-hidden rounded-full bg-ink-800 md:mt-4" role="progressbar"
        aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}
        aria-label={`${progress.done} de ${progress.total} frases dominadas`}>
        <div className="h-full rounded-full bg-signal transition-[width] duration-700 ease-[var(--ease-out-expo)]"
          style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </div>

      {/* ---------- escenario ---------- */}
      <main className="relative mt-3 flex min-h-0 flex-1 flex-col rounded-3xl border border-ink-800 bg-ink-900/80 shadow-[0_40px_100px_-40px_var(--color-shadow)] md:mt-6 md:rounded-[28px]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 pb-4 md:px-12 md:pt-10 md:pb-8">
          <div className="flex items-center justify-between text-xs font-medium text-ink-400">
            <span className="flex min-w-0 items-center gap-2 pr-2">
              <span className="size-1.5 rounded-full bg-signal" />
              <span className="truncate" title={setOfPhrase(phraseIndex)?.label}>
                {setOfPhrase(phraseIndex)?.label} · frase {phraseIndex - (setOfPhrase(phraseIndex)?.start ?? 0) + 1}
              </span>
            </span>
            <span className="flex items-center gap-2" aria-label={`${hits} de ${hitsNeeded} aciertos seguidos`}>
              Aciertos
              <span className="flex gap-1">
                {Array.from({ length: hitsNeeded }, (_, i) => (
                  <span key={i} className={clsx("h-1.5 w-4 rounded-full transition-colors duration-300 md:w-5", i < hits ? "bg-good" : "bg-ink-700")} />
                ))}
              </span>
            </span>
          </div>

          <div key={phraseIndex} className="my-auto py-2 animate-rise md:my-0 md:mt-12 md:py-0">
            <PhraseText text={phrase[0]} activeKey={popover?.key ?? null} onPick={pickWord} />
            {S.settings.hideEs && !revealEs ? (
              <button type="button" onClick={() => setRevealEs(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg text-base text-ink-400 transition hover:text-ink-300 md:mt-5 md:text-lg">
                <Eye className="size-4" />
                <span className="blur-[6px] select-none" aria-hidden="true">{phrase[1]}</span>
                <span className="sr-only">Mostrar traducción</span>
              </button>
            ) : (
              <p className="mt-3 text-base text-ink-300 md:mt-5 md:text-xl">{phrase[1]}</p>
            )}
            {!words && (
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-400 md:mt-6">
                <Hand className="size-3.5 shrink-0" /> Toca una palabra para ver qué significa y cómo suena
              </p>
            )}
            {words && (
              <div className="mt-3 border-t border-ink-800 pt-3 md:mt-8 md:pt-6">
                <WordFeedback words={words} onPick={pickWord} />
              </div>
            )}
          </div>
        </div>

        {/* ---------- consola ---------- */}
        <div className="shrink-0 rounded-b-3xl border-t border-ink-800 bg-ink-950/40 px-4 py-3.5 md:rounded-b-[28px] md:px-12 md:py-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-3 md:gap-8">
            {/* puntuación: fila completa en móvil, columna izquierda en escritorio */}
            <div className="col-span-3 flex items-center gap-3 md:col-span-1 md:block">
              <div className="flex shrink-0 items-baseline gap-1">
                <span className={clsx(
                  "font-mono text-3xl font-semibold tracking-tight tabular-nums transition-colors md:text-5xl",
                  scoreTone === "none" && "text-ink-600",
                  scoreTone === "good" && "text-good-fg",
                  scoreTone === "meh" && "text-meh-fg",
                  scoreTone === "bad" && "text-bad-fg",
                )}>
                  {score ?? "––"}
                </span>
                <span className="font-mono text-base text-ink-400 md:text-lg">%</span>
                <span className="ml-2 hidden text-xs text-ink-400 md:inline">precisión</span>
              </div>
              <div className="relative h-2 flex-1 rounded-full bg-ink-800 md:mt-3">
                <div
                  className={clsx(
                    "h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]",
                    scoreTone === "good" ? "bg-good" : scoreTone === "meh" ? "bg-meh" : "bg-bad",
                  )}
                  style={{ width: `${score ?? 0}%` }}
                />
                <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink-100" style={{ left: `${threshold}%` }}
                  title={`Mínimo: ${threshold}%`} />
              </div>
              <p className="mt-2 hidden text-xs text-ink-400 md:block">
                Necesitas <b className="font-mono text-ink-300">{threshold}%</b> y{" "}
                <b className="font-mono text-ink-300">{hitsNeeded}</b> {hitsNeeded === 1 ? "acierto" : "aciertos seguidos"}.
              </p>
            </div>

            {/* escuchar (móvil: a la izquierda del micro) */}
            <div className="flex justify-end md:hidden">
              <button type="button" onClick={() => say(phrase[0])} aria-label="Escuchar la frase" className={roundBtn}>
                <Volume2 className="size-5" />
              </button>
            </div>

            {/* micrófono */}
            <div className="flex flex-col items-center">
              {supported ? (
                <>
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={recording ? "Detener" : "Hablar"}
                    className={clsx(
                      "relative grid size-[72px] place-items-center rounded-full transition duration-300 ease-[var(--ease-out-expo)] active:scale-95 md:size-24",
                      recording
                        ? "bg-bad text-on-accent shadow-[0_18px_50px_-12px_var(--color-bad)]"
                        : "bg-signal text-on-accent shadow-[0_18px_50px_-14px_var(--color-signal)] hover:scale-105",
                    )}
                  >
                    {recording && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-bad animate-halo" />
                        <span className="absolute inset-0 rounded-full bg-bad animate-halo [animation-delay:0.8s]" />
                      </>
                    )}
                    {recording
                      ? <Square className="relative size-6 fill-current md:size-7" />
                      : <Mic className="relative size-8 md:size-9" strokeWidth={2.2} />}
                  </button>
                  <span className="mt-3 hidden items-center gap-2 text-sm font-medium text-ink-300 md:flex">
                    {recording ? "Detener" : "Hablar"} <Kbd>Espacio</Kbd>
                  </span>
                </>
              ) : (
                <div className="max-w-[12rem] rounded-2xl border border-meh/30 bg-meh-soft p-3 text-xs text-ink-100 md:max-w-xs md:p-4 md:text-sm">
                  <p className="flex items-center gap-2 font-semibold text-meh-fg">
                    <TriangleAlert className="size-4 shrink-0" /> Sin reconocimiento de voz
                  </p>
                  <p className="mt-1.5 text-ink-300">
                    Abre la app en <b>Chrome</b> o <b>Edge</b> para practicar.
                  </p>
                </div>
              )}
            </div>

            {/* lento (móvil) / escuchar + lento (escritorio) */}
            <div className="flex justify-start md:hidden">
              <button type="button" onClick={() => say(phrase[0], 0.55)} aria-label="Escuchar lento" className={roundBtn}>
                <Snail className="size-5" />
              </button>
            </div>
            <div className="hidden justify-end gap-2 md:flex">
              <button type="button" onClick={() => say(phrase[0])} className={pillBtn}>
                <Volume2 className="size-4" /> Escuchar <Kbd>L</Kbd>
              </button>
              <button type="button" onClick={() => say(phrase[0], 0.55)} className={pillBtn}>
                <Snail className="size-4" /> Lento
              </button>
            </div>
          </div>

          {/* estado */}
          <div className="mt-4 flex flex-col gap-3 border-t border-ink-800 pt-3 md:mt-7 md:flex-row md:items-center md:justify-between md:gap-4 md:pt-5">
            <div className="min-w-0" aria-live="polite">
              <p className={clsx(
                "flex items-center gap-2 text-sm font-medium",
                status.tone === "idle" && "text-ink-300",
                status.tone === "rec" && "text-bad-fg",
                status.tone === "good" && "text-good-fg",
                status.tone === "bad" && "text-bad-fg",
              )}>
                {status.tone === "rec" && (
                  <span className="flex h-4 shrink-0 items-center gap-0.5" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="h-full w-0.5 origin-center rounded-full bg-bad animate-bar"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
                <span className="line-clamp-2">{status.text}</span>
              </p>
              {heard && (
                <p className="mt-1 truncate text-sm text-ink-400">
                  {heard.label}: <span className="text-ink-100">{heard.text}</span>
                </p>
              )}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 md:flex md:items-center">
              <button type="button" onClick={retry}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-800 px-3.5 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-ink-850 hover:text-ink-100 md:border-transparent md:text-ink-400">
                <RotateCcw className="size-4" /> Reintentar
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!unlocked}
                title={unlocked ? "Siguiente frase (Enter)" : "Bloqueada hasta que la pronuncies bien"}
                className={clsx(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-300",
                  unlocked
                    ? "bg-good text-on-accent shadow-[0_12px_30px_-12px_var(--color-good)] hover:brightness-110"
                    : "cursor-not-allowed border border-ink-800 bg-ink-850 text-ink-400",
                )}
              >
                {unlocked ? <>Siguiente <ArrowRight className="size-4" /></> : <><Lock className="size-3.5" /> Siguiente</>}
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-6 hidden items-center justify-center gap-5 text-xs text-ink-400 md:flex">
        <span className="flex items-center gap-1.5"><Kbd>Espacio</Kbd> hablar</span>
        <span className="flex items-center gap-1.5"><Kbd>L</Kbd> escuchar</span>
        <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd> siguiente</span>
        <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> cerrar</span>
      </footer>

      {popover && <WordPopover state={popover} onSay={() => say(popover.key, 0.75)} />}

      <Sheet title="Ajustes" open={panel === "settings"} onClose={() => setPanel(null)}>
        <SettingsPanel state={S} onSettings={changeSettings} onCategory={chooseCategory}
          onExport={exportProgress} onImport={importProgress} onReset={resetProgress} />
      </Sheet>
      <Sheet title="Tu progreso" open={panel === "stats"} onClose={() => setPanel(null)}>
        <StatsPanel state={S} />
      </Sheet>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div key={toast.id} role="status"
            className="animate-pop rounded-full bg-ink-100 px-5 py-2.5 text-sm font-medium text-ink-950 shadow-[0_16px_40px_-10px_var(--color-shadow)]">
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
