// ─────────────────────────────────────────────────────────────────────────────
// LA BAJA DE LOS CORREOS DE FRANCO (04-nov-2026, auditoría de promesas parte 1, decisión de Fabrizio).
//
// /cuenta promete «Deja de recibir los correos de Franco cuando quieras» y /privacy, «No enviamos comunicaciones
// comerciales no solicitadas». La baja que la persona da —«Dejar de recibirlos» en el semanal, o el interruptor de la
// selección semanal en /cuenta— es `perfil_busqueda.semanal_baja_at`. El semanal y el correo del día ya la miraban; el
// carrito abandonado y el recordatorio del pack, no. Desde acá la miran los dos, antes de reclamar su fila, y el único
// punto de envío (email.ts › enviarCorreo) la vuelve a mirar para esos tipos, por si otro camino los manda.
// El aviso inmediato tiene su propia baja (`inmediato_baja_at`) y lo transaccional (pago, boleta, código) sale siempre.
// Lo fija el tier DATOS-Y-PLATA.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoCorreo } from "@/lib/medicion-correo";

/** Los correos comerciales que respetan la baja general (además del semanal y el del día, que la leen al armarse). */
export const TIPOS_CON_BAJA: ReadonlySet<TipoCorreo> = new Set<TipoCorreo>(["checkout_abandonado", "recordatorio_pack", "invierte_anuncio"]);

/**
 * LA CUENTA QUE PIDIÓ ELIMINARSE (05-nov-2026, auditoría de promesas parte 2): al pedirlo se detienen los correos, aunque el
 * borrado sea manual. api/account/request-deletion pone las dos bajas de perfil_busqueda (frenan el semanal, el del día, la
 * renta corta, el aviso inmediato y los dos de arriba) y esta marca en el app_metadata de la cuenta, que el único punto de
 * envío mira para el resto de lo que no es transaccional. Quedan fuera, a propósito: la confirmación de la eliminación, la
 * boleta y el pago confirmado (comprobantes), y los avisos internos a hola@. El semanal y el aviso inmediato no van en la
 * lista porque ya los frenan las bajas antes de armarse (y así el cron no lee una cuenta por correo).
 */
export const MARCA_ELIMINACION = "eliminacion_solicitada_at";
export const TIPOS_QUE_FRENA_LA_ELIMINACION: ReadonlySet<TipoCorreo> = new Set<TipoCorreo>([
  "bienvenida", "informe_listo", "pago_fallido", "checkout_abandonado", "recordatorio_pack", "aviso_pedido", "pregunta_horizonte", "premio_referido", "plan_aumento", "tarjeta_registrada", "invierte_anuncio",
]);

/** ¿La cuenta pidió eliminarse? (la marca en su app_metadata). */
export function eliminacionPedida(appMetadata: Record<string, unknown> | null | undefined): boolean {
  return !!appMetadata && typeof appMetadata[MARCA_ELIMINACION] === "string";
}

/** De estas personas, las que se dieron de baja de los correos. De a 100 ids (la lista va en la URL). */
export async function conBajaDeCorreos(admin: SupabaseClient, userIds: readonly string[]): Promise<Set<string>> {
  const fuera = new Set<string>();
  const unicos = Array.from(new Set(userIds.filter(Boolean)));
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await admin.from("perfil_busqueda").select("user_id").in("user_id", unicos.slice(i, i + 100)).not("semanal_baja_at", "is", null);
    if (error) throw new Error(`bajas: ${error.message}`);
    for (const f of data ?? []) fuera.add(f.user_id as string);
  }
  return fuera;
}
