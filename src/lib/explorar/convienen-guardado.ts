// ─────────────────────────────────────────────────────────────────────────────
// EL NÚMERO DE «CONVIENEN», GUARDADO (02-nov-2026, goal de los cortes por statement_timeout). Lo escribe el cron de la
// evaluación y lo leen la landing y la portada de /deptos. Vive aparte de portal-cache.ts porque el módulo del mapa no
// escribe nada (tier EXPLORAR-PORTAL §5).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureApiWarning, reportarFalloQuery } from "@/lib/observabilidad";
import { compactar, cuantosConvienen, FILTROS_GLOBALES } from "./portal";
import { universoDeLaNoche } from "./portal-servidor";

const RUTA = "lib/explorar/convienen-guardado";

/** EL NÚMERO DE «CONVIENEN» EN TODO EL SITIO, GUARDADO (02-nov-2026, goal de los cortes por statement_timeout): los deptos
 *  del mapa de la vista global (pie 20 %, 30 años, todo Gran Santiago), contados con `cuantosConvienen` sobre el MISMO
 *  universo que dibuja el mapa (`universoDeLaNoche`). Lo cuenta el cron de la evaluación al terminar y lo guarda en `config`;
 *  la landing y la portada de /deptos (y por ella el botón del dashboard) leen esa fila, así ninguna pantalla llama a
 *  `explorar_mapa` para decir el número. Hasta el 02-nov lo contaba cada pantalla desde la caché de diez minutos: al
 *  vencerse, la revalidación de fondo se cortaba por timeout en cada regeneración de la portada (dos veces: Next renderiza
 *  el HTML y el payload aparte) y solo dejaba un `console.error`. /explorar y su bienvenida siguen contando el universo que
 *  dibujan: durante el día pueden diferir en unos pocos deptos del guardado (aceptado por Fabrizio, 02-nov-2026). Antes del
 *  30-oct el dashboard y /deptos leían el `convienen` del resumen de la noche (`deptos_conteo`, otro universo). */
export const CLAVE_CONVIENEN_MAPA = "explorar_convienen_mapa";

/** Lo guardado en `config`, o null si no hay o no se lee. */
export function convienenMapaGuardado(valor: string | null | undefined): number | null {
  if (!valor) return null;
  try {
    const n = Number((JSON.parse(valor) as { convienenMapa?: unknown }).convienenMapa);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Lo cuenta y lo guarda (lo llama el cron de la evaluación al terminar). Sin número —la consulta falló o el mapa salió
 *  vacío— no escribe: queda el anterior, y la falla queda en Sentry. */
export async function guardarConvienenMapa(admin: SupabaseClient, ahora: Date = new Date()): Promise<number | null> {
  let n: number | null;
  try {
    n = cuantosConvienen(compactar(await universoDeLaNoche(admin, FILTROS_GLOBALES.pie, FILTROS_GLOBALES.plazo, ahora)));
  } catch (e) {
    captureApiWarning(e, { ruta: RUTA, operacion: "contar-convienen-mapa" });
    return null;
  }
  if (n == null) {
    captureApiWarning(new Error("el mapa de la vista global salió vacío: no se guarda el número"), { ruta: RUTA, operacion: "contar-convienen-mapa" });
    return null;
  }
  const { error } = await admin.from("config").upsert(
    { key: CLAVE_CONVIENEN_MAPA, value: JSON.stringify({ convienenMapa: n, calculadoAt: ahora.toISOString() }), updated_at: ahora.toISOString().replace("Z", "") },
    { onConflict: "key" },
  );
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-convienen-mapa" });
  return error ? null : n;
}

/** El número guardado (la portada de /deptos). Null si no hay: la frase sale sin cifra y la falta queda en Sentry. */
export async function leerConvienenMapa(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin.from("config").select("value").eq("key", CLAVE_CONVIENEN_MAPA).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-convienen-mapa" });
  const n = convienenMapaGuardado(data?.value as string | null | undefined);
  if (n == null && !error) captureApiWarning(new Error(`sin el número del mapa guardado (config ${CLAVE_CONVIENEN_MAPA})`), { ruta: RUTA, operacion: "leer-convienen-mapa" });
  return n;
}
