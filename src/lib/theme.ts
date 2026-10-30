/* Tema claro / oscuro.
   La preferencia ("system" | "light" | "dark") se guarda aparte del progreso,
   en `speakenzo.theme`, para poder aplicarla con un script en <head> antes de
   que se pinte la página (sin parpadeo). El tema resuelto va en
   <html data-theme="light|dark">, que es lo que leen las variables de globals.css. */

export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "speakenzo.theme";

/** Se inyecta tal cual en <head>: debe ser autocontenido. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='dark'}})();`;

const listeners = new Set<() => void>();
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function getPref(): ThemePref {
  try {
    const p = localStorage.getItem(THEME_KEY);
    return p === "light" || p === "dark" ? p : "system";
  } catch {
    return "system";
  }
}

export function resolve(pref: ThemePref): Theme {
  if (pref !== "system") return pref;
  return media().matches ? "dark" : "light";
}

function apply(animate: boolean) {
  const root = document.documentElement;
  const theme = resolve(getPref());
  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 400);
  }
  root.dataset.theme = theme;
  listeners.forEach((fn) => fn());
}

export function setPref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* sin almacenamiento: se aplica solo en esta visita */
  }
  apply(true);
}

const onSystemChange = () => {
  if (getPref() === "system") apply(true);
};

export function subscribe(fn: () => void) {
  // Con la preferencia "sistema", se siguen los cambios del sistema operativo.
  if (!listeners.size) media().addEventListener("change", onSystemChange);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) media().removeEventListener("change", onSystemChange);
  };
}

/** Instantánea estable para useSyncExternalStore. */
export function snapshot(): string {
  const pref = getPref();
  return `${pref}|${resolve(pref)}`;
}
