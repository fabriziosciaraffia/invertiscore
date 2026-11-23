// ─────────────────────────────────────────────────────────────────────────────
// LOS DOS SEGUROS DEL GATE B4 (24-nov-2026, Fabrizio: el recorrido escribe en la base de producción). Corre el recorrido como proceso
// aparte y revisa la base después de cada caso:
//   1 · RESTOS: con la marca de una corrida anterior sin limpiar, se niega, no crea nada ni mueve el depto; «--limpiar» los borra.
//   2 · INTERRUPCIÓN: cortado a la mitad (después del paso 4, con la misma señal que un Ctrl+C), limpia y no queda nada.
//   3 · CORTE DURO: matado sin aviso (después del paso 2), la marca queda; la corrida siguiente se niega; «--limpiar» deja todo limpio.
// Uso: node --env-file=.env.local --import tsx scripts/eval/invierte-b4-recorrido-seguros.ts   (npm run gate:invierte-b4-seguros)
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createServiceClient } from "../../src/lib/supabase/service";

const QA = "67977905-a84f-4ae5-8a08-28eb2d5d4b6f";
const AVISO = "4f543801-000f-4d45-87b8-b245b4b014fb";
const MARCA = "invierte_recorrido_b4_en_curso";
const RAIZ = join(__dirname, "..", "..");
const admin = createServiceClient();
const fallas: string[] = [];
const espera = (cond: boolean, m: string, d: unknown) => { if (cond) console.log(`  ✓ ${m}`); else { fallas.push(m); console.log(`  ✗ ${m} (${JSON.stringify(d).slice(0, 400)})`); } };

function recorrido(env: Record<string, string> = {}, args: string[] = []): { codigo: number | null; salida: string } {
  const r = spawnSync(process.execPath, ["--env-file=.env.local", "--import", "tsx", "scripts/eval/invierte-b4-recorrido.ts", ...args], { cwd: RAIZ, env: { ...process.env, ...env }, encoding: "utf8", timeout: 600000 });
  return { codigo: r.status, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
async function estado(): Promise<{ marca: boolean; ofertas: number; docs: number; etapa: string | null }> {
  const [{ data: m }, { count: o }, { count: d }, { data: dp }] = await Promise.all([
    admin.from("config").select("key").eq("key", MARCA).maybeSingle(),
    admin.from("inv_ofertas").select("id", { count: "exact", head: true }).eq("user_id", QA),
    admin.from("inv_documentos").select("id", { count: "exact", head: true }).eq("user_id", QA).like("banco", "Banco de prueba%"),
    admin.from("inv_deptos").select("etapa").eq("user_id", QA).eq("aviso_id", AVISO).single(),
  ]);
  return { marca: !!m, ofertas: o ?? 0, docs: d ?? 0, etapa: (dp?.etapa as string | null) ?? null };
}

async function main(): Promise<number> {
  const antes = await estado();
  if (antes.marca || antes.ofertas || antes.docs) { console.log(`  ✗ se niega: ya hay restos antes de probar los seguros (${JSON.stringify(antes)})`); return 1; }
  const etapa0 = antes.etapa;
  const { data: dp } = await admin.from("inv_deptos").select("id").eq("user_id", QA).eq("aviso_id", AVISO).single();

  // 1 · RESTOS: una marca de una corrida anterior.
  await admin.from("config").upsert({ key: MARCA, value: JSON.stringify({ t0: new Date().toISOString(), deptoId: dp?.id, etapa: etapa0, docId: null }), updated_at: new Date().toISOString().replace("Z", "") }, { onConflict: "key" });
  const r1 = recorrido();
  const e1 = await estado();
  espera(r1.codigo === 1 && /se niega: hay restos de una corrida anterior/.test(r1.salida) && e1.ofertas === 0 && e1.docs === 0 && e1.etapa === etapa0, "1 · con restos de una corrida anterior se niega, sin crear nada ni mover el depto", { codigo: r1.codigo, e1, salida: r1.salida.split("\n").slice(-4) });
  const l1 = recorrido({}, ["--limpiar"]);
  const e1b = await estado();
  espera(l1.codigo === 0 && !e1b.marca, "1 · «--limpiar» borra los restos", { codigo: l1.codigo, e1b });

  // 2 · INTERRUPCIÓN a la mitad (la señal de un Ctrl+C después del paso 4): limpia antes de salir.
  const r2 = recorrido({ RECORRIDO_CORTAR_EN: "4" });
  const e2 = await estado();
  espera(r2.codigo === 130 && /interrumpido: limpieza hecha/.test(r2.salida) && /✓ 4 ·/.test(r2.salida) && !/✓ 5 ·/.test(r2.salida) && !e2.marca && e2.ofertas === 0 && e2.docs === 0 && e2.etapa === etapa0, "2 · interrumpido después del paso 4, limpia y no queda nada", { codigo: r2.codigo, e2, salida: r2.salida.split("\n").slice(-5) });

  // 3 · CORTE DURO (sin limpiar, como un kill -9): la marca queda; la siguiente se niega; «--limpiar» deja todo limpio.
  const r3 = recorrido({ RECORRIDO_CORTAR_EN: "2", RECORRIDO_CORTE_DURO: "1" });
  const e3 = await estado();
  const r3b = recorrido();
  const e3b = await estado();
  const l3 = recorrido({}, ["--limpiar"]);
  const e3c = await estado();
  // Un corte duro sale con cualquier código distinto de 0 (en Windows, process.exit puede salir con el de libuv): lo que importa es la marca.
  espera(r3.codigo !== 0 && e3.marca && e3.ofertas > 0, "3 · cortado sin aviso, deja la marca y sus restos", { codigo: r3.codigo, e3 });
  espera(r3b.codigo === 1 && /se niega: hay restos/.test(r3b.salida) && e3b.ofertas === e3.ofertas, "3 · la corrida siguiente se niega y no agrega nada", { codigo: r3b.codigo, e3b });
  espera(l3.codigo === 0 && !e3c.marca && e3c.ofertas === 0 && e3c.docs === 0 && e3c.etapa === etapa0, "3 · «--limpiar» deja todo como estaba", { codigo: l3.codigo, e3c });

  // Pase lo que pase, no deja nada.
  const fin = await estado();
  if (fin.marca || fin.ofertas || fin.docs || fin.etapa !== etapa0) { recorrido({}, ["--limpiar"]); }
  const fin2 = await estado();
  espera(!fin2.marca && fin2.ofertas === 0 && fin2.docs === 0 && fin2.etapa === etapa0, "al final no queda nada de la prueba de los seguros", fin2);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ los seguros del gate B4 en verde");
  return fallas.length ? 1 : 0;
}
main().then((c) => { process.exitCode = c; }, (e) => { console.error(e); process.exitCode = 1; });
