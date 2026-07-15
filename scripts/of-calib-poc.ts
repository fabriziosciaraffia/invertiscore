// of-calib-poc — PoC de la siembra de banda media (validación del método aprobado en ⛔#1).
// Recompute IN-MEMORY de filas STR reales variando modoGestion + occOverride, reusando el
// airbnbRaw persistido → CERO AirROI, CERO writes. Imprime el sobreRentaPct resultante y cuántos
// combos caen en la banda media [-10%, +15%]. Es la prueba de que el barrido puebla la banda.
// Uso: node --env-file=.env.local --import tsx scripts/of-calib-poc.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { calcShortTerm } from "../src/lib/engines/short-term-engine";
import { buildAirbnbData } from "../src/lib/api-helpers/analisis-pipeline";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function buildInputs(d: any, air: any, uf: number, over: Partial<any> = {}) {
  return {
    precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: d.comuna, piePercent: d.piePct / 100, tasaCredito: d.tasaInteres / 100, plazoCredito: d.plazoCredito,
    airbnbData: air, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador, tipoEdificio: d.tipoEdificio,
    habilitacion: d.habilitacion, adminPro: d.adminPro === true, adrOverride: null, occOverride: null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf, ...over,
  };
}

async function main() {
  const ids = ["11a6dc52", "c925e85a", "8f4493ed", "2e2c9e29"]; // STR-ganadores en auto (93.9%, 47%, 26.6%, 20.4%)
  const { data } = await sb.from("analisis").select("id, input_data, results, comuna").eq("tipo_analisis", "short-term");
  const rowsOut: any[] = [];
  for (const r of (data as any[]) ?? []) {
    if (!ids.some((p) => r.id.startsWith(p))) continue;
    const d = r.input_data, uf = d.precioCompra / d.precioCompraUF, air = buildAirbnbData(r.results.airbnbRaw, uf);
    for (const modo of ["auto", "administrador"] as const) {
      for (const occ of [null, 0.55, 0.50, 0.45] as (number | null)[]) {
        const over: any = { modoGestion: modo, adminPro: modo === "administrador", comisionAdministrador: 0.20 };
        if (occ != null) over.occOverride = occ;
        const res = calcShortTerm(buildInputs(d, air, uf, over) as any);
        rowsOut.push({
          id: r.id.slice(0, 8), comuna: r.comuna, modo: modo === "auto" ? "auto" : "admin", occ: occ ?? "real",
          sobrePct: +(res.comparativa.sobreRentaPct * 100).toFixed(1), reco: res.recomendacionModalidad,
        });
      }
    }
  }
  console.table(rowsOut);
  const mid = rowsOut.filter((o) => o.sobrePct >= -10 && o.sobrePct <= 15);
  console.log(`\ncombos en banda media [-10%,+15%]: ${mid.length}/${rowsOut.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
