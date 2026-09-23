// ============================================================================
// GENERADOR · el ancla de la demanda del score STR (23-sep-2026)
// ============================================================================
// Lee el caché de AirROI (`airbnb_estimates`, SOLO LECTURA), toma los `comparable_listings` de
// todas las respuestas, deduplica por listing y calcula la mediana de la ocupación realizada de
// los que pasan `listingConOcupacionRealizada` —el MISMO filtro con que se calcula el dato del
// caso—. Escribe `src/lib/data/ocupacion-realizada-santiago.gen.ts` con la mediana, el n y la
// huella del filtro. Si el filtro cambia, se corre de nuevo; el tier `factibilidad-demanda`
// exige que la huella guardada sea la del filtro vigente.
//
//   node --env-file=.env.local --import tsx scripts/generar-ocupacion-realizada-santiago.ts
// ============================================================================
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { listingConOcupacionRealizada, type RawListingPerf } from "../src/lib/airbnb/process-comparables";
import { huellaFiltro } from "./eval/golden/huella-filtro-ocupacion";

const RAIZ = join(__dirname, "..");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const huella = huellaFiltro(RAIZ);
  if (!huella) throw new Error("no se encontraron los marcadores del filtro en process-comparables.ts");
  const porListing = new Map<string, number>();
  let respuestas = 0;
  for (let off = 0; ; off += 200) {
    const { data, error } = await sb.from("airbnb_estimates").select("raw_response").order("id").range(off, off + 199);
    if (error) throw error;
    for (const c of data ?? []) {
      respuestas++;
      for (const l of ((c as { raw_response?: { comparable_listings?: unknown[] } }).raw_response?.comparable_listings ?? []) as (RawListingPerf & { listing_info?: { listing_id?: unknown } })[]) {
        const id = String(l?.listing_info?.listing_id ?? "");
        if (!id || !listingConOcupacionRealizada(l)) continue;
        porListing.set(id, l.performance_metrics!.ttm_occupancy as number);
      }
    }
    if (!data || data.length < 200) break;
  }
  const xs = [...porListing.values()].sort((a, b) => a - b);
  if (xs.length < 1000) throw new Error(`solo ${xs.length} listings: muestra insuficiente para el ancla`);
  const m = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  const mediana = Math.round(m * 10000) / 10000;
  const hoy = new Date().toISOString().slice(0, 10);
  const out = `// ⛔ GENERADO por scripts/generar-ocupacion-realizada-santiago.ts — no editar a mano.
// El ancla de la demanda de la zona en la factibilidad del score STR: la mediana de la ocupación
// realizada de los listings comparables de AirROI en Santiago, con el MISMO filtro que el dato del
// caso (\`listingConOcupacionRealizada\`). \`HUELLA_FILTRO\` es la huella del texto de ese filtro: si
// el filtro cambia, este archivo se regenera (lo exige el tier \`factibilidad-demanda\`).
export const OCUPACION_REALIZADA_SANTIAGO = {
  /** Mediana de la ocupación realizada, como fracción (0,25 = 25%). */
  mediana: ${mediana},
  /** Listings distintos que pasaron el filtro. */
  n: ${xs.length},
  /** Respuestas de AirROI leídas del caché. */
  respuestas: ${respuestas},
  generadoEl: "${hoy}",
} as const;

export const HUELLA_FILTRO_OCUPACION = "${huella}";
`;
  writeFileSync(join(RAIZ, "src/lib/data/ocupacion-realizada-santiago.gen.ts"), out);
  console.log(`mediana ${(mediana * 100).toFixed(1)}% · ${xs.length} listings · ${respuestas} respuestas · huella ${huella}`);
})();
