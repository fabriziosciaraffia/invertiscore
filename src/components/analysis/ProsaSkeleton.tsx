"use client";

/**
 * ProsaSkeleton — placeholder de carga de la prosa IA.
 *
 * Componente ÚNICO compartido por las superficies de resultados con slot de prosa
 * inline (STR · Comparativa). No se duplica por superficie. El copy "Franco está
 * completando el análisis…" permanece visible junto al shimmer: animación + texto
 * se complementan (decisión Fabrizio). El dot Signal Red pulsante es el uso de
 * loading activo del sistema (Patrón 6 · única excepción donde rojo no es
 * "negativo").
 *
 * BloqueEsperaInforme (Goal E) — la Zona 2 del estado de carga LTR (contrato:
 * mockup-resultados-dos-zonas.html). UN solo bloque de espera: los mensajes
 * progresivos honestos (ex-ProsaGenerando, Goal C/D) + SILUETAS puras de la
 * pirámide y la zona — cero texto semi-legible, cero afordancia. Temporizador
 * ciego (patrón LoadingEditorial): los triggers aproximan el ritmo real de las
 * etapas, no lo miden. Con `estatico` (error de prosa) no hay mensajes ni
 * animación: el error lo comunica el hero (Goal C); acá solo queda la silueta
 * quieta.
 */

import { useEffect, useState } from "react";

export function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-3 rounded animate-pulse"
      style={{ width, background: "color-mix(in srgb, var(--franco-text) 6%, transparent)" }}
    />
  );
}

export function ProsaSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] flex items-center gap-2 m-0 mb-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal-red animate-pulse shrink-0" aria-hidden />
        Franco está completando el análisis…
      </p>
      <SkeletonLine width="70%" />
      <SkeletonLine width="94%" />
      <SkeletonLine width="85%" />
      <div className="pt-2" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="76%" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ProgresoGeneracion (Goal E.2) — el slot de prosa del hero mientras se genera.
// Contrato: mockup-hero-skeleton-didactico.html. Tres piezas:
//   · Stepper de etapas (gramática Patrón 6: hecha = dot Ink 400 sólido ·
//     activa = dot Signal Red pulsante · pendiente = dot hueco). En móvil solo
//     el label de la etapa activa es visible.
//   · Barra segmentada CONSERVADORA: los segmentos hechos quedan en Ink; el
//     activo lleva un barrido que oscila y NUNCA llena — el 100% no existe en
//     pantalla, lo produce la prosa real reemplazando este componente. Sin
//     countdown, sin porcentaje.
//   · Línea de tiempo honesta, calibrada a prod (P50 126s post-Goal-D, n=5):
//     "suele tomar alrededor de dos minutos" — se ajusta hacia abajo si la
//     generación se optimiza, nunca al revés (decisión Fabrizio, STOP E.2).
// El avance es por temporizador ciego conservador (mismos triggers que los
// mensajes de la Zona 2). Parametrizado para heredarse en STR/comparativa
// (Goal F): etapas, copy y estado estático son props.
// ─────────────────────────────────────────────────────────────────────────

export interface EtapaProgreso {
  /** Label mono uppercase del stepper. */
  label: string;
  /** Desde cuántos ms post-mount esta etapa pasa a activa. La primera va en 0. */
  desdeMs: number;
}

/** Etapas LTR (default). La 4ª voz de la Zona 2 ("puliendo") es sub-estado de
 *  "Redactando" — no agrega columna al stepper (contrato E.2). */
export const ETAPAS_GENERACION_LTR: EtapaProgreso[] = [
  { label: "Revisando los números", desdeMs: 0 },
  { label: "Contrastando la zona", desdeMs: 10000 },
  { label: "Redactando", desdeMs: 30000 },
];

export const COPY_TIEMPO_LTR =
  "Franco está escribiendo este análisis — suele tomar alrededor de dos minutos.";

