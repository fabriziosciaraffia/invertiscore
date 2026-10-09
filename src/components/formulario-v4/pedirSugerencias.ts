// ─────────────────────────────────────────────────────────────────────────────
// Los comparables del wizard, con tiempo máximo (09-oct-2026). Con `/api/data/suggestions` colgado (la UF
// esperaba a mindicador.cl sin límite; tier UF-TIEMPO) el chip del mapa decía «Buscando comparables
// cerca…» para siempre: los fetch no tenían tiempo máximo y un error terminaba igual que «sin dato». Ahora
// un pedido que falla o pasa de 10 s rechaza, y el chip lo dice con «Reintentar». Tier CHIP-COMPARABLES.
// ─────────────────────────────────────────────────────────────────────────────

export const TIEMPO_MAX_SUGERENCIAS_MS = 10_000;

export const CHIP_COMPARABLES = {
  buscando: "Buscando comparables cerca…",
  error: "No pudimos cargar los comparables.",
  reintentar: "Reintentar",
} as const;

/** Un GET de JSON que rechaza si falla la red, si responde con error o si pasa `tiempoMaxMs`, aunque el
 *  pedido ignore la señal de corte. */
export function pedirJsonConTiempo(
  url: string,
  o: { tiempoMaxMs?: number; pedir?: typeof fetch } = {},
): Promise<unknown> {
  const tiempoMax = o.tiempoMaxMs ?? TIEMPO_MAX_SUGERENCIAS_MS;
  const pedir = o.pedir ?? fetch;
  const control = new AbortController();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      control.abort();
      reject(new Error(`los comparables no respondieron en ${tiempoMax} ms`));
    }, tiempoMax);
    pedir(url, { signal: control.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`los comparables respondieron ${r.status}`);
        return r.json();
      })
      .then(
        (j) => { clearTimeout(t); resolve(j); },
        (e) => { clearTimeout(t); reject(e); },
      );
  });
}

export type EstadoChipComparables = "buscando" | "error" | "listo";

/** Nombrar el punto también es buscar; un pedido fallado manda sobre «buscando» (el reintento lo limpia). */
export function estadoChipComparables(s: { cargando: boolean; error: boolean; nombrando: boolean }): EstadoChipComparables {
  if (s.nombrando) return "buscando";
  if (s.error) return "error";
  if (s.cargando) return "buscando";
  return "listo";
}
