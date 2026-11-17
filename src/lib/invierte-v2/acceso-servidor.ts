// ─────────────────────────────────────────────────────────────────────────────
// EL INTERRUPTOR, EN EL SERVIDOR (etapa 1 de Invierte con Franco, 18-nov-2026). EL ÚNICO lugar que decide si una persona ve
// el flujo nuevo: lo llaman las páginas `/invierte/…`, las rutas `/api/invierte-v2/…` y las páginas que dibujan el botón (el
// mapa, el dashboard y el informe), que bajan el booleano al navegador como prop.
//   · SE LLAMA POR PEDIDO, DESPUÉS DE `getUser()`, NUNCA DENTRO DE `unstable_cache`: el booleano es de una persona y un caché
//     compartido se lo serviría a otra. Lo fija un predicado del tier INVIERTE-V2.
//   · El modo y la lista se recuerdan 60 s por proceso (el admin los olvida al cambiarlos). Si no se pueden leer: APAGADO.
// ─────────────────────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/service";
import { CLAVE_MODO, TABLA_ACCESO, correoDeLista, leerModo, tieneAcceso, type ModoInvierteV2 } from "./acceso";

const VIDA_MS = 60_000;
let recordado: { modo: ModoInvierteV2; lista: Set<string>; at: number } | null = null;

export function olvidarAcceso(): void {
  recordado = null;
}

/** El modo y la lista, con su minuto de memoria. Sin poder leerlos, apagado y vacía. */
export async function estadoInterruptor(): Promise<{ modo: ModoInvierteV2; lista: Set<string> }> {
  if (recordado && Date.now() - recordado.at < VIDA_MS) return recordado;
  try {
    const admin = createServiceClient();
    const [c, l] = await Promise.all([
      admin.from("config").select("value").eq("key", CLAVE_MODO).maybeSingle(),
      admin.from(TABLA_ACCESO).select("email").order("email").range(0, 999),
    ]);
    if (c.error || l.error) return { modo: "apagado", lista: new Set() };
    const lista = new Set((l.data ?? []).map((f) => correoDeLista(f.email)).filter((x): x is string => !!x));
    recordado = { modo: leerModo(c.data?.value), lista, at: Date.now() };
    return recordado;
  } catch {
    return { modo: "apagado", lista: new Set() };
  }
}

/** ¿Esta persona (o nadie, sin sesión) ve el flujo nuevo? */
export async function accesoInvierteV2(user: { email?: string | null } | null | undefined): Promise<boolean> {
  const { modo, lista } = await estadoInterruptor();
  return tieneAcceso({ modo, email: user?.email ?? null, lista });
}

/** ¿Este correo está en la lista? (la excepción de la copia de la orden en correo-destino.ts). Sin poder leer, no. */
export async function correoEnListaInvierteV2(email: string | null | undefined): Promise<boolean> {
  const c = correoDeLista(email);
  if (!c) return false;
  const { lista } = await estadoInterruptor();
  return lista.has(c);
}
