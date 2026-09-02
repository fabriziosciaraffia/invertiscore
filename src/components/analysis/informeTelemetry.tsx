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

/** Secciones instrumentadas. Enum cerrado: cardinalidad acotada.
 *
 *  Cobertura por superficie (fix FASE 1 rediseño-dictamen, 25-ago-2026): hasta
 *  ese día LTR NO montaba `piramide` ni `zona`, y STR no montaba `hero` — el
 *  agregado global de esas secciones mezclaba superficies con y sin sentinel
 *  (52% "vio advanced sin piramide" = sesiones LTR sin la marca, no lectores
 *  que saltaron). Desde el fix las tres se emiten en LTR y STR con la MISMA
 *  key de evento: la serie no se rompe, se completa — pero para `piramide`/
 *  `zona` en LTR y `hero` en STR el alcance solo es comparable desde el deploy
 *  del fix en adelante. */
export type SeccionInforme =
  | "hero"
  // T2 del rediseño (contrato CONGELADO 02-sep-2026): las dos secciones nuevas de
  // la página LTR. `piramide` sigue midiendo el acordeón (misma serie).
  | "hallazgos"
  | "numeros"
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
 *
 * FASE 1 rediseño-dictamen — serie NUEVA en paralelo: si el caller pasa
 * `resolverHallazgo` y la key abierta corresponde a un hallazgo de la pirámide,
 * se emite ADEMÁS `informe_hallazgo_abierto {n, id_hallazgo, tipo}`. Es el
 * evento que en el layout nuevo (hallazgos acordeón, FASE 4) reemplaza al de
 * drawer; nace ahora para tener línea base de "% expand por hallazgo y por
 * posición" ANTES del rediseño. `informe_drawer_abierto` sigue emitiéndose
 * igual hasta que el drawer muera — dos series paralelas, sin hueco.
 * Drawers que no cuelgan de un hallazgo (zona, tipoHuesped, largoPlazo) no
 * emiten el evento nuevo: el resolver devuelve null.
 *
 * FASE 5 (tablero): `contexto` agrega `veredicto` + `access_level` SOLO al
 * evento de hallazgo — mismo payload que el emisor del acordeón (FASE 4), que
 * es el otro punto vivo de esta serie. Esta ruta sigue alcanzable vía "La
 * posición de Franco" del hero (distanciaVeredicto/sensibilidad) y las
 * flechas prev/next del drawer. `informe_drawer_abierto` no cambia.
 */
export function useDrawerAbierto(
  activeKey: string | number | null,
  tipo: TipoInforme,
  resolverHallazgo?: (key: string | number) => { n: number; id: string } | null,
  contexto?: { veredicto: string; accessLevel: string },
): void {
  const posthog = usePostHog();
  const previa = useRef<string | number | null>(null);
  // Ref y no dep: el resolver llega como closure inline (cambia por render) y
  // meterlo en las deps re-correría el efecto sin aportar — la emisión ya está
  // limitada a la transición cerrado→abierto por `previa`. Mismo trato para
  // `contexto` (objeto literal nuevo en cada render).
  const resolverRef = useRef(resolverHallazgo);
  resolverRef.current = resolverHallazgo;
  const contextoRef = useRef(contexto);
  contextoRef.current = contexto;
  useEffect(() => {
    const antes = previa.current;
    previa.current = activeKey;
    if (activeKey == null || antes != null) return;
    trackInforme(posthog, "informe_drawer_abierto", { drawer: String(activeKey), tipo });
    const hallazgo = resolverRef.current?.(activeKey) ?? null;
    if (hallazgo) {
      const ctx = contextoRef.current;
      trackInforme(posthog, "informe_hallazgo_abierto", {
        n: hallazgo.n,
        id_hallazgo: hallazgo.id,
        tipo,
        ...(ctx ? { veredicto: ctx.veredicto, access_level: ctx.accessLevel } : {}),
      });
    }
  }, [activeKey, tipo, posthog]);
}
