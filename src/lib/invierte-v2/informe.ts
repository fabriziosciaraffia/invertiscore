// ─────────────────────────────────────────────────────────────────────────────
// LA PORTADA DEL INFORME Y EL FLUJO NUEVO (etapa 1 de Invierte con Franco, 18-nov-2026). Si la franja «Invierte con Franco» va
// (invierte-servidor.ts › invierteDelInforme decide eso, igual que hoy) y la persona tiene acceso y el depto es usado, la
// franja lleva al contacto del flujo nuevo (`flujoV2`). Si no, queda exactamente como hoy (Pronto).
// ─────────────────────────────────────────────────────────────────────────────
import type { InvierteInforme } from "@/lib/invierte/invierte-servidor";
import { condicionDeLinea } from "@/lib/invierte/invierte";
import { accesoInvierteV2 } from "./acceso-servidor";
import { destinoBoton, urlContacto } from "./destino";

export async function conFlujoV2(invierte: InvierteInforme | null, user: { email?: string | null } | null): Promise<InvierteInforme | null> {
  if (!invierte || !user) return invierte;
  const acceso = await accesoInvierteV2(user).catch(() => false);
  if (destinoBoton({ acceso, condicion: condicionDeLinea(invierte.depto.linea) }) !== "v2") return invierte;
  return { ...invierte, flujoV2: urlContacto(invierte.depto.avisoId, "informe", invierte.depto.analysisId ?? null) };
}
