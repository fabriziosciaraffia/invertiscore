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
// Uso: node --env-file=.env.local --import tsx scripts/eval/invierte-b4-recorrido.ts   (npm run gate:invierte-b4)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { accionOfertaAdmin, firmarRonda, noGracias, retirarOferta } from "../../src/lib/invierte-v2/b4-servidor";
import { asegurarRango, firmarOferta } from "../../src/lib/invierte-v2/rango-servidor";

const QA = "67977905-a84f-4ae5-8a08-28eb2d5d4b6f";
const AVISO = "4f543801-000f-4d45-87b8-b245b4b014fb";
const INTOCABLE_OFERTA = "715d5df2-62a3-4882-86dc-3e443a2bbd4f";
const INTOCABLE_AVISO = "a67843d8-dae1-4844-aa01-326c9141b8b2";
const ADMIN = { id: QA, email: "recorrido-b4@qa" }; // quien firma los pasos del admin en la prueba (un usuario real de auth: la cuenta de QA)
const USER = { id: QA, email: null };

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
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
  let docId: string | null = null;
  try {
    // ── Preparación: una preaprobación aprobada de prueba y el depto en «listo» (se restaura al final) ──
    const venceDoc = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const { data: doc, error: ed } = await admin.from("inv_documentos").insert({ user_id: QA, tipo: "preaprobacion", estado: "aprobada", banco: "Banco de prueba", monto_aprobado_uf: 9000, vigente_hasta: venceDoc, revisado_por: ADMIN.email, revisado_at: new Date().toISOString(), es_prueba: true }).select("id").single();
    if (ed || !doc) throw new Error(`preaprobación de prueba: ${ed?.message}`);
    docId = doc.id as string;
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
    // ── Limpieza: todo lo que creó el recorrido, y el depto como estaba ──
    const { data: creadas } = await admin.from("inv_ofertas").select("id").eq("user_id", QA).gte("created_at", t0);
    const ids = (creadas ?? []).map((x) => x.id as string);
    if (ids.length) {
      await admin.from("inv_ofertas").update({ anterior_id: null }).in("id", ids);
      await admin.from("inv_ofertas").delete().in("id", ids);
    }
    await admin.from("inv_tareas").delete().eq("user_id", QA).gte("created_at", t0);
    await admin.from("inv_bitacora").delete().eq("user_id", QA).gte("created_at", t0);
    if (docId) await admin.from("inv_documentos").delete().eq("id", docId);
    await admin.from("inv_deptos").update({ etapa: d0.etapa }).eq("id", deptoId);
    // ── Verificación: no quedó nada ──
    const [{ count: cO }, { count: cT }, { count: cB }, { count: cD }, { data: d1 }, { data: intocable1 }] = await Promise.all([
      admin.from("inv_ofertas").select("id", { count: "exact", head: true }).eq("user_id", QA),
      admin.from("inv_tareas").select("id", { count: "exact", head: true }).eq("user_id", QA).gte("created_at", t0),
      admin.from("inv_bitacora").select("id", { count: "exact", head: true }).eq("user_id", QA).gte("created_at", t0),
      admin.from("inv_documentos").select("id", { count: "exact", head: true }).eq("user_id", QA).gte("created_at", t0),
      admin.from("inv_deptos").select("etapa").eq("id", deptoId).single(),
      admin.from("inv_ofertas").select("estado, updated_at").eq("id", INTOCABLE_OFERTA).maybeSingle(),
    ]);
    espera(!cO && !cT && !cB && !cD && d1?.etapa === d0.etapa, "limpieza: no quedó ninguna oferta, tarea, registro ni documento del recorrido, y el depto volvió a su etapa", { cO, cT, cB, cD, etapa: d1?.etapa });
    espera(JSON.stringify(intocable1) === JSON.stringify(intocable0), `la oferta ${INTOCABLE_OFERTA.slice(0, 8)} (${INTOCABLE_AVISO.slice(0, 8)}) no cambió`, { antes: intocable0, despues: intocable1 });
  }
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ B4 de punta a punta verde");
  return fallas.length ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
