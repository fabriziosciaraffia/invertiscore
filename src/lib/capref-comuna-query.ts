// Benchmark de cap rate por comuna — la resolución VIVA sobre `scraped_properties`.
// La regla (celda, cascada, mínimos, sin factor) vive en capref-comuna.ts; acá solo se consulta.
//
// Una consulta por peldaño y por lado, PAGINADA (PostgREST capa en 1.000): la misma forma que
// `getComunaMedianaVentaUF`. Venta en el universo del sujeto (nuevo | usado); arriendo siempre
// usado (no hay avisos de arriendo nuevo). Superficie ±20% en los dos lados y en los dos
// peldaños; dormitorios exacto solo en el peldaño «celda» (en obra nueva, por tipo de fila:
// `filtrarTipologiaObraNueva`). Todo a UF por m²; el precio es el PUBLICADO, sin factor.
import {
  PAGINA_POSTGREST,
  filtrarTipologiaObraNueva,
  type CondicionMercado,
} from "@/lib/comuna-stats";
import { reportarFalloQuery } from "@/lib/observabilidad";
import {
  CASCADA_CAPREF,
  capRefSinAvisos,
  construirCeldaCapRef,
  evaluarPeldanoCapRef,
  type CapRefComunaSnapshot,
  type CeldaCapRef,
  type MuestraCapRef,
} from "@/lib/capref-comuna";

type Fila = { precio: unknown; moneda: unknown; superficie_m2: unknown; dormitorios: unknown; condicion: unknown; source_id: unknown };

async function traer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lado: "venta" | "arriendo",
  celda: CeldaCapRef,
  paso: { nivel: "celda" | "comuna"; ventana: number },
): Promise<Fila[]> {
  const desde = new Date(Date.now() - paso.ventana * 24 * 60 * 60 * 1000).toISOString();
  const condicion: CondicionMercado = lado === "venta" ? celda.condicion : "usado";
  const out: Fila[] = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    let q = supabase
      .from("scraped_properties")
      .select("precio, moneda, superficie_m2, dormitorios, condicion, source_id")
      .eq("comuna", celda.comuna)
      .eq("type", lado)
      .eq("is_active", true)
      .gte("scraped_at", desde)
      .gt("precio", 0)
      .gte("superficie_m2", celda.supMin)
      .lte("superficie_m2", celda.supMax)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    // Usado: `.or` y no `.eq`, porque las filas sin `condicion` son usadas (la trampa del NULL).
    q = condicion === "nuevo" ? q.eq("condicion", "nuevo") : q.or("condicion.is.null,condicion.eq.usado");
    // Dormitorios exacto en el peldaño «celda»; en obra nueva se resuelve en memoria por tipo de
    // fila (unidad vs fila-proyecto), igual que la mediana comunal.
    if (paso.nivel === "celda" && celda.dormitorios !== null && condicion === "usado") q = q.eq("dormitorios", celda.dormitorios);
    const { data, error } = await q;
    reportarFalloQuery(error, {
      ruta: "lib/capref-comuna-query",
      operacion: `capref-${lado}`,
      tags: { tabla: "scraped_properties", universo: condicion, nivel: paso.nivel },
      extra: { comuna: celda.comuna, dormitorios: celda.dormitorios, ventana: paso.ventana, superficie: celda.superficieM2, offset: off },
    });
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...(data as Fila[]));
    if (data.length < PAGINA_POSTGREST) break;
  }
  if (condicion === "nuevo" && paso.nivel === "celda") return filtrarTipologiaObraNueva(out, celda.dormitorios);
  return out;
}

function aUFm2(filas: Fila[], ufValue: number): number[] {
  const vals: number[] = [];
  for (const r of filas) {
    const sup = Number(r.superficie_m2);
    const precio = Number(r.precio);
    if (!(sup > 0) || !(precio > 0)) continue;
    const enUF = r.moneda === "UF" ? precio : precio / (ufValue || 1);
    vals.push(enUF / sup);
  }
  return vals;
}

/**
 * Resuelve la referencia de cap rate de la comuna para un sujeto, peldaño a peldaño (una
 * consulta por lado y por peldaño; se detiene en el primero que alcanza). Devuelve SIEMPRE un
 * snapshot con su `nivel` declarado; nunca lanza (un fallo de consulta se reporta y cuenta como
 * muestra vacía en ese peldaño).
 */
export async function resolverCapRefComunaVivo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: { comuna: string; superficie: number; dormitorios?: number | null; esNuevo?: boolean | null; antiguedad?: number | null },
  ufValue: number,
): Promise<CapRefComunaSnapshot> {
  const celda = construirCeldaCapRef(input);
  const resolvedAt = new Date().toISOString();
  let nArriendoMax = 0;
  let nVentaMax = 0;
  for (const paso of CASCADA_CAPREF) {
    let muestra: MuestraCapRef = { arriendoUFm2Mes: [], ventaUFm2: [] };
    try {
      const [arr, venta] = await Promise.all([traer(supabase, "arriendo", celda, paso), traer(supabase, "venta", celda, paso)]);
      muestra = { arriendoUFm2Mes: aUFm2(arr, ufValue), ventaUFm2: aUFm2(venta, ufValue) };
    } catch (e) {
      console.error("[resolverCapRefComunaVivo] falló un peldaño (sigue la cascada):", e);
    }
    nArriendoMax = Math.max(nArriendoMax, muestra.arriendoUFm2Mes.length);
    nVentaMax = Math.max(nVentaMax, muestra.ventaUFm2.length);
    const r = evaluarPeldanoCapRef(paso, muestra, celda, resolvedAt);
    if (r) return r;
  }
  return capRefSinAvisos(celda, resolvedAt, { nArriendo: nArriendoMax, nVenta: nVentaMax });
}
