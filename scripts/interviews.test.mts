import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import ts from "typescript";
import { DICT } from "../src/data/dictionary.ts";
import { PHRASES, SETS, SET_GROUPS } from "../src/data/phrases.ts";
import { PALABRAS_CONVERSACION } from "../src/data/palabras-conversacion.ts";
import { evaluate } from "../src/lib/scoring.ts";

// Ejecuta las funciones reales con el mismo catálogo, sin resolver el alias de Next
// ni instalar otro runner. El estado queda aislado en un localStorage en memoria.
const source = readFileSync(new URL("../src/lib/state.ts", import.meta.url), "utf8");
const resolved = source.replace(
  'import { PHRASES, SETS, type PhraseSet } from "@/data/phrases";',
  `const PHRASES = ${JSON.stringify(PHRASES)}; const SETS = ${JSON.stringify(SETS)};`,
);
assert.notEqual(resolved, source, "El import del catálogo debe resolverse explícitamente");
const compiled = ts.transpile(resolved, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const state: typeof import("../src/lib/state.ts") = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});

function previousState() {
  const saved = state.defaultState();
  delete saved.settings.startedOnInterviews;
  saved.settings.category = "set:set5";
  saved.settings.threshold = 85;
  saved.settings.autoplay = false;
  saved.settings.hideEs = true;
  saved.current = 249;
  saved.queue = [230, 240, 245];
  saved.mastered = { 0: { score: 100, attempts: 2, successes: 2, date: "2026-11-09", round: 1 } };
  saved.records = { 0: { attempts: 2, fails: 0, bestScore: 100 }, 249: { attempts: 1, fails: 1, bestScore: 50 } };
  saved.rounds = { "set:set1": 2, "set:set5": 1 };
  saved.stats = { totalAttempts: 3, totalSuccess: 2, bestStreak: 2, sessions: 4 };
  storage.set(state.STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

test("500 frases: diez tandas de 50, cinco por contexto", () => {
  assert.equal(PHRASES.length, 500);
  assert.equal(SETS.length, 10);
  assert.deepEqual(SET_GROUPS.map(g => [g.label, g.sets.length]), [
    ["VRChat", 5], ["Entrevistas de programación", 5],
  ]);
  for (const [i, set] of SETS.entries()) {
    assert.equal(set.id, `set${i + 1}`);
    assert.equal(set.start, i * 50);
    assert.equal(set.end - set.start, 50);
  }
});

test("las 250 frases publicadas conservan texto, traducción, categoría y orden", () => {
  // Huella del catálogo de 250 frases publicado antes de añadir entrevistas.
  const actual = createHash("sha256").update(JSON.stringify(PHRASES.slice(0, 250))).digest("hex");
  assert.equal(actual, "02db5fc3c41c182a8a4cd1928da9c9a65371ac4d5888ddcf765caa4f6abb7997");
  const vocabulary = new Set(PALABRAS_CONVERSACION);
  assert.equal(vocabulary.size, 200);
  for (const [en] of PHRASES.slice(0, 250)) {
    const words = en.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean);
    assert.ok(words.every(w => vocabulary.has(w)), en);
  }
});

test("cada tanda nueva tiene 50 frases traducidas de su tema y arranques variados", () => {
  const categories = ["entrevista personal", "entrevista equipo", "entrevista codigo", "entrevista web", "entrevista sistemas"];
  for (const [i, set] of SETS.slice(5).entries()) {
    const phrases = PHRASES.slice(set.start, set.end);
    assert.equal(phrases.length, 50);
    assert.ok(phrases.every(p => p.length === 3 && p.every(x => x.trim()) && p[2] === categories[i]));
    const starts = new Set(phrases.map(([en]) => en.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).slice(0, 3).join(" ")));
    assert.ok(starts.size >= 45, `${set.label}: ${starts.size} arranques`);
    assert.ok(phrases.some(([en]) => en.endsWith("?")), set.label);
    assert.ok(phrases.some(([en]) => !en.endsWith("?")), set.label);
  }
});

test("todas las palabras nuevas tocables tienen significado y pronunciación", () => {
  const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, "");
  for (const [en] of PHRASES.slice(250)) {
    for (const token of en.split(/\s+/)) {
      const key = strip(token).toLowerCase();
      assert.ok(DICT[key]?.[0]?.trim(), `Falta significado: ${key}`);
      assert.ok(DICT[key]?.[1]?.trim(), `Falta pronunciación: ${key}`);
    }
  }
});

