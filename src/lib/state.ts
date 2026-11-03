/* ============================================================
   Estado persistente de Speak English Enzo.
   Progreso en localStorage, sin repetir frases hasta completar el ciclo.
   Se conserva la clave `speakenzo.v2` de la versión anterior para que nadie
   pierda su progreso al pasar a la nueva interfaz.
   ============================================================ */

import { PHRASES, SETS, type PhraseSet } from "@/data/phrases";

export const STORAGE_KEY = "speakenzo.v2";
const OLD_STORAGE_KEY = "speakenzo.v1";
// Sube cuando se reescriben frases ya publicadas; ver la migración en loadState().
const PHRASES_VERSION = 4;

export type Lang = "en-US" | "en-GB" | "en-AU" | "en-CA";

export type Settings = {
  threshold: number;
  hitsNeeded: number;
  lang: Lang;
  /** Tanda activa: 'set:<id>'. (Se llama así por compatibilidad con el progreso guardado.) */
  category: string;
  autoplay: boolean;
  autoplayOnByDefault: boolean;
  hideEs: boolean;
  /** Marcadores de las migraciones que dejan una tanda nueva activa una sola vez. */
  startedOnSet3?: boolean;
  startedOnSet4?: boolean;
  /** Marcador de la migración que baja la precisión mínima de 80 a 70 una sola vez. */
  threshold70ByDefault?: boolean;
};

export type Mastered = { score: number; attempts: number; successes: number; date: string; round: number };
export type PhraseRecord = { attempts: number; fails: number; bestScore: number };

export type AppState = {
  phrasesVersion: number;
  rounds: Record<string, number>;
  queue: number[];
  current: number | null;
  mastered: Record<string, Mastered>;
  records: Record<string, PhraseRecord>;
  stats: { totalAttempts: number; totalSuccess: number; bestStreak: number; sessions: number };
  streak: number;
  settings: Settings;
};

export const SET_BY_ID: Record<string, PhraseSet> = Object.fromEntries(SETS.map((s) => [s.id, s]));
export const SET_VALUES = SETS.map((s) => "set:" + s.id);
/** Tanda por defecto. */
export const DEFAULT_SET = "set:set4";

export function optionLabel(value: string): string {
  return SET_BY_ID[value.split(":")[1]]?.label ?? value;
}

export function optionSize(value: string): number {
  const s = SET_BY_ID[value.split(":")[1]];
  return s ? s.end - s.start : 0;
}

/** Tanda a la que pertenece una frase. */
export function setOfPhrase(i: number): PhraseSet | undefined {
  return SETS.find((s) => i >= s.start && i < s.end);
}

export function roundsDone(state: AppState, value: string): number {
  return (state.rounds[value] || 1) - 1;
}

export const defaultState = (): AppState => ({
  phrasesVersion: PHRASES_VERSION,
  rounds: {},
  queue: [],
  current: null,
  mastered: {},
  records: {},
  stats: { totalAttempts: 0, totalSuccess: 0, bestStreak: 0, sessions: 0 },
  streak: 0,
  settings: {
    threshold: 70, hitsNeeded: 2, lang: "en-US",
    category: DEFAULT_SET, autoplay: true, autoplayOnByDefault: true, hideEs: false,
    startedOnSet3: true, startedOnSet4: true, threshold70ByDefault: true,
  },
});

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fromOldSettings();
    const saved = JSON.parse(raw);
    const base = defaultState();
    const st: AppState = {
      ...base, ...saved,
      settings: { ...base.settings, ...(saved.settings || {}) },
      stats: { ...base.stats, ...(saved.stats || {}) },
      rounds: { ...(saved.rounds || {}) },
    };
    // Antes el filtro era solo la categoría a pelo; ahora lleva prefijo.
    const asValue = (k: string) => (k === "all" || k.includes(":") ? k : "cat:" + k);
    st.rounds = Object.fromEntries(Object.entries(st.rounds).map(([k, v]) => [asValue(k), v]));
    st.settings.category = asValue(st.settings.category);
    if (st.settings.category === "all") st.settings.category = "set:set1";
    // Ya no se practica por categorías: solo por tandas.
    const [kind, name] = st.settings.category.split(":");
    if (kind !== "set" || !SET_BY_ID[name]) st.settings.category = DEFAULT_SET;
    // Una sola vez: pasar a la tanda nueva (el marcador se mira en `saved`).
    if (!(saved.settings || {}).startedOnSet4) {
      st.settings.category = DEFAULT_SET;
      st.settings.startedOnSet3 = true;
      st.settings.startedOnSet4 = true;
    }
    if (st.rounds.all && st.rounds["set:set1"] === undefined) st.rounds["set:set1"] = st.rounds.all;
    // La lectura automática pasó a venir activada: se enciende una sola vez.
    // El marcador se mira en `saved`, no en `st.settings` (que trae los valores por defecto).
    if (!(saved.settings || {}).autoplayOnByDefault) {
      st.settings.autoplay = true;
      st.settings.autoplayOnByDefault = true;
    }
    delete (st.settings as Partial<Settings> & { autoplayMigrated?: boolean }).autoplayMigrated;
    // La precisión mínima por defecto pasó de 80 a 70: se baja una sola vez,
    // y solo si seguía en el valor por defecto antiguo (no si se cambió a mano).
    if (!(saved.settings || {}).threshold70ByDefault) {
      if (st.settings.threshold === 80) st.settings.threshold = 70;
      st.settings.threshold70ByDefault = true;
    }
    // El progreso va por posición: si cambió la lista de frases, se descarta.
    if ((saved.phrasesVersion || 1) < PHRASES_VERSION) {
      Object.assign(st, { mastered: {}, records: {}, rounds: {}, queue: [], current: null });
    }
    st.phrasesVersion = PHRASES_VERSION;
    if (st.current === null || !PHRASES[st.current]) { st.current = null; st.queue = []; }
    return st;
  } catch (e) {
    console.warn("Progreso corrupto, empezando de cero", e);
    return defaultState();
  }
}

