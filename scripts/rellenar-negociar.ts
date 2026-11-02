// ─────────────────────────────────────────────────────────────────────────────
// El relleno de una vez de los que convienen si negocias (02-nov-2026, migración 20261102_negociar_explorar): a cada fila de
// avisos_evaluados con algún Ajustar, sus columnas negociar_20 / negociar_30 —el descuento mínimo a Comprar con pie 20 % y 30 %,
// a 30 años, tasa del motor— con la sonda y lo que la fila ya resolvió (src/lib/avisos/negociar.ts). Sin consultas en vivo ni
// fichas: lee la fila y el aviso (RPC negociar_filas), calcula y escribe de a lotes (rellenar_negociar, que no pisa una fila que
// el cron reevaluó mientras tanto). Después el cron las escribe solo. Mide lo que cuesta el cálculo por aviso: lo que suma a la
// noche.
//
//   node --env-file=.env.local --import tsx scripts/rellenar-negociar.ts
//   (si se corta, se vuelve a lanzar: reescribe lo ya escrito con la misma cuenta)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { candidatoDeFila, type FilaRpc } from "../src/lib/guia/semanal-candidatos";
import { evaluarNegociar } from "../src/lib/avisos/negociar";

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
  let leidas = 0, escritas = 0, con20 = 0, con30 = 0, msCalculo = 0;
  const asOf = new Date();
  for (;;) {
    const { data, error } = await sb.rpc("negociar_filas", { desde_id: desde, n: PAGINA });
    if (error) throw new Error(`negociar_filas: ${error.message}`);
    const filas = (data ?? []) as Array<FilaRpc & { evaluado_at: string; veredicto_20: string | null; veredicto_30: string | null }>;
    if (filas.length === 0) break;
    desde = filas[filas.length - 1].id;
    leidas += filas.length;
    const lote: Array<Record<string, unknown>> = [];
    for (const f of filas) {
      const t = performance.now();
      const e = evaluarNegociar(candidatoDeFila(f), f, cfg, asOf);
      msCalculo += performance.now() - t;
      if (e.negociar_20) con20++;
      if (e.negociar_30) con30++;
      lote.push({ aviso_id: f.id, evaluado_at: f.evaluado_at, ...e });
    }
    for (let i = 0; i < lote.length; i += LOTE) {
      const { data: n, error: e2 } = await sb.rpc("rellenar_negociar", { filas: lote.slice(i, i + LOTE) });
      if (e2) throw new Error(`rellenar_negociar: ${e2.message}`);
      escritas += Number(n) || 0;
    }
    console.log(`leídas ${leidas} · escritas ${escritas} · con descuento: pie 20 % ${con20}, pie 30 % ${con30} · ${Math.round((Date.now() - t0) / 1000)} s`);
    if (filas.length < PAGINA) break;
  }
  console.log(JSON.stringify({ leidas, escritas, con20, con30, msPorAviso: leidas ? Math.round((msCalculo / leidas) * 100) / 100 : null, msCalculo: Math.round(msCalculo), s: Math.round((Date.now() - t0) / 1000) }));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