test("el diccionario conserva los sentidos usados en las entrevistas de programación", () => {
  const senses: [string, RegExp][] = [
    ["function", /función/], ["sorted", /ordenad/],
    ["checks", /comprueba.*comprobaciones/], ["loop", /bucle/],
    ["building", /construyendo.*creando/], ["order", /\borden\b/],
    ["handle", /gestionar/], ["record", /registrar/], ["scan", /recorrido/],
    ["check", /comprobación/], ["count", /recuento/], ["test", /probar/],
    ["run", /ejecutar/], ["work", /trabajo/], ["used", /usad/],
    ["needs", /necesidades/], ["shared", /compartido/],
    ["background", /segundo plano/], ["load", /carga\b/],
    ["request", /solicitud/], ["reviews", /revisiones/], ["shows", /muestra/],
    ["cause", /causar/], ["group", /agrupar/], ["scope", /ámbito/],
    ["fresh", /actualizado/], ["point", /señalar/], ["separate", /separar/],
    ["media", /medios de CSS/], ["edge", /caso límite/],
    ["meant", /significaba/], ["room", /espacio/],
    // Ya son correctos: no confundir devolver un resultado ni un formulario.
    ["return", /devolver/], ["form", /formulario/],
  ];
  const words = new Set(PHRASES.slice(250).flatMap(([en]) =>
    en.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []));
  const missing: string[] = [];
  for (const [key, sense] of senses) {
    assert.ok(words.has(key), `La regresión debe cubrir vocabulario real: ${key}`);
    if (!sense.test(DICT[key][0])) missing.push(`${key}: ${DICT[key][0]}`);
  }
  assert.deepEqual(missing, [], "Faltan sentidos del contexto de entrevistas");
});

test("las 250 frases nuevas puntúan 100 con transcripción correcta", () => {
  for (const [en] of PHRASES.slice(250)) {
    const transcript = en.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim();
    assert.equal(evaluate(en, transcript).score, 100, en);
  }
});

test("las siglas técnicas aceptan letras separadas en una transcripción", () => {
  const variants: [RegExp, string][] = [
    [/\bAPI\b/g, "A P I"], [/\bAI\b/g, "A I"],
    [/\bHTTP\b/g, "H T T P"], [/\bHTML\b/g, "H T M L"],
    [/\bCSS\b/g, "C S S"], [/\bSQL\b/g, "S Q L"],
    [/\bSQL\b/g, "sequel"], [/\bPostgreSQL\b/g, "Postgre S Q L"],
  ];
  for (const [pattern, spoken] of variants) {
    const phrases = PHRASES.slice(250).filter(([en]) => new RegExp(pattern.source).test(en));
    assert.ok(phrases.length > 0, pattern.source);
    for (const [en] of phrases) {
      assert.equal(evaluate(en, en.replace(pattern, spoken)).score, 100, `${en} → ${spoken}`);
    }
  }
});

test("la corrección de siglas no perdona letras o palabras diferentes", () => {
  assert.ok(evaluate("An API", "An A P O").score < 70);
  assert.ok(evaluate("I see a pie.", "I see API.").score < 100);
  assert.ok(evaluate("SQL", "S Q").score < 100);
});

test("una sesión nueva comienza en entrevistas sin alterar la exigencia", () => {
  const fresh = state.loadState();
  assert.equal(fresh.settings.category, "set:set6");
  assert.equal(fresh.settings.threshold, 70);
  assert.equal(fresh.settings.hitsNeeded, 2);
  state.startSession(fresh);
  assert.ok(fresh.current! >= 250 && fresh.current! < 300);
  assert.equal(new Set([fresh.current, ...fresh.queue]).size, 50);
});

test("migración única a tanda 6 sin borrar historial ni preferencias", () => {
  const saved = previousState();
  const loaded = state.loadState();
  assert.equal(loaded.settings.category, "set:set6");
  assert.equal(loaded.settings.startedOnInterviews, true);
  assert.equal(loaded.phrasesVersion, saved.phrasesVersion);
  assert.deepEqual(loaded.mastered, saved.mastered);
  assert.deepEqual(loaded.records, saved.records);
  assert.deepEqual(loaded.rounds, saved.rounds);
  assert.deepEqual(loaded.stats, saved.stats);
  assert.equal(loaded.settings.threshold, 85);
  assert.equal(loaded.settings.autoplay, false);
  assert.equal(loaded.settings.hideEs, true);
  state.startSession(loaded);
  assert.ok(loaded.current! >= 250 && loaded.current! < 300);
  assert.ok(loaded.queue.every(i => i >= 250 && i < 300));
});

test("las elecciones posteriores sobreviven a recargas en ambos contextos", () => {
  previousState();
  const loaded = state.loadState();
  for (const choice of ["set:set2", "set:set10", "set:set5"]) {
    state.setCategory(loaded, choice);
    assert.equal(state.saveState(loaded), true);
    assert.equal(state.loadState().settings.category, choice);
  }
});

test("cada tanda permite recorrer 50 índices únicos sin mezclar contextos", () => {
  for (const set of SETS) {
    const current = state.defaultState();
    state.setCategory(current, `set:${set.id}`);
    const ids = [current.current];
    for (let i = 1; i < 50; i++) {
      state.advance(current);
      ids.push(current.current);
    }
    assert.equal(new Set(ids).size, 50, set.label);
    assert.ok(ids.every(i => i !== null && i >= set.start && i < set.end), set.label);
    assert.equal(state.progressOf(current).total, 50);
  }
});
