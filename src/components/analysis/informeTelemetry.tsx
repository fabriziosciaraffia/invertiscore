"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Visibilidad del informe (I-3) — el viaje no termina en el wizard.
//
// Dos señales, ambas fire-and-forget:
//   · `informe_seccion_vista`  — hasta dónde LEE el que no compra: ¿el CTA
//     comercial llega a verse, o el abandono ocurre antes? ¿alguien baja a la
//     Advanced Section?
//   · `informe_drawer_abierto` — qué profundiza. Hoy NO existe ningún evento de
//     apertura de drawer en el producto, así que esto no duplica nada.
//
// Mecánica de sección: un sentinel de 1px al inicio de cada bloque, observado
// con IntersectionObserver (threshold 0 — con un sentinel de 1px "entró al
// viewport" es exactamente la pregunta; un threshold de área sobre un elemento
// sin altura no significaría nada). Un disparo por sección por montaje, y el
// observer se desconecta al primer cruce.
//
// Sin batching, decisión consciente: ~10 secciones × las vistas de informe de un
// día es ruido para PostHog, y agrupar agregaría una cola de eventos que puede
// perderse al navegar. Si el volumen algún día molesta, el lugar para cambiarlo
// es este archivo y nada más.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import type { PostHog } from "posthog-js";

declare global {
  interface Window {
    /** Espejo dev de los eventos del informe (mismo patrón que
     *  `__wizard4Events`): en dev PostHog no se inicializa —no hay key en el
     *  env— así que sin esto no habría forma de verificar la instrumentación
     *  "en el cable" durante un paseo real. En producción no existe. */
    __informeEvents?: Array<{ name: string; props?: Record<string, unknown> }>;
  }
}

/** Emisión única del informe: capture + espejo dev. Nunca lanza. */
function trackInforme(
  posthog: PostHog | null | undefined,
  name: string,
  props?: Record<string, unknown>,
): void {
  try {
    posthog?.capture(name, props);
  } catch {
    /* la telemetría jamás rompe la lectura del informe */
  }
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window.__informeEvents ??= []).push({ name, props });
  }
}

/** Secciones instrumentadas. Enum cerrado: cardinalidad acotada. */
export type SeccionInforme =
  | "hero"
  | "piramide"
  | "evidencia"
  | "simulacion"
  | "advanced"
  | "zona"
  | "next_cta"
  | "wallet_cta"
  | "cierre";

export type TipoInforme = "ltr" | "str" | "comparativa";

export function MarcaSeccion({
  seccion,
  tipo,
  accessLevel,
}: {
  seccion: SeccionInforme;
  tipo: TipoInforme;
  accessLevel: string;
}) {
  const posthog = usePostHog();
  const ref = useRef<HTMLDivElement>(null);
  const emitido = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || emitido.current) return;
    if (typeof IntersectionObserver === "undefined") return; // SSR / navegador viejo
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting || emitido.current) continue;
        emitido.current = true;
        io.disconnect();
        trackInforme(posthog, "informe_seccion_vista", { seccion, tipo, accessLevel });
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seccion, tipo, accessLevel, posthog]);

  return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />;
}

/**
 * Emite `informe_drawer_abierto` cuando el drawer pasa de cerrado a abierto.
 * Se le pasa la key activa del estado que YA existe en cada superficie (los tres
 * informes centralizan sus drawers en un único `useState`), así que no hay que
 * tocar ningún punto de apertura.
 */
export function useDrawerAbierto(activeKey: string | number | null, tipo: TipoInforme): void {
  const posthog = usePostHog();
  const previa = useRef<string | number | null>(null);
  useEffect(() => {
    const antes = previa.current;
    previa.current = activeKey;
    if (activeKey == null || antes != null) return;
    trackInforme(posthog, "informe_drawer_abierto", { drawer: String(activeKey), tipo });
  }, [activeKey, tipo, posthog]);
}
