/* Validador de phrases.js. Comprueba que ninguna frase se repita ni se parezca
   demasiado a otra, que cada tanda tenga variedad real de arranques y que
   todas usen solo las 200 palabras de palabras-conversacion.ts.
   Uso: npm run validate   (Node >= 22.18 ejecuta TypeScript directamente). */
import { PHRASES as P, SETS } from '../src/data/phrases.ts';
import { DICT } from '../src/data/dictionary.ts';
import { PALABRAS_CONVERSACION as LISTA } from '../src/data/palabras-conversacion.ts';
const UMBRAL = 0.75;          // similitud a partir de la cual dos frases "son la misma"
// Frases ya practicadas que no se pueden mover. Hoy ninguna: la lista de 200
// se estrenó con el progreso a cero (PHRASES_VERSION 3 en app.js).
const INTOCABLES = 0;
const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const lev = (a: string, b: string): number => { const m = a.length, n = b.length; let pr = [...Array(n + 1).keys()];
  for (let i = 1; i <= m; i++) { const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(pr[j] + 1, c[j - 1] + 1, pr[j - 1] + (a[i-1] === b[j-1] ? 0 : 1));
    pr = c; } return pr[n]; };
let fallos = 0;

console.log('frases:', P.length, '| tandas:', SETS.length);

// 1) duplicados exactos
const seen = new Map(), dups = [];
P.forEach((p, i) => { const k = norm(p[0]); if (seen.has(k)) dups.push([seen.get(k) + 1, i + 1, p[0]]); else seen.set(k, i); });
console.log('\n1) duplicados exactos:', dups.length);
dups.forEach(d => { console.log('   #' + d[0], '= #' + d[1], d[2]); fallos++; });

// 2) casi-duplicados. La similitud por caracteres sola marca pares legítimos
//    ("I have good news." / "I have bad news."), así que se exige además que
//    compartan casi todas las palabras (Jaccard), o que sean casi idénticas.
const K = P.map(p => norm(p[0]));
const W = K.map(k => new Set(k.split(' ')));
const jaccard = (a, b) => { let inter = 0; a.forEach(w => b.has(w) && inter++);
  return inter / (a.size + b.size - inter); };
const casi = [], heredados = [];
for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
  const a = K[i], b = K[j];
  if (Math.abs(a.length - b.length) / Math.max(a.length, b.length) > 1 - UMBRAL) continue;
  const sim = 1 - lev(a, b) / Math.max(a.length, b.length);
  if (sim < UMBRAL) continue;
  if (jaccard(W[i], W[j]) < 0.8 && sim < 0.90) continue;
  const fila = ['#' + (i + 1) + ' "' + P[i][0] + '"  ~  #' + (j + 1) + ' "' + P[j][0] + '"  sim ' + sim.toFixed(2)];
  // Solo son arreglables las frases que el usuario aún no ha practicado.
  (j + 1 > INTOCABLES ? casi : heredados).push(fila[0]);
}
console.log('\n2) casi-duplicados arreglables (frase nueva implicada):', casi.length);
casi.forEach(c => { console.log('   ' + c); fallos++; });
if (INTOCABLES) { console.log('   heredados en las frases 1-' + INTOCABLES + ' (no se tocan):', heredados.length);
  heredados.forEach(c => console.log('     ' + c)); }

// 3) variedad de arranques por tanda
// Listón: 89 arranques distintos por cada 100 frases, proporcional al tamaño de la tanda.
console.log('\n3) arranques distintos por tanda (listón: >= 89 por cada 100):');
const flojas = [];
SETS.forEach((s, idx) => {
  const c = new Set(P.slice(s.start, s.end).map(p => norm(p[0]).split(' ').slice(0, 3).join(' ')));
  if (c.size < Math.ceil((s.end - s.start) * 0.89)) { flojas.push(idx + 1); fallos++; }
  process.stdout.write('   t' + String(idx + 1).padStart(2) + ':' + String(c.size).padStart(4) + (idx % 6 === 5 ? '\n' : ''));
});
console.log('\n   tandas por debajo del listón:', flojas.length ? flojas.join(', ') : 'ninguna');

// 4) integridad
const rangos = SETS.every((s, i) => s.start === (i ? SETS[i - 1].end : 0) && s.end > s.start) && SETS[SETS.length - 1].end === P.length;
const cats = new Set(['preguntas', 'respuestas', 'exclamaciones', 'sentimientos', 'comprension',
  'cortesia', 'tecnologia', 'planes', 'dia a dia']);
const nuevas = [...new Set(P.map(p => p[2]))].filter(c => !cats.has(c));
const campos = P.every(p => Array.isArray(p) && p.length === 3 && p.every(x => typeof x === 'string' && x.trim()));
console.log('\n4) integridad:');
console.log('   tandas sin huecos        :', rangos ? 'SI' : 'NO');                       if (!rangos)   fallos++;
console.log('   categorias conocidas     :', nuevas.length ? ('NO -> ' + nuevas) : 'SI'); if (nuevas.length) fallos++;
console.log('   3 campos no vacios       :', campos ? 'SI' : 'NO');                       if (!campos)   fallos++;

// 5) cobertura del diccionario: una palabra sin entrada no se puede tocar
const palabras = s => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
const sinEntrada = new Set();
P.forEach(p => palabras(p[0]).forEach(w => { if (!DICT[w]) sinEntrada.add(w); }));
console.log('\n5) palabras sin entrada en dictionary.ts:', sinEntrada.size || 'ninguna');
if (sinEntrada.size) { console.log('   ' + [...sinEntrada].sort().join(' ')); fallos++; }

// 6) vocabulario: solo las 200 palabras de conversación
const VOCAB = new Set(LISTA);
const fueraLista = [];
P.slice(INTOCABLES).forEach((p, i) => { const f = palabras(p[0]).filter(w => !VOCAB.has(w));
  if (f.length) fueraLista.push('#' + (INTOCABLES + i + 1) + ' "' + p[0] + '" <- ' + f.join(', ')); });
const usadas = new Set(P.slice(INTOCABLES).flatMap(p => palabras(p[0])));
const sinUso = LISTA.filter(w => !usadas.has(w));
console.log('\n6) vocabulario de conversación:');
console.log('   palabras en la lista     :', VOCAB.size, VOCAB.size === 200 && LISTA.length === 200 ? '' : '(deben ser 200 distintas)');
if (VOCAB.size !== 200 || LISTA.length !== 200) fallos++;
console.log('   frases con palabras fuera:', fueraLista.length || 'ninguna');
fueraLista.forEach(f => { console.log('     ' + f); fallos++; });
console.log('   palabras de la lista sin usar:', sinUso.length ? sinUso.join(' ') : 'ninguna');

console.log('\n' + (fallos ? 'FALLOS: ' + fallos : '*** TODO CORRECTO ***'));
process.exit(fallos ? 1 : 0);
