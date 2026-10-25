// ─────────────────────────────────────────────────────────────────────────────
// EL CRONÓMETRO DE UN PEDIDO (25-oct-2026, el alta de /deptos tardaba 5 a 10 s en producción): mide cada paso —también
// los que corren en paralelo— y lo deja en la cabecera `Server-Timing` de la respuesta, así se lee desde el navegador
// (o desde el QA) sin logs. Cada paso: cuándo empezó y cuánto duró, en ms desde que llegó el pedido. Puro.
// ─────────────────────────────────────────────────────────────────────────────

export interface PasoMedido {
  paso: string;
  /** ms desde que llegó el pedido hasta que empezó el paso. */
  desde: number;
  /** ms que duró. */
  dur: number;
}

export interface Cronometro {
  /** Mide una promesa como un paso (empieza ahora, termina cuando se resuelve o falla). */
  medir<T>(paso: string, p: Promise<T> | (() => Promise<T>)): Promise<T>;
  pasos(): PasoMedido[];
  /** ms desde que llegó el pedido. */
  ahora(): number;
  /** `verificar;dur=310;desc="0",regalo;dur=120;desc="330",total;dur=980` (desc = cuándo empezó). */
  serverTiming(): string;
}

const limpio = (s: string) => s.replace(/[^a-z0-9_-]/gi, "-").slice(0, 40);

export function cronometro(reloj: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now())): Cronometro {
  const t0 = reloj();
  const pasos: PasoMedido[] = [];
  const ahora = () => Math.round(reloj() - t0);
  return {
    async medir<T>(paso: string, p: Promise<T> | (() => Promise<T>)): Promise<T> {
      const desde = ahora();
      try {
        return await (typeof p === "function" ? p() : p);
      } finally {
        pasos.push({ paso: limpio(paso), desde, dur: ahora() - desde });
      }
    },
    pasos: () => [...pasos],
    ahora,
    serverTiming() {
      return [...pasos.map((x) => `${x.paso};dur=${x.dur};desc="${x.desde}"`), `total;dur=${ahora()}`].join(", ");
    },
  };
}

/** Un cronómetro que no mide nada (para quien llama sin uno). */
export const SIN_CRONOMETRO: Cronometro = {
  medir: async <T,>(_paso: string, p: Promise<T> | (() => Promise<T>)) => (typeof p === "function" ? p() : p),
  pasos: () => [],
  ahora: () => 0,
  serverTiming: () => "",
};
