// ─────────────────────────────────────────────────────────────────────────────
// cuandoLaPaginaEsteQuieta — correr algo DESPUÉS de la primera pintura.
//
// Rendimiento de la landing (28-sep-2026): lo que no hace falta para el titular —la card real de
// la sección 3, PostHog y su grabación, Sentry, el Meta Pixel— se carga cuando la página terminó de
// cargar y el hilo principal quedó libre: tras el evento `load`, en el primer rato ocioso
// (`requestIdleCallback`), con un tope para que no se posponga para siempre en un hilo ocupado.
// Sin `requestIdleCallback` (Safari), un `setTimeout` corto después de `load`.
//
// Pura salvo por el documento y la ventana, que se pueden inyectar para probarla.
// ─────────────────────────────────────────────────────────────────────────────

export interface OpcionesQuieta {
  /** Tope de espera tras `load` (ms): pasado, corre aunque el hilo siga ocupado. */
  tope?: number;
  /** Espera mínima tras `load` sin `requestIdleCallback` (ms). */
  sinIdle?: number;
  doc?: Pick<Document, "readyState">;
  win?: Pick<Window, "addEventListener" | "removeEventListener" | "setTimeout" | "clearTimeout"> & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
}

/**
 * Programa `fn` para cuando la página esté quieta. Devuelve la función que lo cancela.
 * En el servidor no hace nada.
 */
export function cuandoLaPaginaEsteQuieta(fn: () => void, opts: OpcionesQuieta = {}): () => void {
  const doc = opts.doc ?? (typeof document !== "undefined" ? document : null);
  const win = opts.win ?? (typeof window !== "undefined" ? (window as unknown as NonNullable<OpcionesQuieta["win"]>) : null);
  if (!doc || !win) return () => {};
  const tope = opts.tope ?? 4000;
  const sinIdle = opts.sinIdle ?? 1200;
  let cancelado = false;
  let idIdle: number | null = null;
  let idTimer: number | null = null;

  const enOcio = () => {
    if (cancelado) return;
    if (typeof win.requestIdleCallback === "function") {
      idIdle = win.requestIdleCallback(() => { if (!cancelado) fn(); }, { timeout: tope });
    } else {
      idTimer = win.setTimeout(() => { if (!cancelado) fn(); }, sinIdle);
    }
  };
  const alCargar = () => { win.removeEventListener("load", alCargar); enOcio(); };

  if (doc.readyState === "complete") enOcio();
  else win.addEventListener("load", alCargar);

  return () => {
    cancelado = true;
    win.removeEventListener("load", alCargar);
    if (idIdle !== null && typeof win.cancelIdleCallback === "function") win.cancelIdleCallback(idIdle);
    if (idTimer !== null) win.clearTimeout(idTimer);
  };
}
