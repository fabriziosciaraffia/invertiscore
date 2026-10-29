// El universo de la noche, en caché diez minutos (28-oct-2026): es el mismo para todas las cuentas y cambia una vez por
// noche, como el número de /deptos (lib/deptos/portada.ts). La página lo usa para el número del primer pintado y la API
// para el mapa: los dos leen la MISMA entrada, así el número no salta cuando llegan los pines. Una falla no se guarda.
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { compactar, cuantosConvienen, fechaDeRevision, FILTROS_GLOBALES, type TasaDelMotor, type UniversoCompacto } from "./portal";
import { universoDeLaNoche } from "./portal-servidor";

const cacheado = unstable_cache(
  async (pie: number, plazo: number): Promise<UniversoCompacto> => compactar(await universoDeLaNoche(createServiceClient(), pie, plazo)),
  ["explorar-mapa-v1"],
  { revalidate: 600 },
);

export function universoDeLaNocheCacheado(pie: number, plazo: number): Promise<UniversoCompacto> {
  return cacheado(pie >= 30 ? 30 : 20, plazo >= 30 ? 30 : 25);
}

/** EL NÚMERO DE «CONVIENEN» EN TODO EL SITIO (30-oct-2026): los deptos del mapa de la vista global (pie 20 %, 25 años, todo
 *  Gran Santiago), contados con `cuantosConvienen` sobre la misma entrada en caché que dibuja el mapa. Lo leen la landing, la
 *  portada de /deptos (su prueba) y, por ella, el botón del dashboard; /explorar y su bienvenida cuentan el mismo universo.
 *  Antes el dashboard y /deptos leían el resumen de la noche (`deptos_conteo`, otro universo: 4.767 contra 4.770). Null si
 *  falla: cada superficie sale sin cifra. */
export async function convienenHoy(): Promise<number | null> {
  try {
    return cuantosConvienen(await universoDeLaNocheCacheado(FILTROS_GLOBALES.pie, FILTROS_GLOBALES.plazo));
  } catch {
    return null;
  }
}

const tasaCacheada = unstable_cache(
  async (): Promise<TasaDelMotor | null> => {
    const { data, error } = await createServiceClient().from("config").select("value, updated_at").eq("key", "tasa_hipotecaria").maybeSingle();
    if (error) throw new Error(`tasa del motor: ${error.message}`);
    const tasa = Number(data?.value);
    return Number.isFinite(tasa) && tasa > 0 ? { tasa, revisada: fechaDeRevision(data?.updated_at as string | null | undefined) } : null;
  },
  ["explorar-tasa-motor-v1"],
  { revalidate: 600 },
);

/** LA TASA DEL MOTOR (30-oct-2026): `config.tasa_hipotecaria`, la misma que lee la evaluación de la noche
 *  (cron/evaluar-avisos › leerConfig) y todo pie o plazo que Explorar calcula (guia-servidor › leerConfigGuia). Nunca escrita a
 *  mano: la línea bajo el número del mapa y «¿Cómo se calcula?» la leen de acá. Null si falla (la línea sale sin tasa). */
export async function tasaDelMotor(): Promise<TasaDelMotor | null> {
  try {
    return await tasaCacheada();
  } catch {
    return null;
  }
}