function fromOldSettings(): AppState {
  const st = defaultState();
  try {
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "null");
    if (old?.settings) {
      const base = defaultState().settings;
      const { threshold, hitsNeeded, lang, hideEs } = old.settings;
      st.settings = {
        ...st.settings,
        threshold: threshold ?? base.threshold,
        hitsNeeded: hitsNeeded ?? base.hitsNeeded,
        lang: lang ?? base.lang,
        hideEs: hideEs ?? base.hideEs,
      };
    }
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {
    /* sin ajustes antiguos */
  }
  return st;
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/* ---------- cola sin repeticiones ---------- */

export function inCategory(state: AppState, i: number): boolean {
  if (!PHRASES[i]) return false;
  const v = state.settings.category;
  if (v === "all") return true;
  const [kind, name] = v.split(":");
  if (kind === "set") {
    const set = SET_BY_ID[name];
    return !!set && i >= set.start && i < set.end;
  }
  return PHRASES[i][2] === name;
}

export function currentRound(state: AppState): number {
  return state.rounds[state.settings.category] || 1;
}

export function buildQueue(state: AppState) {
  const round = currentRound(state);
  const pending = PHRASES.map((_, i) => i).filter(
    (i) => inCategory(state, i) && !(state.mastered[i] && state.mastered[i].round === round),
  );
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }
  state.queue = pending;
}

/** Pasa a la siguiente frase. Devuelve la ronda nueva si se completó un ciclo. */
export function advance(state: AppState): number | null {
  let newRound: number | null = null;
  if (!state.queue.length) buildQueue(state);
  if (!state.queue.length) {
    const c = state.settings.category;
    state.rounds[c] = currentRound(state) + 1; // solo se reinicia ESTE ciclo
    newRound = state.rounds[c];
    buildQueue(state);
  }
  state.current = state.queue.shift() ?? null;
  return newRound;
}

export function progressOf(state: AppState, value = state.settings.category) {
  const tmp = { ...state, settings: { ...state.settings, category: value } };
  const round = currentRound(tmp);
  let total = 0, done = 0;
  PHRASES.forEach((_, i) => {
    if (!inCategory(tmp, i)) return;
    total++;
    if (state.mastered[i]?.round === round) done++;
  });
  return { total, done, round };
}

/** Arranque de sesión: valida la selección y deja una frase en pantalla. */
export function startSession(state: AppState) {
  state.stats.sessions++;
  if (!PHRASES.some((_, i) => inCategory(state, i))) {
    state.settings.category = DEFAULT_SET;
    state.queue = [];
  }
  state.queue = state.queue.filter((i) => inCategory(state, i));
  if (state.current === null || !inCategory(state, state.current)) {
    if (!state.queue.length) buildQueue(state);
    advance(state);
  }
}

export function setCategory(state: AppState, value: string): number | null {
  state.settings.category = value;
  buildQueue(state);
  return advance(state);
}

export function updateSettings(state: AppState, patch: Partial<Settings>) {
  state.settings = { ...state.settings, ...patch };
}

/** Registra un intento. `hits` son los aciertos seguidos antes de este intento. */
export function recordAttempt(state: AppState, score: number, hits: number, bestThisPhrase: number) {
  const id = state.current!;
  const { threshold, hitsNeeded } = state.settings;
  state.stats.totalAttempts++;
  const rec = state.records[id] || { attempts: 0, fails: 0, bestScore: 0 };
  rec.attempts++;
  rec.bestScore = Math.max(rec.bestScore, score);
  const best = Math.max(bestThisPhrase, score);
  const passed = score >= threshold;
  let newHits = 0;
  let mastered = false;
  if (passed) {
    newHits = hits + 1;
    state.stats.totalSuccess++;
    state.streak++;
    state.stats.bestStreak = Math.max(state.stats.bestStreak, state.streak);
    if (newHits >= hitsNeeded) {
      mastered = true;
      state.mastered[id] = {
        score: best, attempts: rec.attempts, successes: newHits,
        date: new Date().toISOString(), round: currentRound(state),
      };
    }
  } else {
    rec.fails++;
    state.streak = 0;
  }
  state.records[id] = rec;
  return { passed, hits: newHits, mastered, best };
}

/** Normaliza un progreso importado desde un JSON exportado. */
export function fromImported(data: unknown): AppState {
  if (!data || typeof data !== "object" || !("mastered" in data)) throw new Error("formato");
  const d = data as Partial<AppState>;
  const base = defaultState();
  const st: AppState = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } } as AppState;
  if (!st.settings.category.startsWith("set:")) st.settings.category = DEFAULT_SET;
  return st;
}
