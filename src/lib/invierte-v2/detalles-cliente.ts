// ─────────────────────────────────────────────────────────────────────────────
// Los detalles de los deptos del flujo, desde el navegador (entrega 2, 18-nov-2026, aprobado por Fabrizio):
//   · ABRIR: la ruta de la guía en modo Invierte (`invierte: true`). Lo ya preparado vuelve al instante, sin leer la ficha.
//   · PREPARAR EN SEGUNDO PLANO: apenas la persona elige (y al entrar a la base, lo que haya quedado sin preparar), un pedido por
//     depto con `keepalive`, que sigue aunque la pantalla cambie. Sin gastar créditos (charge_mode 'invierte'); la lectura de la
//     ficha al elegir va por el carril de Invierte.
// ─────────────────────────────────────────────────────────────────────────────
export const URL_DETALLES = "/api/lo-que-sigue/guia/analizar";

/** Adónde lleva «Ver detalles» / «Abrir» (19-nov-2026): el informe con `?desde=invierte`, para que sepa de dónde viene (el
 *  servidor decide el resto: detalles-modo.ts). UN solo lugar: lo usan el botón de la base y el resultado. */
export const urlDetallesInvierte = (analysisId: string) => `/analisis/${encodeURIComponent(analysisId)}?desde=invierte`;

export const cuerpoDetalles = (avisoId: string, origen: "elegir" | "abrir") =>
  JSON.stringify({ avisoId, explorar: true, piePct: 20, plazoAnios: 30, invierte: true, origenInvierte: origen });

/** Cuánto espera «Abrir» a que termine la preparación en segundo plano que ya está en curso (20-nov-2026). */
export const ESPERA_EN_CURSO_MS = 90_000;
export const PAUSA_EN_CURSO_MS = 2_000;

/**
 * Abre los detalles: devuelve el id del informe o null si no se pudo. Si la preparación en segundo plano de ese depto ya está en
 * curso (la ruta responde 409 «en-curso», p. ej. justo después de sumarlo), espera y vuelve a preguntar hasta que esté listo:
 * entonces la ruta lo devuelve al instante, sin leer la ficha ni prepararlo de nuevo. Encontrado en la prueba del 20-nov-2026.
 */
export async function abrirDetalles(avisoId: string, deps: { pedir?: typeof fetch; esperar?: (ms: number) => Promise<void> } = {}): Promise<string | null> {
  const pedir = deps.pedir ?? fetch;
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const hasta = Date.now() + ESPERA_EN_CURSO_MS;
  for (let intento = 0; ; intento++) {
    try {
      const res = await pedir(URL_DETALLES, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpoDetalles(avisoId, "abrir") });
      const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && d.id) return d.id;
      if (res.status !== 409 || d.error !== "en-curso" || Date.now() + PAUSA_EN_CURSO_MS > hasta || intento > ESPERA_EN_CURSO_MS / PAUSA_EN_CURSO_MS) return null;
    } catch {
      return null;
    }
    await esperar(PAUSA_EN_CURSO_MS);
  }
}

/** Prepara los detalles de estos deptos sin esperar respuesta (sigue aunque la persona cambie de pantalla). */
export function prepararEnSegundoPlano(avisoIds: readonly string[]): void {
  for (const id of avisoIds) {
    try {
      void fetch(URL_DETALLES, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpoDetalles(id, "elegir"), keepalive: true }).catch(() => {});
    } catch {
      /* sin red: la base lo vuelve a intentar al entrar */
    }
  }
}
