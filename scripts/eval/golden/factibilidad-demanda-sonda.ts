/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// SONDA CON BASE · las filas STR que no guardaron la ocupación realizada la leen del caché de
// AirROI (23-sep-2026). Solo lectura. Lo que el tier estático `factibilidad-demanda` no puede:
// sobre el parque real, cada fila sin `ocupacionRealizadaComparables` que tenga respuesta en el
// caché sale del helper con el dato, y ninguna fila queda en el respaldo por atractores sin
// que se sepa. Imprime cuántas, y falla si alguna fila con respuesta en el caché no lo recupera.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/factibilidad-demanda-sonda.ts
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { conOcupacionRealizadaDelCache } from "../../../src/lib/airbnb/ocupacion-realizada-cache";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const filas: any[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from("analisis").select("id, input_data, results").eq("tipo_analisis", "short-term").not("input_data", "is", null).order("id").range(off, off + 999);
    if (error) throw error; filas.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  let guardada = 0, delCache = 0, sinNada = 0;
  const perdidas: string[] = [];
  for (const f of filas) {
    if ((f.results?.ocupacionRealizadaComparables?.n ?? 0) > 0) { guardada++; continue; }
    const r: any = await conOcupacionRealizadaDelCache(f.input_data, f.results);
    if ((r?.ocupacionRealizadaComparables?.n ?? 0) > 0) { delCache++; continue; }
    // ¿Había respuesta en el caché para esa dirección? Si la había, el helper la perdió.
    const addr = f.results?.airbnbRaw?.address;
    const { count } = addr ? await sb.from("airbnb_estimates").select("id", { count: "exact", head: true }).ilike("address", String(addr).trim()) : { count: 0 };
    if ((count ?? 0) > 0) perdidas.push(String(f.id).slice(0, 8)); else sinNada++;
  }
  console.log(`filas STR ${filas.length} · con el dato guardado ${guardada} · leídas del caché ${delCache} · sin comparables en ningún lado ${sinNada} · perdidas ${perdidas.length}`);
  if (delCache === 0 && guardada < filas.length) console.log("  ✗ PISO · ninguna fila leyó del caché: el helper no está leyendo");
  const mal = perdidas.length > 0 || (delCache === 0 && guardada < filas.length);
  console.log(mal ? `\n✗ FACTIBILIDAD-DEMANDA (sonda) · ${perdidas.join(", ")}` : "\n✓ FACTIBILIDAD-DEMANDA (sonda) · toda fila sin el dato guardado lo recupera del caché cuando existe");
  process.exit(mal ? 1 : 0);
})();
