// ─────────────────────────────────────────────────────────────────────────────
// El relleno de una vez de los plazos cortos (27-nov-2026, la asesoría en el mapa): a cada fila de avisos_evaluados, sus columnas
// _20_20 y _20_15 —pie 20 %, 20 y 15 años, tasa de mercado—, con la sonda y lo que la fila ya resolvió (estandar-deptos.ts ›
// evaluarPlazosCortos). Sin consultas en vivo ni fichas: lee la fila y el aviso (RPC estandar25_filas, la misma del relleno de
// 25 años), calcula y escribe de a lotes (rellenar_plazos_cortos, que no pisa una fila que el cron reevaluó mientras tanto).
// Después el cron las escribe solo. Escribe en la base: se corre con el OK de Fabrizio.
//
//   node --env-file=.env.local --import tsx scripts/rellenar-plazos-cortos.ts
//   (si se corta, se vuelve a lanzar: reescribe lo ya escrito con la misma cuenta)
//   --seco: lee y calcula todo, NO escribe nada (para medir cuánto demora y cuántas filas escribiría).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { candidatoDeFila, type FilaRpc } from "../src/lib/guia/semanal-candidatos";
import { evaluarPlazosCortos } from "../src/lib/avisos/estandar-deptos";

const PAGINA = 1000;
const LOTE = 250;
const SECO = process.argv.includes("--seco");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const t0 = Date.now();
  const { data: cfgRows } = await sb.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map((cfgRows ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const cfg = { uf: m.get("uf_value")!, tasa: m.get("tasa_hipotecaria")! };
  if (!(cfg.uf > 0) || !(cfg.tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");

  let desde = "00000000-0000-0000-0000-000000000000";
  let leidas = 0, escritas = 0, sinEvaluar = 0, comprar20 = 0, comprar15 = 0;
  const asOf = new Date();
  for (;;) {
    const { data, error } = await sb.rpc("estandar25_filas", { desde_id: desde, n: PAGINA });
    if (error) throw new Error(`estandar25_filas: ${error.message}`);
    const filas = (data ?? []) as Array<FilaRpc & { evaluado_at: string }>;
    if (filas.length === 0) break;
    desde = filas[filas.length - 1].id;
    leidas += filas.length;
    const lote: Array<Record<string, unknown>> = [];
    for (const f of filas) {
      const e = evaluarPlazosCortos(candidatoDeFila(f), cfg, asOf);
      if (e.veredicto_20_20 == null) sinEvaluar++;
      if (e.veredicto_20_20 === "COMPRAR") comprar20++;
      if (e.veredicto_20_15 === "COMPRAR") comprar15++;
      lote.push({ aviso_id: f.id, evaluado_at: f.evaluado_at, ...e });
    }
    for (let i = 0; !SECO && i < lote.length; i += LOTE) {
      const { data: n, error: e2 } = await sb.rpc("rellenar_plazos_cortos", { filas: lote.slice(i, i + LOTE) });
      if (e2) throw new Error(`rellenar_plazos_cortos: ${e2.message}`);
      escritas += Number(n) || 0;
    }
    if (SECO) escritas += lote.length;
    console.log(`${SECO ? "[seco] " : ""}leídas ${leidas} · escritas ${escritas} · Comprar a 20 ${comprar20} · a 15 ${comprar15} · sin evaluar ${sinEvaluar} · ${Math.round((Date.now() - t0) / 1000)} s`);
    if (filas.length < PAGINA) break;
  }
  console.log(JSON.stringify({ seco: SECO, leidas, escritas, sinEvaluar, comprar20, comprar15, s: Math.round((Date.now() - t0) / 1000) }));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
