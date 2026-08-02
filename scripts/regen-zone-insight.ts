// ============================================================================
// REGEN DE ZONE INSIGHT — operación de datos, por lote (paquete B · familia 3)
// ============================================================================
// La zona es una pieza cacheada APARTE de la prosa (columna `zone_insight`):
// regenerar ai_analysis no la toca. Este script la regenera por lote usando el
// MISMO núcleo que la ruta (buildZoneInsightForRow, extraído en el paquete B),
// con service-role. Sin este script, las zonas generadas con el prompt viejo
// (proyección 4%, tono comprador en BUSCAR OTRA, "el motor") quedan vivas.
//
//   # 1. Ver la lista sin tocar nada (default)
//   node --env-file=.env.local --import tsx scripts/regen-zone-insight.ts --solo=id1,id2
//
//   # 2. Regenerar de verdad
//   node --env-file=.env.local --import tsx scripts/regen-zone-insight.ts --solo=id1,id2 --write
//
// GARANTÍAS
// ---------
// · NO cobra créditos: la zona nunca ha tenido gate de crédito (la ruta tampoco
//   cobra), y acá ni siquiera pasamos por la ruta.
// · Solo regenera filas que YA tienen zone_insight cacheado (la zona de un
//   análisis sin cache se genera sola on-open con el prompt nuevo).
// · GUARD: si la generación vuelve con narrative vacío (fallo del modelo aguas
//   adentro devuelve strings vacíos), la fila queda con su zona vieja.
// · --solo es OBLIGATORIO: esta es una herramienta quirúrgica, no un barrido.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { buildZoneInsightForRow } from "@/lib/zone-insight-core";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const WRITE = process.argv.includes("--write");
const SOLO = (arg("solo") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  if (SOLO.length === 0) {
    console.error("--solo=id1,id2 es obligatorio (herramienta quirúrgica, no barrido).");
    process.exit(1);
  }

  const { data: rows, error } = await sb
    .from("analisis")
    .select("*")
    .not("zone_insight", "is", null);
  if (error) { console.error(error.message); process.exit(1); }

  const lote = (rows ?? []).filter((r) => SOLO.some((p) => r.id.startsWith(p)));
  const sinCache = SOLO.filter((p) => !lote.some((r) => r.id.startsWith(p)));

  console.log(`═══ REGEN ZONE INSIGHT · ${lote.length} con cache de ${SOLO.length} pedidos ═══`);
  if (sinCache.length) console.log(`  sin zone_insight cacheado (se generará solo on-open, nada que hacer): ${sinCache.join(", ")}`);
  for (const r of lote) console.log(`  ${r.id}  ${String(r.comuna ?? "—").padEnd(16)} ${(r.results as any)?.veredicto ?? "?"}`);

  if (!WRITE) {
    console.log(`\n  (dry-run — pasar --write para regenerar las ${lote.length})`);
    return;
  }

  let ok = 0;
  const fallidos: { id: string; motivo: string }[] = [];
  for (const [i, r] of lote.entries()) {
    try {
      const built = await buildZoneInsightForRow(r, sb);
      if ("error" in built) {
        fallidos.push({ id: r.id, motivo: built.error });
      } else if (!built.response.insight?.narrative_clp) {
        // Guard: la generación IA falló aguas adentro (devuelve strings vacíos) —
        // la zona vieja es mejor que una zona vacía.
        fallidos.push({ id: r.id, motivo: "narrative vacío — queda con su zona vieja" });
      } else {
        const { error: upErr } = await sb.from("analisis").update({ zone_insight: built.response }).eq("id", r.id);
        if (upErr) fallidos.push({ id: r.id, motivo: upErr.message });
        else ok++;
      }
    } catch (e: any) {
      fallidos.push({ id: r.id, motivo: e?.message ?? String(e) });
    }
    console.log(`  [${i + 1}/${lote.length}] ${r.id} ${fallidos.some((f) => f.id === r.id) ? "✗" : "✓"}`);
  }

  console.log(`\n═══ RESULTADO ═══\n  regeneradas: ${ok}\n  fallidas: ${fallidos.length}`);
  for (const f of fallidos) console.log(`    ${f.id} — ${f.motivo}`);
}

main();
