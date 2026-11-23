// ─────────────────────────────────────────────────────────────────────────────
// GATE DE LA RAMA · B4 DE PUNTA A PUNTA CONTRA LA BASE (24-nov-2026; aprobado por Fabrizio con condiciones). Recorre, con el código de la
// rama y las mismas funciones que despachan la ruta del admin y la de la persona: firmar, presentar, contraoferta, proponer otro monto,
// aceptar, comunicada, retirar, vencer, la respuesta fuera de plazo y reactivarla; lee la base después de cada paso y al final BORRA
// todo lo que creó y verifica que no quedó nada.
// Condiciones (y cómo se cumplen):
//   · solo la CUENTA DE QA (67977905…, marcada en test_accounts) y su depto de prueba 4f543801: se verifican antes de tocar nada;
//   · solo ofertas marcadas es_prueba (el depto lo es; cada fila creada se revisa);
//   · nunca contra producción: se niega si VERCEL_ENV es «production»; corre en local con el código de la rama;
//   · ningún correo: los avisos van sin envío (deps null); el WhatsApp queda como tarea y se borra con lo demás;
//   · la oferta 715d5df2 y el depto a67843d8 no se tocan (se verifica que no cambiaron).
// Dos seguros (24-nov-2026, Fabrizio: la base es la de producción):
//   · al empezar deja una MARCA en `config` (invierte_recorrido_b4_en_curso: desde cuándo, la etapa del depto, el documento creado); si
//     encuentra una marca o restos de una corrida anterior (ofertas de la cuenta de QA, la preaprobación de prueba, el depto en otra etapa),
//     SE NIEGA a correr. `--limpiar` borra esos restos a partir de la marca y verifica que no quedó nada;
//   · la limpieza corre también si se interrumpe a la mitad (Ctrl+C, SIGTERM, una excepción): la misma función, una sola vez. Si lo
//     matan sin aviso, la marca queda y la próxima corrida se niega hasta limpiar.
// Para probar los seguros (invierte-b4-recorrido-seguros.ts): RECORRIDO_CORTAR_EN=<paso> se interrumpe solo después de ese paso, y con
// RECORRIDO_CORTE_DURO=1 se corta sin limpiar (como un kill -9).
// Uso: node --env-file=.env.local --import tsx scripts/eval/invierte-b4-recorrido.ts [--limpiar]   (npm run gate:invierte-b4)
// ─────────────────────────────────────────────────────────────────────────────
import { createServiceClient } from "../../src/lib/supabase/service";
import { accionOfertaAdmin, firmarRonda, noGracias, retirarOferta } from "../../src/lib/invierte-v2/b4-servidor";
import { asegurarRango, firmarOferta } from "../../src/lib/invierte-v2/rango-servidor";

const QA = "67977905-a84f-4ae5-8a08-28eb2d5d4b6f";
const AVISO = "4f543801-000f-4d45-87b8-b245b4b014fb";
const INTOCABLE_OFERTA = "715d5df2-62a3-4882-86dc-3e443a2bbd4f";
const INTOCABLE_AVISO = "a67843d8-dae1-4844-aa01-326c9141b8b2";
const ADMIN = { id: QA, email: "recorrido-b4@qa" }; // quien firma los pasos del admin en la prueba (un usuario real de auth: la cuenta de QA)
const USER = { id: QA, email: null };

const admin = createServiceClient();
export const MARCA = "invierte_recorrido_b4_en_curso";
const BANCO_PRUEBA = "Banco de prueba (recorrido B4)";
interface Marca { t0: string; deptoId: string; etapa: string | null; docId: string | null }
let marcaActual: Marca | null = null;
let limpiando: Promise<void> | null = null;

async function leerMarca(): Promise<Marca | null> {
  const { data } = await admin.from("config").select("value").eq("key", MARCA).maybeSingle();
  try { return data?.value ? (JSON.parse(data.value as string) as Marca) : null; } catch { return null; }
}
async function guardarMarca(m: Marca): Promise<void> {
  const { error } = await admin.from("config").upsert({ key: MARCA, value: JSON.stringify(m), updated_at: new Date().toISOString().replace("Z", "") }, { onConflict: "key" });
  if (error) throw new Error(`no se pudo dejar la marca: ${error.message}`);
}