export function ProgresoGeneracion({
  etapas = ETAPAS_GENERACION_LTR,
  copyTiempo = COPY_TIEMPO_LTR,
  estatico = false,
}: {
  etapas?: EtapaProgreso[];
  copyTiempo?: string;
  /** Sin animaciones ni avance (p. ej. herederos con estado de error propio). */
  estatico?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (estatico) return;
    const timers = etapas
      .slice(1)
      .map((e, i) => setTimeout(() => setIdx(i + 1), e.desdeMs));
    return () => timers.forEach(clearTimeout);
  }, [estatico, etapas]);

  return (
    <div className="max-w-[65ch]">
      {/* Stepper */}
      <div className="flex items-center mb-2.5">
        {etapas.map((e, i) => {
          const estado = i < idx ? "hecha" : i === idx ? "activa" : "pendiente";
          return (
            <div key={e.label} className="contents">
              {i > 0 && (
                <div
                  className="flex-1 h-px mx-2"
                  style={{ minWidth: 10, background: "var(--franco-border-strong)" }}
                  aria-hidden
                />
              )}
              <div className="flex items-center gap-[7px] shrink-0">
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={
                    estado === "activa"
                      ? { background: "var(--signal-red)", animation: estatico ? undefined : "progDotPulse 1.4s ease-in-out infinite" }
                      : estado === "hecha"
                        ? { background: "var(--ink-400, #B4B2A9)" }
                        : { background: "transparent", border: "1px solid var(--franco-border-strong)" }
                  }
                  aria-hidden
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.06em] whitespace-nowrap ${
                    estado === "activa" ? "inline text-[var(--franco-text)]" : "hidden md:inline"
                  }`}
                  style={
                    estado === "hecha"
                      ? { color: "var(--franco-text-muted)" }
                      : estado === "pendiente"
                        ? { color: "var(--franco-text-muted)", opacity: 0.55 }
                        : undefined
                  }
                >
                  {e.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra segmentada conservadora — el segmento activo nunca llena */}
      <div className="flex gap-1 mb-2.5" style={{ height: 4 }} aria-hidden>
        {etapas.map((e, i) => (
          <div
            key={e.label}
            className="flex-1 rounded-[2px] overflow-hidden"
            style={{
              background:
                i < idx
                  ? "color-mix(in srgb, var(--franco-text) 22%, transparent)"
                  : "color-mix(in srgb, var(--franco-text) 6%, transparent)",
            }}
          >
            {i === idx && (
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: "62%",
                  background:
                    "linear-gradient(90deg, color-mix(in srgb, var(--signal-red) 55%, transparent), color-mix(in srgb, var(--signal-red) 20%, transparent))",
                  animation: estatico ? undefined : "progAvanza 2.2s ease-in-out infinite",
                }}
              />
            )}
          </div>
        ))}
      </div>

      <p className="font-body text-[12.5px] text-[var(--franco-text-muted)] m-0 mb-3">{copyTiempo}</p>

      {/* Silueta de la prosa — barras puras */}
      <div className="space-y-2">
        <SkeletonLine width="70%" />
        <SkeletonLine width="94%" />
        <SkeletonLine width="85%" />
        <SkeletonLine width="52%" />
      </div>

      <style>{`
        @keyframes progDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.55; }
        }
        @keyframes progAvanza {
          0%, 100% { transform: translateX(-12%); }
          50% { transform: translateX(10%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="progDotPulse"], [style*="progAvanza"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// Mensajes honestos: describen las etapas reales del pipeline (lectura de datos,
// contraste con la zona, redacción, guards de calidad) en voz Franco — tuteo
// neutro, sin prometer tiempos, sin exponer maquinaria interna. El último cubre
// la cola larga y queda fijo.
const MENSAJES_GENERANDO = [
  "Franco está revisando los números de este análisis…",
  "Contrastando precio y arriendo contra la zona…",
  "Redactando el veredicto y las palancas de negociación…",
  "Puliendo la redacción final — ya casi está…",
];
const MENSAJE_TRIGGERS_MS = [0, 10000, 30000, 75000];

/** Barra de silueta: proporción sin contenido. `animada=false` = error estático. */
function Barra({ w, h = 9, animada, className = "" }: { w: string; h?: number; animada: boolean; className?: string }) {
  return (
    <div
      className={`rounded ${animada ? "animate-pulse" : ""} ${className}`}
      style={{ width: w, height: h, background: "color-mix(in srgb, var(--franco-text) 6%, transparent)" }}
    />
  );
}

/** Silueta de una card de la pirámide (eyebrow + título + KPI + cuerpo). */
function SiluetaCard({ nivel, animada }: { nivel: 1 | 2 | 3; animada: boolean }) {
  const pad = nivel === 1 ? "p-7" : nivel === 2 ? "p-6" : "p-4";
  const bg = nivel === 3 ? "var(--franco-sunken, rgba(26,26,26,0.55))" : "var(--franco-card)";
  return (
    <div className={`rounded-2xl ${pad} space-y-2.5`} style={{ background: bg, border: "0.5px solid var(--franco-border)" }}>
      <Barra w="34%" h={8} animada={animada} />
      <Barra w="62%" h={nivel === 3 ? 12 : 15} animada={animada} />
      <Barra w="44%" h={nivel === 3 ? 18 : 26} animada={animada} />
      {nivel !== 3 && <Barra w="92%" animada={animada} />}
      {nivel === 1 && <Barra w="78%" animada={animada} />}
    </div>
  );
}

export function BloqueEsperaInforme({ estatico = false }: { estatico?: boolean }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (estatico) return;
    const timers = MENSAJE_TRIGGERS_MS.slice(1).map((ms, i) => setTimeout(() => setIdx(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [estatico]);

  return (
    <div
      className="rounded-[16px] p-5 md:p-6"
      style={{ background: "var(--franco-card)", border: "0.5px solid var(--franco-border)" }}
    >
      {!estatico && (
        <>
          <p
            key={idx}
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] flex items-center gap-2 m-0"
            style={{ animation: "bloqueMsgIn 420ms ease-out" }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-signal-red shrink-0"
              style={{ animation: "bloqueDotPulse 1.4s ease-in-out infinite" }}
              aria-hidden
            />
            {MENSAJES_GENERANDO[idx]}
          </p>
          <p className="font-body text-[12.5px] text-[var(--franco-text-muted)] mt-1 mb-4 ml-[14px]">
            El análisis completo por hallazgo se habilita al terminar.
          </p>
        </>
      )}
      {/* Siluetas — misma proporción que la pirámide real: corona ancha, 2 de
          segundo nivel, 3 chips hundidos, fila de zona. Mobile: stack. */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${estatico ? "mt-1" : ""}`}>
        <div className="md:col-span-2">
          <SiluetaCard nivel={1} animada={!estatico} />
        </div>
        <SiluetaCard nivel={2} animada={!estatico} />
        <SiluetaCard nivel={2} animada={!estatico} />
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SiluetaCard nivel={3} animada={!estatico} />
          <SiluetaCard nivel={3} animada={!estatico} />
          <SiluetaCard nivel={3} animada={!estatico} />
        </div>
        <div
          className="md:col-span-2 grid items-center gap-4 rounded-2xl px-5 py-[18px]"
          style={{
            gridTemplateColumns: "44px 1fr auto",
            background: "color-mix(in srgb, var(--franco-text) 2.5%, transparent)",
            border: "0.5px solid var(--franco-border)",
          }}
        >
          <div
            className={`w-11 h-11 rounded-full ${estatico ? "" : "animate-pulse"}`}
            style={{ background: "color-mix(in srgb, var(--franco-text) 6%, transparent)" }}
          />
          <div className="min-w-0 space-y-2">
            <Barra w="30%" h={8} animada={!estatico} />
            <Barra w="85%" animada={!estatico} />
          </div>
          <Barra w="72px" h={20} animada={!estatico} />
        </div>
      </div>
      <style>{`
        @keyframes bloqueMsgIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bloqueDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="bloqueMsgIn"], [style*="bloqueDotPulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
