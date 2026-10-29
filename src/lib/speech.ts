/* Web Speech API: tipos mínimos (no vienen en lib.dom) y utilidades. */

export type RecognitionAlternative = { transcript: string };
export type RecognitionResult = { isFinal: boolean; length: number; [i: number]: RecognitionAlternative };
export type RecognitionEvent = { results: { length: number; [i: number]: RecognitionResult } };
export type RecognitionErrorEvent = { error: string };

export interface Recognizer {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognizerCtor = new () => Recognizer;

export function getRecognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/* En el móvil el reconocimiento continuo repite la frase: allí se escucha una
   sola locución por pulsación (ver cleanChunks en scoring.ts). */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return !!n.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(n.userAgent);
}

export function speak(text: string, rate: number, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

export const RECOGNITION_ERRORS: Record<string, string> = {
  "no-speech": "No escuché nada. Prueba otra vez, más cerca del micrófono.",
  "audio-capture": "No encuentro ningún micrófono conectado.",
  "not-allowed": "El navegador bloqueó el micrófono. Dale permiso en el icono del candado de la barra de direcciones.",
  network: "Sin conexión: el reconocimiento de voz necesita internet.",
};