/** Los restos de una corrida anterior: la marca, ofertas de la cuenta de QA o la preaprobación de prueba. */
async function restos(): Promise<string[]> {
  const [m, { count: of }, { count: docs }] = await Promise.all([
    leerMarca(),
    admin.from("inv_ofertas").select("id", { count: "exact", head: true }).eq("user_id", QA),
    admin.from("inv_documentos").select("id", { count: "exact", head: true }).eq("user_id", QA).eq("banco", BANCO_PRUEBA),
  ]);
  return [m ? `la marca de una corrida del ${m.t0}` : null, of ? `${of} oferta(s) de la cuenta de QA` : null, docs ? `${docs} preaprobación(es) de prueba` : null].filter((x): x is string => !!x);
}

/** LA LIMPIEZA: todo lo creado desde la marca, el depto a su etapa, y la marca al final. Idempotente; corre una sola vez a la vez. */
function limpiar(m: Marca | null = marcaActual): Promise<void> {
  if (limpiando) return limpiando;
  limpiando = (async () => {
    if (!m) return;
    const { data: creadas } = await admin.from("inv_ofertas").select("id").eq("user_id", QA);
    const ids = (creadas ?? []).map((x) => x.id as string);
    if (ids.length) {
      await admin.from("inv_ofertas").update({ anterior_id: null }).in("id", ids);
      await admin.from("inv_ofertas").delete().in("id", ids);
    }
    await admin.from("inv_tareas").delete().eq("user_id", QA).gte("created_at", m.t0);
    await admin.from("inv_bitacora").delete().eq("user_id", QA).gte("created_at", m.t0);
    await admin.from("inv_documentos").delete().eq("user_id", QA).eq("banco", BANCO_PRUEBA);
    if (m.docId) await admin.from("inv_documentos").delete().eq("id", m.docId);
    if (m.etapa != null) await admin.from("inv_deptos").update({ etapa: m.etapa }).eq("id", m.deptoId);
    await admin.from("config").delete().eq("key", MARCA);
  })();
  return limpiando;
}

/** Interrumpido a la mitad (Ctrl+C, SIGTERM o una excepción suelta): limpia y sale. */
function alInterrumpir(motivo: string) {
  console.log(`  … interrumpido (${motivo}): limpiando`);
  void limpiar().then(async () => { await verificarLimpio(marcaActual); console.log("  interrumpido: limpieza hecha"); process.exitCode = 130; }, () => { process.exitCode = 1; });
}
for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"] as const) process.on(sig, () => alInterrumpir(sig));
process.on("uncaughtException", (e) => alInterrumpir(`excepción: ${e instanceof Error ? e.message : String(e)}`));

/** Después de un paso: ¿hay que cortar acá para probar los seguros? */
async function cortarSiToca(paso: number): Promise<void> {
  if (Number(process.env.RECORRIDO_CORTAR_EN) !== paso) return;
  if (process.env.RECORRIDO_CORTE_DURO === "1") { console.log(`  … corte duro después del paso ${paso} (sin limpiar)`); process.exit(137); }
  process.emit("SIGINT");
  await new Promise(() => undefined); // el recorrido no sigue: la limpieza corre y el proceso termina solo
}

