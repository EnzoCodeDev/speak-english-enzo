# 🎙️ Speak English Enzo

App para practicar en voz alta las **150 frases más usadas para conversar en VRChat**,
agrupadas en tres tandas de 50 y con reconocimiento de voz real. No pasas a la siguiente
frase hasta que la pronuncias bien, y todo el progreso se guarda en el navegador.

Hecha con **Next.js 16** (App Router, export estático), **React 19**, **TypeScript** y **Tailwind CSS 4**.

## Empezar

```bash
npm install
npm run dev        # http://localhost:8082
```

Úsala en **Chrome o Edge**: Firefox y Safari no tienen la Web Speech API de reconocimiento.
El micrófono solo funciona en `localhost` o por `https`.

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 8082 |
| `npm run build` | Export estático en `out/` |
| `npm run start` | Sirve `out/` en el puerto 8082 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run validate` | Comprueba las frases (duplicados, vocabulario, diccionario) |

### Por qué el puerto es fijo

El progreso vive en `localStorage`, y ese almacén va **por origen**: `localhost:8082` y
`localhost:8083` son dos progresos distintos. Para llevarte el progreso a otro sitio usa
**Ajustes → Exportar** y luego **Importar** allí.

La clave sigue siendo `speakenzo.v2`, la misma que la versión anterior, así que el progreso
guardado en el mismo origen se conserva con la nueva interfaz.

## Cómo funciona la práctica

1. Aparece una frase en inglés con su traducción (se lee sola si tienes activada la lectura automática).
2. **Escuchar** (`L`) la reproduce con voz nativa; **Lento** la repite despacio.
3. Pulsa el micrófono (`Espacio`) y repítela.
4. La app puntúa de 0 a 100 % y colorea cada palabra: verde bien, amarillo regular, rojo mal.
5. **Siguiente** se desbloquea al superar el umbral (80 % por defecto) **dos veces seguidas**.
   Si fallas, el contador vuelve a cero.
6. Una frase dominada no vuelve a salir hasta completar el ciclo. Terminado el ciclo, empieza
   la ronda siguiente con todo barajado.

### Qué practicar

Arriba están las tres **tandas**; en Ajustes también puedes elegir una **categoría**
(preguntas, respuestas, exclamaciones, sentimientos, comprensión, cortesía, micro y voz, planes).
Solo hay una selección activa y cada una lleva **su propio ciclo de rondas**.

### Diccionario

Toca cualquier palabra (de la frase o del resultado coloreado) para ver su significado, cómo
se pronuncia escrito para hispanohablantes (`avatar` → `Á-va-tar`) y oírla.

### Atajos

| Tecla | Acción |
|---|---|
| `Espacio` | Empezar / parar el micrófono |
| `L` | Escuchar la frase |
| `Enter` | Siguiente (si está desbloqueada) |
| `Esc` | Cerrar el recuadro de la palabra o el panel |

## Cómo puntúa

El texto reconocido y la frase objetivo se normalizan (contracciones, puntuación, números)
y se comparan con alineación palabra a palabra más distancia de edición por caracteres. Una
palabra solo cuenta entera si es exacta, las parecidas reciben crédito mínimo y hablar de más
penaliza. Se evalúan las 5 alternativas del reconocedor y se queda la mejor.

## Por qué 150 frases

Son las que más se repiten al hablar en VRChat, sin saludos ni despedidas. Todas están escritas
con solo **200 palabras** (`src/data/palabras-conversacion.ts`). `npm run validate` falla si
alguna frase usa una palabra fuera de la lista o si falta en el diccionario.

## Estructura

```
src/
  app/                 layout, página, estilos globales e icono
  components/          SpeakApp (pantalla principal), paneles, popover, UI
  data/
    phrases.ts         las 150 frases [inglés, español, categoría] en tandas de 50
    dictionary.ts      significado y pronunciación de cada palabra
    palabras-conversacion.ts  las 200 palabras permitidas
  lib/
    scoring.ts         normalización, alineación y puntuación
    state.ts           progreso, migraciones y cola sin repeticiones
    speech.ts          Web Speech API (reconocimiento y síntesis)
scripts/validar-frases.ts
```

> El orden de `phrases.ts` importa: el progreso guarda cada frase por su posición.

## Despliegue

`Dockerfile` compila el export estático con Node y lo sirve con un Caddy mínimo sin root
(`Caddyfile.static`). `compose.yaml` y `deploy/` son la configuración del VPS
(**https://speak-enzo.enzocode.dev**).

```bash
docker compose up -d --build
```
