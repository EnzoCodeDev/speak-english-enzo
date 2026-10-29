"use client";

import dynamic from "next/dynamic";

/* La app vive entera en el navegador (micrófono, voz y localStorage), así que
   se carga solo en el cliente. Mientras tanto se pinta el esqueleto. */
const SpeakApp = dynamic(() => import("./SpeakApp"), {
  ssr: false,
  loading: () => <Skeleton />,
});

export default function ClientApp() {
  return <SpeakApp />;
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-6" aria-busy="true" aria-label="Cargando Speak English Enzo">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-ink-850" />
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-ink-850" />
          <div className="h-3 w-56 rounded bg-ink-900" />
        </div>
      </div>
      <div className="mt-10 h-12 w-80 max-w-full rounded-2xl bg-ink-900" />
      <div className="mt-8 h-[28rem] rounded-[28px] border border-ink-800 bg-ink-900/70" />
    </div>
  );
}
