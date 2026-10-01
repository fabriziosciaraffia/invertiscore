// ─────────────────────────────────────────────────────────────────────────────
// «Recién dentro» (01-oct-2026): después del código en el banner del informe, la página se refresca
// (router.refresh) para que el header y el ticket dejen de tratar a la persona como anónima. Pero el
// refresco cambia las props del informe —ya no es «dueño anónimo»— y el banner con «Estás dentro»
// (y su «¿Cuándo piensas comprar?») desaparecería. Esta marca de sessionStorage, por análisis, le dice
// al informe que quien lo mira acaba de entrar: el banner sigue montado en «Estás dentro» y el ticket
// del pack sigue, ya sin pedir el correo (va el de la sesión).
//
// Vive en la pestaña (sessionStorage) y vence a la media hora: no es estado de la cuenta, es el
// momento de entrar. Funciones puras sobre un almacén inyectable (el tier las prueba con un shim);
// el hook lee con useSyncExternalStore para que el primer render tras el refresco ya la vea.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";

export const CLAVE_RECIEN_DENTRO = "franco_recien_dentro";
export const VIGENCIA_RECIEN_DENTRO_MS = 30 * 60 * 1000;
const EVENTO = "franco:recien-dentro";

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;
interface Marca { analysisId: string; correo: string; t: number }

export function marcarRecienDentro(almacen: Almacen | null, analysisId: string, correo: string, ahora: number = Date.now()): void {
  if (!almacen || !analysisId) return;
  try {
    almacen.setItem(CLAVE_RECIEN_DENTRO, JSON.stringify({ analysisId, correo, t: ahora } satisfies Marca));
  } catch {
    /* sin storage (modo privado): el banner vuelve a lo que diga el servidor */
  }
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* fuera del navegador */
  }
}

/** El correo con que entró, si la marca es de ESTE análisis y está vigente; si no, null. */
export function leerRecienDentro(almacen: Almacen | null, analysisId: string, ahora: number = Date.now()): string | null {
  if (!almacen || !analysisId) return null;
  try {
    const raw = almacen.getItem(CLAVE_RECIEN_DENTRO);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<Marca>;
    if (m.analysisId !== analysisId || typeof m.correo !== "string" || typeof m.t !== "number") return null;
    if (ahora - m.t > VIGENCIA_RECIEN_DENTRO_MS || ahora < m.t) return null;
    return m.correo;
  } catch {
    return null;
  }
}

function suscribir(cambio: () => void): () => void {
  window.addEventListener(EVENTO, cambio);
  window.addEventListener("storage", cambio);
  return () => {
    window.removeEventListener(EVENTO, cambio);
    window.removeEventListener("storage", cambio);
  };
}

/** sessionStorage, o null si el navegador no lo deja (modo privado) o fuera del navegador. */
export function almacenSesion(): Almacen | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** El correo de quien acaba de entrar en este informe (null en el servidor y en la hidratación). */
export function useRecienDentro(analysisId: string | null | undefined): string | null {
  return useSyncExternalStore(
    suscribir,
    () => leerRecienDentro(almacenSesion(), analysisId ?? ""),
    () => null,
  );
}
