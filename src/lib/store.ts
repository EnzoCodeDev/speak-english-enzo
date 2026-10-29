import { loadState, saveState, startSession, type AppState } from "./state";

/** Envoltorio mínimo del estado para usarlo con useSyncExternalStore.
 *  Las mutaciones se hacen sobre `state` y se confirman con commit(). */
export class Store {
  state: AppState;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = loadState();
    startSession(this.state);
    saveState(this.state);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  /** Guarda en localStorage y avisa a React. Devuelve false si no se pudo guardar. */
  commit(): boolean {
    const ok = saveState(this.state);
    this.version++;
    this.listeners.forEach((fn) => fn());
    return ok;
  }

  replace(next: AppState) {
    this.state = next;
  }
}
