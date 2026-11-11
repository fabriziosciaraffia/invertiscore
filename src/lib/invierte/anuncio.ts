// ─────────────────────────────────────────────────────────────────────────────
// EL ANUNCIO DE «INVIERTE CON FRANCO» A LA BASE (11-nov-2026, goal de Fabrizio, punto 7). Quién lo recibe, puro: lo usa
// scripts/invierte-anuncio.ts (que NO envía sin `--enviar`, y no se corre con `--enviar` sin el OK de Fabrizio) y lo prueba el
// tier INVIERTE-PRONTO.
//   · LAS CUENTAS ACTIVAS: con correo, que entraron (o se crearon) en los últimos `DIAS_ACTIVA` días.
//   · RESPETA LAS BAJAS: fuera quien se dio de baja de los correos (`perfil_busqueda.semanal_baja_at`), quien pidió eliminar su
//     cuenta (la marca en su app_metadata) y las cuentas de prueba (test_accounts). El único punto de envío vuelve a mirar la baja
//     y la eliminación (email.ts › enviarCorreo, el tipo `invierte_anuncio` está en las dos listas).
//   · EL ENLACE: a su selección en el dashboard, con la campaña marcada; la baja de un clic con el token de su última selección,
//     o /cuenta (donde está el interruptor) si no tiene.
// ─────────────────────────────────────────────────────────────────────────────
import { eliminacionPedida } from "@/lib/correo-baja";

export const DIAS_ACTIVA = 90;
export const CAMPANA_ANUNCIO = "invierte_pronto";

export interface CuentaAnuncio {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  nombre: string | null;
}

export type MotivoFuera = "sin_correo" | "inactiva" | "baja" | "eliminacion" | "prueba";

export interface Audiencia {
  van: CuentaAnuncio[];
  fuera: Record<MotivoFuera, number>;
}

/** Quién recibe el anuncio y cuántos quedan fuera por cada motivo. */
export function audienciaAnuncio(cuentas: readonly CuentaAnuncio[], o: { bajas: ReadonlySet<string>; prueba: ReadonlySet<string>; ahora?: Date }): Audiencia {
  const limite = (o.ahora ?? new Date()).getTime() - DIAS_ACTIVA * 24 * 60 * 60 * 1000;
  const fuera: Record<MotivoFuera, number> = { sin_correo: 0, inactiva: 0, baja: 0, eliminacion: 0, prueba: 0 };
  const van: CuentaAnuncio[] = [];
  for (const c of cuentas) {
    if (!c.email) { fuera.sin_correo++; continue; }
    if (o.prueba.has(c.id)) { fuera.prueba++; continue; }
    if (eliminacionPedida(c.appMetadata)) { fuera.eliminacion++; continue; }
    if (o.bajas.has(c.id)) { fuera.baja++; continue; }
    const t = Math.max(c.lastSignInAt ? Date.parse(c.lastSignInAt) : 0, c.createdAt ? Date.parse(c.createdAt) : 0);
    if (!(t >= limite)) { fuera.inactiva++; continue; }
    van.push(c);
  }
  return { van, fuera };
}

/** El enlace a su selección, con la campaña. */
export function urlSeleccionAnuncio(sitio: string): string {
  return `${sitio}/dashboard?utm_source=franco&utm_medium=email&utm_campaign=${CAMPANA_ANUNCIO}#seleccion`;
}

/** La baja de un clic con el token de su última selección; sin token, /cuenta. */
export function urlBajaAnuncio(sitio: string, token: string | null): string {
  return token ? `${sitio}/api/semanal/baja?t=${encodeURIComponent(token)}` : `${sitio}/cuenta`;
}
