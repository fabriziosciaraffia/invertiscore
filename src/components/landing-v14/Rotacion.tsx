"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La rotación de los tres ejemplos, COMPARTIDA (FASE 1.9, 11-sep-2026).
//
// Hasta acá vivía dentro de `Respuesta` (sección 2). Ahora hay dos secciones que
// muestran el MISMO ejemplo al mismo tiempo —la miniatura del hero en la 2 y «La
// recomendación de Franco» en la 3— y un solo estado las mueve: índice, salida,
// entrada escalonada y barra de progreso. Si cada sección rotara por su cuenta,
// el visitante vería el veredicto de Providencia arriba y la recomendación de
// Ñuñoa abajo.
//
// Contrato (seccion2-transiciones.html, modo B): salida junta; a los 900 ms se
// cambia el ejemplo y los bloques entran escalonados; espera 6 s con barra;
// arranca al entrar en pantalla la sección 2 (`arrancar`); se detiene al tocar
// una fila (`elegir`: el toque es una elección, no un reinicio) o al pausar desde
// la sección 3 (`pausar` / `seguir`); `prefers-reduced-motion` deja BUSCAR OTRO
// fijo con las filas vivas y sin botón de pausa (no hay nada que pausar).
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";
import type { EjemploLanding } from "@/lib/landing-vivo";
import { EV } from "./eventos";

export const DUR = 900;
export const HOLD = 6000;

export type Progreso = "quieto" | "corriendo" | "reinicio";

export interface Rotacion {
  ejemplos: EjemploLanding[];
  /** Índice del ejemplo en pantalla. */
  i: number;
  /** true durante la salida (los bloques se desvanecen juntos). */
  out: boolean;
  /** true durante la entrada escalonada del ejemplo nuevo. */
  entrando: boolean;
  progreso: Progreso;
  /** La rotación se detuvo por una acción del visitante (fila o pausa). */
  pausado: boolean;
  /** Hay rotación posible: más de un ejemplo y sin reduced-motion. */
  rota: boolean;
  /** Lo llama la sección 2 la primera vez que entra en pantalla. */
  arrancar: () => void;
  /** Elegir un ejemplo a mano detiene la rotación. */
  elegir: (j: number, origen: "fila" | "reco") => void;
  pausar: () => void;
  seguir: () => void;
  /** Retardo de entrada del bloque k (0/140/280/420 ms) o 0 en la salida. */
  delay: (k: number) => { transitionDelay: string };
}

const Ctx = createContext<Rotacion | null>(null);

export function useRotacion(): Rotacion {
  const r = useContext(Ctx);
  if (!r) throw new Error("useRotacion fuera de <RotacionEjemplos>");
  return r;
}

export function RotacionEjemplos({ ejemplos, children }: { ejemplos: EjemploLanding[]; children: ReactNode }) {
  const posthog = usePostHog();
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [progreso, setProgreso] = useState<Progreso>("quieto");
  const [pausado, setPausado] = useState(false);
  const [rota, setRota] = useState(ejemplos.length > 1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const swap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detenido = useRef(false);
  const arrancado = useRef(false);
  // el índice también en un ref: los callbacks del intervalo y de las filas lo
  // leen sin cerrar sobre un `i` viejo y sin meter efectos en un updater
  const iRef = useRef(0);
  const n = ejemplos.length;

  const mostrar = useCallback((j: number) => {
    if (swap.current) clearTimeout(swap.current);
    setOut(true);
    setEntrando(false);
    setProgreso("reinicio");
    swap.current = setTimeout(() => {
      iRef.current = j;
      setI(j);
      setOut(false);
      setEntrando(true);
      // dos frames: que el ancho 0 se pinte antes de la transición a 100%
      requestAnimationFrame(() => requestAnimationFrame(() => setProgreso(detenido.current ? "quieto" : "corriendo")));
    }, DUR);
  }, []);

  const loop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => mostrar((iRef.current + 1) % n), HOLD + DUR * 2);
  }, [mostrar, n]);

  const parar = useCallback(() => {
    detenido.current = true;
    setPausado(true);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  // Con reduced-motion no rota (BUSCAR OTRO fijo, las filas siguen vivas).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setRota(false);
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (swap.current) clearTimeout(swap.current);
    };
  }, []);

  const arrancar = useCallback(() => {
    if (!rota || arrancado.current || detenido.current) return;
    arrancado.current = true;
    setProgreso("corriendo");
    loop();
  }, [rota, loop]);

  const elegir = useCallback(
    (j: number, origen: "fila" | "reco") => {
      parar();
      posthog?.capture(EV.ejemplo, { ejemplo: ejemplos[j]?.etiqueta, origen });
      if (j !== iRef.current) mostrar(j);
      else setProgreso("quieto");
    },
    [parar, posthog, ejemplos, mostrar],
  );

  const pausar = useCallback(() => {
    parar();
    setProgreso("quieto");
    posthog?.capture(EV.rotacion, { accion: "pausar", ejemplo: ejemplos[i]?.etiqueta });
  }, [parar, posthog, ejemplos, i]);

  const seguir = useCallback(() => {
    if (!rota) return;
    detenido.current = false;
    setPausado(false);
    arrancado.current = true;
    posthog?.capture(EV.rotacion, { accion: "seguir", ejemplo: ejemplos[i]?.etiqueta });
    // la barra vuelve a cero y arranca; el intervalo cuenta desde ahora
    setProgreso("reinicio");
    requestAnimationFrame(() => requestAnimationFrame(() => setProgreso("corriendo")));
    loop();
  }, [rota, posthog, ejemplos, i, loop]);

  const delay = useCallback(
    (k: number) => ({ transitionDelay: out ? "0ms" : entrando ? `${k * 140}ms` : "0ms" }),
    [out, entrando],
  );

  const valor = useMemo<Rotacion>(
    () => ({ ejemplos, i, out, entrando, progreso, pausado, rota, arrancar, elegir, pausar, seguir, delay }),
    [ejemplos, i, out, entrando, progreso, pausado, rota, arrancar, elegir, pausar, seguir, delay],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** La barra de progreso de la espera, compartida por las dos secciones: corre 6 s
 *  en linear, queda llena cuando el visitante detuvo la rotación y vacía cuando
 *  no hay rotación. */
export function BarraProgreso({ className = "" }: { className?: string }) {
  const { progreso, pausado } = useRotacion();
  return (
    <div className={`lv-prog ${className}`.trim()} aria-hidden="true">
      <i
        style={
          progreso === "corriendo"
            ? { transition: `width ${HOLD}ms linear`, width: "100%" }
            : { transition: "none", width: progreso === "quieto" && pausado ? "100%" : "0" }
        }
      />
    </div>
  );
}
