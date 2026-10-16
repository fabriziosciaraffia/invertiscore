// ─────────────────────────────────────────────────────────────────────────────
// El relleno de una vez del estándar de /deptos (16-oct-2026): a cada fila de avisos_evaluados, sus columnas _25 —pie
// 20 % y 30 %, 25 años, tasa de mercado—, con la sonda y lo que la fila ya resolvió (estandar-deptos.ts). Sin
// consultas en vivo ni fichas: lee la fila y el aviso (RPC estandar25_filas), calcula y escribe de a lotes
// (rellenar_estandar25, que no pisa una fila que el cron reevaluó mientras tanto). Después el cron las escribe solo.
//
//   node --env-file=.env.local --import tsx scripts/rellenar-estandar-25.ts
//   (si se corta, se vuelve a lanzar: reescribe lo ya escrito con la misma cuenta)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { candidatoDeFila, type FilaRpc } from "../src/lib/guia/semanal-candidatos";
import { evaluarEstandar25 } from "../src/lib/avisos/estandar-deptos";

const PAGINA = 1000;
const LOTE = 250;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const t0 = Date.now();
  const { data: cfgRows } = await sb.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map((cfgRows ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const cfg = { uf: m.get("uf_value")!, tasa: m.get("tasa_hipotecaria")! };
  if (!(cfg.uf > 0) || !(cfg.tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");

  let desde = "00000000-0000-0000-0000-000000000000";
  let leidas = 0, escritas = 0, sinEvaluar = 0, comprar20 = 0, comprar30 = 0;
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
      const e = evaluarEstandar25(candidatoDeFila(f), cfg, asOf);
      if (e.veredicto_20_25 == null) sinEvaluar++;
      if (e.veredicto_20_25 === "COMPRAR") comprar20++;
      if (e.veredicto_30_25 === "COMPRAR") comprar30++;
      lote.push({ aviso_id: f.id, evaluado_at: f.evaluado_at, ...e });
    }
    for (let i = 0; i < lote.length; i += LOTE) {
      const { data: n, error: e2 } = await sb.rpc("rellenar_estandar25", { filas: lote.slice(i, i + LOTE) });
      if (e2) throw new Error(`rellenar_estandar25: ${e2.message}`);
      escritas += Number(n) || 0;
    }
    console.log(`leídas ${leidas} · escritas ${escritas} · Comprar 20 % ${comprar20} · 30 % ${comprar30} · sin evaluar ${sinEvaluar} · ${Math.round((Date.now() - t0) / 1000)} s`);
    if (filas.length < PAGINA) break;
  }
  console.log(JSON.stringify({ leidas, escritas, sinEvaluar, comprar20, comprar30, s: Math.round((Date.now() - t0) / 1000) }));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
