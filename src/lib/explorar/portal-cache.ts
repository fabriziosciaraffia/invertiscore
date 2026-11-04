// ─────────────────────────────────────────────────────────────────────────────
// LA NOCHE DE EXPLORAR EN CACHÉ: UNA SOLA, CON UNA SOLA EDAD (03-nov-2026, decisión de Fabrizio: «las cifras de "convienen" y de
// los negociados que ven la página de /explorar, su API y la barra salen de una sola caché, con una sola edad: en una misma
// carga todas dicen lo mismo»). Hasta hoy eran DOS entradas de diez minutos —el universo y la capa—, cada una vencía por su
// cuenta, y la página y la API las leían en momentos distintos: en el preview la página dijo 6.652 ✓ Comprar + 3.120 − Ajustar y la
// barra, con lo que trajo la API, 6.695 + 3.110.
// Ahora la noche —el universo de los ✓ Comprar y los − Ajustar, LEÍDOS JUNTOS— se guarda POR SELLO (sello-noche.ts: una ventana
// de diez minutos, firmada) y esa entrada no cambia. El sello vigente es un puntero chico que se renueva solo (sirve el anterior
// mientras tanto); la página lee la noche del vigente y le pasa el sello al navegador, que lo manda en cada pedido de la noche:
// la API lee la MISMA entrada aunque entretanto haya llegado otro sello. La siguiente carga trae el sello nuevo y todo cambia junto.
// Un `unstable_cache` dentro de otro se saltea la caché (Next 14.2, unstable-cache.js: `fetchCache: "force-no-store"` en el
// callback), así que el puntero no deja lista la noche: el primer pedido de cada sello la lee (~0,6-1 s medidos, en el Suspense).
// Una falla del universo no se guarda; la de la capa se reintenta una vez y, si sigue, la noche sale sin capa (el mapa no cae).
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { claveUniverso, compactar, type TasaDelMotor, type UniversoCompacto } from "./portal";
import { negociablesDeLaNoche, universoDeLaNoche, type RespuestaUniverso } from "./portal-servidor";
import { capaDeLaNoche, compactarNegociados, sinCifrasNegociados, type NegociadosCompactos } from "./capa-negociar";
import { sinCifras as universoSinCifras } from "./abierto";
import { selloDeHora, selloDeToken, tokenDeSello, VIDA_SELLO_S } from "./sello-noche";

/** La noche de un sello, como se guarda: el número del sello y lo leído junto. */
export interface NocheGuardada { n: number; universo: UniversoCompacto; negociados: NegociadosCompactos | null }
/** La noche que leen la página y la API: lo guardado y el sello firmado que viaja al navegador (null sin secreto). */
export interface NocheExplorar { sello: string | null; universo: UniversoCompacto; negociados: NegociadosCompactos | null }

// La capa que GUARDA la noche (pie 20 % o 30 % a 30 años); la de 25 años se calcula por comuna (04-nov-2026), no viaja con la noche.
const capaDe = (pie: number, plazo: number) => capaDeLaNoche({ modalidad: "ltr", pie, plazo, tasa: null } as Parameters<typeof capaDeLaNoche>[0]);

const nocheDeSello = unstable_cache(
  async (n: number, pie: number, plazo: number): Promise<NocheGuardada> => {
    const admin = createServiceClient();
    const leerCapa = () => negociablesDeLaNoche(admin, pie);
    const [u, neg] = await Promise.all([
      universoDeLaNoche(admin, pie, plazo),
      capaDe(pie, plazo) ? leerCapa().catch(leerCapa).catch(() => null) : Promise.resolve(null),
    ]);
    return { n, universo: compactar(u), negociados: neg ? compactarNegociados(neg) : null };
  },
  ["explorar-noche-v2"],
  // Más que la vida de un sello: mientras un sello vale, su entrada no se vuelve a leer de la base.
  { revalidate: VIDA_SELLO_S * 2 },
);

const selloVigenteCache = unstable_cache(async (): Promise<number> => selloDeHora(Date.now()), ["explorar-sello-v1"], { revalidate: 300 });

/** De dónde sale la noche (el tier EXPLORAR-PASADA las reemplaza para probar la regla sin la base ni Next). */
export interface FuentesNoche {
  vigente: () => Promise<number>;
  deSello: (n: number, pie: number, plazo: number) => Promise<NocheGuardada>;
  token: (n: number) => string | null;
  leerToken: (t: string) => number | null;
}
const FUENTES: FuentesNoche = {
  vigente: () => selloVigenteCache().catch(() => selloDeHora(Date.now())),
  deSello: nocheDeSello,
  token: (n) => tokenDeSello(n),
  leerToken: (t) => selloDeToken(t),
};

/** LA NOCHE DE EXPLORAR: la del sello que trae el pedido si vale (el de la página que lo hizo), o la del vigente. */
export async function nocheExplorar(pie: number, plazo: number, sello: string | null = null, f: FuentesNoche = FUENTES): Promise<NocheExplorar> {
  const n = (sello ? f.leerToken(sello) : null) ?? (await f.vigente());
  const g = await f.deSello(n, pie >= 30 ? 30 : 20, plazo >= 30 ? 30 : 25);
  return { sello: f.token(g.n), universo: g.universo, negociados: g.negociados };
}

/** EL PEDIDO DEL MAPA DE LA NOCHE (03-nov-2026, la pasada real de Fabrizio: de entrada se ven las dos clases): el universo de los
 *  ✓ Comprar y, si la combinación tiene capa, los − Ajustar que llegan negociando, en una respuesta, de la noche del sello que
 *  trae el pedido (`sello`), con ese sello. `sinCifras`: lo de /api/explorar/abierto (el flujo, el arriendo y el precio negociado
 *  no viajan). Si la capa falló, sale sin `negociados` y el navegador la pide aparte, con el mismo sello. */
export async function respuestaDeLaNoche(
  pie: number,
  plazo: number,
  o: { sinCifras?: boolean; sello?: string | null } = {},
  /** La lectura (el tier EXPLORAR-PASADA la reemplaza para probar el armado sin la base). */
  leer: (pie: number, plazo: number, sello: string | null) => Promise<NocheExplorar> = (p, z, s) => nocheExplorar(p, z, s),
): Promise<RespuestaUniverso> {
  const q = { modalidad: "ltr" as const, pie, plazo, tasa: null };
  const noche = await leer(pie, plazo, o.sello ?? null);
  const n = capaDe(pie, plazo) ? noche.negociados : null;
  return {
    clave: claveUniverso(q), comunas: [], universo: o.sinCifras ? universoSinCifras(noche.universo) : noche.universo,
    ...(n ? { negociados: o.sinCifras ? sinCifrasNegociados(n) : n } : {}), sello: noche.sello, calculados: 0, ms: 0,
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
