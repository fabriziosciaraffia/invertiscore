// ─────────────────────────────────────────────────────────────────────────────
// LA PUERTA REAL A FLOW de flow-vivas.ts (05-nov-2026, auditoría de promesas parte 2). Solo traduce: la regla de una sola
// suscripción viva está allá, sin red.
// ─────────────────────────────────────────────────────────────────────────────
import { flowGet, flowPost } from "@/lib/flow";
import type { PuertaFlowConAlta, SuscripcionFlow } from "@/lib/subscriptions/flow-vivas";

const PAGINA = 100; // máximo de Flow por página
const MAX_PAGINAS = 5;

/** `data` de una lista de Flow: el spec lo muestra como string; en la práctica llega como arreglo. Se aceptan los dos. */
function filasDe(resp: unknown): unknown[] {
  const data = (resp as { data?: unknown })?.data;
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const v = JSON.parse(data);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const puertaFlow: PuertaFlowConAlta = {
  async suscripcionesDe(customerId) {
    const todas: SuscripcionFlow[] = [];
    for (let pagina = 0, start = 0; pagina < MAX_PAGINAS; pagina++, start += PAGINA) {
      const resp = await flowGet("customer/getSubscriptions", { customerId, start, limit: PAGINA });
      const filas = filasDe(resp) as SuscripcionFlow[];
      todas.push(...filas.filter((s) => !!s?.subscriptionId));
      const hayMas = (resp as { hasMore?: unknown })?.hasMore;
      if (!(hayMas === 1 || hayMas === true || hayMas === "1") || filas.length === 0) break;
    }
    return todas;
  },
  async leer(subscriptionId) {
    return (await flowGet("subscription/get", { subscriptionId })) as SuscripcionFlow;
  },
  async cancelar(subscriptionId, inmediata) {
    return (await flowPost("subscription/cancel", { subscriptionId, at_period_end: inmediata ? 0 : 1 })) as SuscripcionFlow;
  },
  async crear({ planId, customerId, urlCallback }) {
    return (await flowPost("subscription/create", { planId, customerId, urlCallback })) as SuscripcionFlow;
  },
};

/** Lee una suscripción con un tope de tiempo (para una página: si Flow tarda, se usa lo guardado). */
export async function leerConTope(subscriptionId: string, ms = 2500): Promise<SuscripcionFlow | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      puertaFlow.leer(subscriptionId),
      new Promise<null>((ok) => { reloj = setTimeout(() => ok(null), ms); }),
    ]);
  } catch {
    return null;
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}
