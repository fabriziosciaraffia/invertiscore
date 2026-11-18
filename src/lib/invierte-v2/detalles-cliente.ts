// ─────────────────────────────────────────────────────────────────────────────
// Los detalles de los deptos del flujo, desde el navegador (entrega 2, 18-nov-2026, aprobado por Fabrizio):
//   · ABRIR: la ruta de la guía en modo Invierte (`invierte: true`). Lo ya preparado vuelve al instante, sin leer la ficha.
//   · PREPARAR EN SEGUNDO PLANO: apenas la persona elige (y al entrar a la base, lo que haya quedado sin preparar), un pedido por
//     depto con `keepalive`, que sigue aunque la pantalla cambie. Sin gastar créditos (charge_mode 'invierte'); la lectura de la
//     ficha al elegir va por el carril de Invierte.
// ─────────────────────────────────────────────────────────────────────────────
export const URL_DETALLES = "/api/lo-que-sigue/guia/analizar";

export const cuerpoDetalles = (avisoId: string, origen: "elegir" | "abrir") =>
  JSON.stringify({ avisoId, explorar: true, piePct: 20, plazoAnios: 30, invierte: true, origenInvierte: origen });

/** Abre los detalles: devuelve el id del informe o null si no se pudo. */
export async function abrirDetalles(avisoId: string): Promise<string | null> {
  try {
    const res = await fetch(URL_DETALLES, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpoDetalles(avisoId, "abrir") });
    const d = (await res.json().catch(() => ({}))) as { id?: string };
    return res.ok && d.id ? d.id : null;
  } catch {
    return null;
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
