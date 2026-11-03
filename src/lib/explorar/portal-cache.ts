// El universo de la noche, en caché diez minutos (28-oct-2026): es el mismo para todas las cuentas y cambia una vez por
// noche, como el número de /deptos (lib/deptos/portada.ts). La página lo usa para el número del primer pintado y la API
// para el mapa: los dos leen la MISMA entrada, así el número no salta cuando llegan los pines. Una falla no se guarda.
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { claveUniverso, compactar, type TasaDelMotor, type UniversoCompacto } from "./portal";
import { negociablesDeLaNoche, universoDeLaNoche, type RespuestaUniverso } from "./portal-servidor";
import { capaNegociarDisponible, compactarNegociados, sinCifrasNegociados, type NegociadosCompactos } from "./capa-negociar";
import { sinCifras as universoSinCifras } from "./abierto";

const cacheado = unstable_cache(
  async (pie: number, plazo: number): Promise<UniversoCompacto> => compactar(await universoDeLaNoche(createServiceClient(), pie, plazo)),
  ["explorar-mapa-v1"],
  { revalidate: 600 },
);

export function universoDeLaNocheCacheado(pie: number, plazo: number): Promise<UniversoCompacto> {
  return cacheado(pie >= 30 ? 30 : 20, plazo >= 30 ? 30 : 25);
}

/** LA CAPA «SI NEGOCIAS» (02-nov-2026, capa-negociar.ts): la misma caché de diez minutos que el universo de la noche, por pie.
 *  Nunca entra en el número de «convienen»: es otra entrada. */
const negociablesCache = unstable_cache(
  async (pie: number): Promise<NegociadosCompactos> => compactarNegociados(await negociablesDeLaNoche(createServiceClient(), pie)),
  ["explorar-negociar-v1"],
  { revalidate: 600 },
);
export function negociablesCacheados(pie: number): Promise<NegociadosCompactos> {
  return negociablesCache(pie >= 30 ? 30 : 20);
}

/** EL PEDIDO DEL MAPA DE LA NOCHE (03-nov-2026, la pasada real de Fabrizio: de entrada se ven las dos clases): el universo de los
 *  ✓ Comprar y, si la combinación tiene capa, los − Ajustar que llegan negociando, en una respuesta. De las dos cachés de diez
 *  minutos de siempre. `sinCifras`: lo de /api/explorar/abierto (el flujo, el arriendo y el precio negociado no viajan). Una falla
 *  de la capa no tumba el mapa: sale sin `negociados` y el navegador la pide aparte. */
export async function respuestaDeLaNoche(
  pie: number,
  plazo: number,
  o: { sinCifras?: boolean } = {},
  /** Las lecturas (el tier EXPLORAR-PASADA las reemplaza para probar el armado sin la base). */
  leer: { universo: (pie: number, plazo: number) => Promise<UniversoCompacto>; capa: (pie: number) => Promise<NegociadosCompactos> } = { universo: universoDeLaNocheCacheado, capa: negociablesCacheados },
): Promise<RespuestaUniverso> {
  const q = { modalidad: "ltr" as const, pie, plazo, tasa: null };
  const [u, n] = await Promise.all([
    leer.universo(pie, plazo),
    capaNegociarDisponible(q as Parameters<typeof capaNegociarDisponible>[0]) ? leer.capa(pie).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    clave: claveUniverso(q), comunas: [], universo: o.sinCifras ? universoSinCifras(u) : u,
    ...(n ? { negociados: o.sinCifras ? sinCifrasNegociados(n) : n } : {}), calculados: 0, ms: 0,
  };
}

const tasaCacheada = unstable_cache(
  async (): Promise<TasaDelMotor | null> => {
    const { data, error } = await createServiceClient().from("config").select("value").eq("key", "tasa_hipotecaria").maybeSingle();
    if (error) throw new Error(`tasa del motor: ${error.message}`);
    const tasa = Number(data?.value);
    return Number.isFinite(tasa) && tasa > 0 ? { tasa } : null;
  },
  ["explorar-tasa-motor-v2"],
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