async function verificarLimpio(m: Marca | null): Promise<boolean> {
  if (!m) return true;
  const [quedan, { data: d1 }] = await Promise.all([restos(), admin.from("inv_deptos").select("etapa").eq("id", m.deptoId).single()]);
  const ok = !quedan.length && (m.etapa == null || d1?.etapa === m.etapa);
  espera(ok, "limpieza: no quedó la marca, ninguna oferta de la cuenta de QA ni la preaprobación de prueba, y el depto volvió a su etapa", { quedan, etapa: d1?.etapa, esperada: m.etapa });
  return ok;
}
const fallas: string[] = [];
const F = (m: string) => { fallas.push(m); console.log(`  ✗ ${m}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);

async function oferta(id: string): Promise<Record<string, unknown>> {
  const { data } = await admin.from("inv_ofertas").select("*").eq("id", id).single();
  return data as Record<string, unknown>;
}
async function ultimaRonda(deptoId: string): Promise<Record<string, unknown>> {
  const { data } = await admin.from("inv_ofertas").select("*").eq("depto_id", deptoId).order("ronda", { ascending: false }).limit(1).single();
  return data as Record<string, unknown>;
}
async function tareaPendiente(tipo: string): Promise<boolean> {
  const { count } = await admin.from("inv_tareas").select("id", { count: "exact", head: true }).eq("user_id", QA).eq("aviso_id", AVISO).eq("tipo", tipo).eq("estado", "pendiente");
  return (count ?? 0) > 0;
}
function espera(cond: boolean, paso: string, detalle: unknown) { if (cond) ok(paso); else F(`${paso} (${JSON.stringify(detalle).slice(0, 300)})`); }

async function main(): Promise<number> {
  if (process.env.VERCEL_ENV === "production") { console.log("  ✗ se niega: VERCEL_ENV=production"); return 1; }
  // `--limpiar`: borra los restos de una corrida anterior a partir de su marca.
  if (process.argv.includes("--limpiar")) {
    const m = await leerMarca();
    const r = await restos();
    if (!r.length) { console.log("  ✓ no hay restos que limpiar"); return 0; }
    const d = m ?? { t0: new Date(Date.now() - 864e5).toISOString(), deptoId: "", etapa: null, docId: null };
    await limpiar(d);
    return (await verificarLimpio(d)) ? 0 : 1;
  }
  // Seguro 1: con restos de una corrida anterior, no corre.
  const quedan = await restos();
  if (quedan.length) { console.log(`  ✗ se niega: hay restos de una corrida anterior sin limpiar (${quedan.join("; ")}). Corre: npm run gate:invierte-b4 -- --limpiar`); return 1; }
  // ── Antes de tocar nada: la cuenta de QA, su depto de prueba y lo intocable ──
  const [{ data: ta }, { data: d0 }, { data: intocable0 }, { data: vivas0 }] = await Promise.all([
    admin.from("test_accounts").select("user_id").eq("user_id", QA).maybeSingle(),
    admin.from("inv_deptos").select("*").eq("user_id", QA).eq("aviso_id", AVISO).maybeSingle(),
    admin.from("inv_ofertas").select("estado, updated_at").eq("id", INTOCABLE_OFERTA).maybeSingle(),
    admin.from("inv_ofertas").select("id").eq("user_id", QA).limit(1),
  ]);
  if (!ta || !d0 || d0.es_prueba !== true) { console.log("  ✗ se niega: la cuenta de QA o su depto 4f543801 no están marcados de prueba"); return 1; }
  if ((vivas0 ?? []).length) { console.log("  ✗ se niega: la cuenta de QA ya tiene ofertas (alguien la está usando)"); return 1; }
  const deptoId = d0.id as string;
  const t0 = new Date(Date.now() - 1000).toISOString();
  marcaActual = { t0, deptoId, etapa: (d0.etapa as string | null) ?? null, docId: null };
  await guardarMarca(marcaActual);
  try {
    // ── Preparación: una preaprobación aprobada de prueba y el depto en «listo» (se restaura al final) ──
    const venceDoc = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const { data: doc, error: ed } = await admin.from("inv_documentos").insert({ user_id: QA, tipo: "preaprobacion", estado: "aprobada", banco: BANCO_PRUEBA, monto_aprobado_uf: 9000, vigente_hasta: venceDoc, revisado_por: ADMIN.email, revisado_at: new Date().toISOString(), es_prueba: true }).select("id").single();
    if (ed || !doc) throw new Error(`preaprobación de prueba: ${ed?.message}`);
    marcaActual = { ...marcaActual, docId: doc.id as string };
    await guardarMarca(marcaActual);
    const { error: ee } = await admin.from("inv_deptos").update({ etapa: "listo" }).eq("id", deptoId);
    if (ee) throw new Error(`depto a listo: ${ee.message}`);

    // 1 · Firmar la primera oferta (la persona).
    const r0 = await asegurarRango(admin, QA, AVISO, new Date(), { nueva: true });
    if (!r0 || r0.estado !== "borrador") throw new Error(`sin borrador: ${JSON.stringify(r0)}`);
    const f1 = await firmarOferta(admin, USER, AVISO, { montoUF: r0.recomendadoUF, acepto: true, leyo: true }, null);
    let o1 = await ultimaRonda(deptoId);
    espera(f1.ok && o1.estado === "firmada" && o1.es_prueba === true && (await tareaPendiente("presentar_oferta")), "1 · firmada, de prueba, con la tarea de presentar", { f1, estado: o1.estado });

    // 2 · Presentar (admin).
    const p1 = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o1.id }, null);
    o1 = await oferta(o1.id as string);
    espera(p1.ok && o1.estado === "presentada" && !!o1.vigente_hasta && !(await tareaPendiente("presentar_oferta")), "2 · presentada con su vencimiento y la tarea cerrada", { p1, estado: o1.estado });
    await cortarSiToca(2);

    // 3 · Contraoferta con fecha y nota vacías (admin), como en el preview.
    const pide = Math.round(Number(o1.monto_uf)) + 80;
    const c1 = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o1.id, tipo: "contraoferta", montoUF: pide, nota: "", vence: null }, null);
    o1 = await oferta(o1.id as string);
    espera(c1.ok && o1.estado === "contraoferta" && Number(o1.contraoferta_uf) === pide && o1.contraoferta_vence != null && o1.sugerida_uf != null && o1.contraoferta_nota == null, "3 · contraoferta guardada con su vencimiento y lo que sugiere Franco", { c1, o1: { e: o1.estado, c: o1.contraoferta_uf, s: o1.sugerida_uf } });

    // 4 · Proponer otro monto (la persona, por Revisa y firma): ronda nueva, la contraoferta reemplazada, tarea de presentar.
    const propone = Math.round(Number(o1.monto_uf)) + 30;
    const pr = await firmarRonda(admin, USER, AVISO, { desdeId: o1.id, montoUF: propone, acepto: true, leyo: true }, null);
    const o2 = await ultimaRonda(deptoId);
    const o1b = await oferta(o1.id as string);
    espera(pr.ok && o2.estado === "firmada" && Number(o2.monto_uf) === propone && o2.anterior_id === o1.id && o1b.estado === "reemplazada" && (await tareaPendiente("presentar_oferta")), "4 · otro monto: ronda nueva firmada, la contraoferta reemplazada", { pr, o2: { e: o2.estado, m: o2.monto_uf }, ant: o1b.estado });
    await cortarSiToca(4);

    // 5 · Presentar la ronda 2 y otra contraoferta; aceptar su precio (la persona): ronda 3 con la tarea de comunicar.
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o2.id }, null);
    const pide2 = propone + 40;
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o2.id, tipo: "contraoferta", montoUF: pide2, nota: "Prueba", vence: null }, null);
    const ac = await firmarRonda(admin, USER, AVISO, { desdeId: o2.id, montoUF: pide2, acepto: true, leyo: true }, null);
    const o3 = await ultimaRonda(deptoId);
    espera(ac.ok && ac.tipo === "aceptar" && o3.estado === "firmada" && Number(o3.monto_uf) === pide2 && (await tareaPendiente("comunicar_aceptacion")), "5 · aceptar su precio: ronda firmada con la tarea de comunicar", { ac, o3: { e: o3.estado, m: o3.monto_uf } });

    // 6 · Comunicada (admin): aceptada sujeta a visita, sin otro plazo.
    const cm = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_comunicada", ofertaId: o3.id }, null);
    const o3b = await oferta(o3.id as string);
    espera(cm.ok && o3b.estado === "aceptada_sujeta" && o3b.vigente_hasta == null && !(await tareaPendiente("comunicar_aceptacion")), "6 · comunicada: aceptada sujeta a visita", { cm, e: o3b.estado });

    // 7 · Retirar (la persona) desde aceptada: retirada, con la tarea de avisarle a quien vende.
    const rt = await retirarOferta(admin, USER, AVISO, null);
    const o3c = await oferta(o3.id as string);
    espera(rt.ok && o3c.estado === "retirada" && o3c.retirada_desde === "aceptada_sujeta" && (await tareaPendiente("avisar_retiro")), "7 · retirada desde aceptada, con el aviso a quien vende", { rt, e: o3c.estado });

    // 8 · Una oferta nueva, presentada y vencida con la pasada a mano (solo fuera de producción y de prueba).
    const r4 = await asegurarRango(admin, QA, AVISO, new Date(), { nueva: true });
    const f4 = await firmarOferta(admin, USER, AVISO, { montoUF: r4?.recomendadoUF, acepto: true, leyo: true }, null);
    const o4 = await ultimaRonda(deptoId);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o4.id }, null);
    const vc = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_prueba_pasada", ofertaId: o4.id, modo: "vencer" }, null);
    const o4b = await oferta(o4.id as string);
    espera(f4.ok && vc.ok && o4b.estado === "sin_acuerdo" && o4b.sin_acuerdo_motivo === "vencida", "8 · una ronda nueva presentada y vencida con la pasada a mano", { f4, vc, e: o4b.estado });
    await cortarSiToca(8);

    // 9 · Respuesta fuera de plazo (admin): queda cargada, la oferta NO se reactiva sola.
    const tf = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o4.id, tipo: "aceptada" }, null);
    const o4c = await oferta(o4.id as string);
    espera(tf.ok && o4c.estado === "sin_acuerdo" && o4c.respuesta_tardia === "aceptada_sujeta" && o4c.tardia_decision == null, "9 · aceptación fuera de plazo cargada, sin reactivar nada", { tf, e: o4c.estado, t: o4c.respuesta_tardia });

    // 10 · Reactivarla firmando (la persona): ronda nueva para comunicar; después «No, gracias» ya no aplica a esa.
    const re = await firmarRonda(admin, USER, AVISO, { desdeId: o4.id, montoUF: Math.round(Number(o4.monto_uf)), acepto: true, leyo: true }, null);
    const o5 = await ultimaRonda(deptoId);
    const o4d = await oferta(o4.id as string);
    const ng = await noGracias(admin, USER, AVISO, null);
    espera(re.ok && re.tipo === "reactivar" && o5.estado === "firmada" && o4d.tardia_decision === "reactivar" && !ng.ok, "10 · reactivarla firmando; «No, gracias» ya no aplica", { re, o5: o5.estado, d: o4d.tardia_decision, ng });

    // 11 · Retirar la reactivada antes de comunicar.
    const rt2 = await retirarOferta(admin, USER, AVISO, null);
    const o5b = await oferta(o5.id as string);
    espera(rt2.ok && o5b.estado === "retirada" && o5b.retirada_desde === "firmada", "11 · retirar una ronda firmada", { rt2, e: o5b.estado });
  } catch (e) {
    F(`no terminó el recorrido: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    // ── Limpieza (la misma de una interrupción) y verificación: no quedó nada ──
    await limpiar();
    await verificarLimpio(marcaActual);
    const { data: intocable1 } = await admin.from("inv_ofertas").select("estado, updated_at").eq("id", INTOCABLE_OFERTA).maybeSingle();
    espera(JSON.stringify(intocable1) === JSON.stringify(intocable0), `la oferta ${INTOCABLE_OFERTA.slice(0, 8)} (${INTOCABLE_AVISO.slice(0, 8)}) no cambió`, { antes: intocable0, despues: intocable1 });
  }
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ B4 de punta a punta verde");
  return fallas.length ? 1 : 0;
}

// Sale con `process.exitCode`, sin process.exit: en Windows, cortar con conexiones abiertas a la base revienta libuv (assert de
// async.c, código 127 o 3221226505) aunque el resultado esté bien (24-nov-2026).
if (require.main === module) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e); void limpiar().then(() => { process.exitCode = 1; }); });
