// ─────────────────────────────────────────────────────────────────────────────
// EL REINTENTO DE LAS COPIAS, CABLEADO (18-nov-2026): lo llama el cron `correo-del-dia` dentro de un paso aislado (copias.ts ›
// pasoAislado), después del correo diario. Mientras el modo no sea «todos», solo reintenta a correos de la lista; el aviso de
// una copia que no sale en una hora va a hola@ (una vez por orden).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAlertaCronInterna } from "@/lib/email";
import { correoDeLista } from "./acceso";
import { estadoInterruptor } from "./acceso-servidor";
import { horaChile } from "./orden-pdf";
import { DEPS_FIRMA } from "./rutas";
import { reintentarCopias, type DepsReintento } from "./servidor";

/** Quién puede recibir un reintento con este modo y esta lista. Puro (lo prueba el tier). */
export function puedeRecibirCopia(modo: string, lista: ReadonlySet<string>, email: string): boolean {
  if (modo === "todos") return true;
  const c = correoDeLista(email);
  return !!c && lista.has(c);
}

export async function reintentarCopiasDelCron(admin: SupabaseClient): Promise<Awaited<ReturnType<typeof reintentarCopias>>> {
  const { modo, lista } = await estadoInterruptor();
  const deps: DepsReintento = {
    firma: DEPS_FIRMA,
    puedeRecibir: (email) => puedeRecibirCopia(modo, lista, email),
    avisar: (p) => sendAlertaCronInterna({
      cron: "invierte-copias",
      problema: "La copia de una orden firmada no salió en más de una hora",
      detalle: [`Orden ${p.ordenId}`, `Para ${p.email}`, `Firmada ${horaChile(p.firmadoAt)}`, `Intentos: ${p.intentos}`, `Último motivo: ${p.motivo ?? "—"}`, "Se puede reenviar desde /admin/invierte-v2."],
    }),
  };
  return reintentarCopias(admin, deps);
}
