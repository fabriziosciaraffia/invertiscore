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
//   · la visita antes del precio (24-nov-2026, pasos 12 a 17): pedirla, mantener la contraoferta, la base que rechaza sugerir bajo la
//     oferta sin una visita con un arreglo, el reporte que baja la sugerencia, proponer menos con el reporte de respaldo, ajustar bajo lo
//     aceptado y confirmar en firme solo con la confirmación explícita.
//   · después de la visita, toda oferta es en firme (24-nov-2026, pasos 16 a 21): las dos casillas, otra oferta después de retirar, la
//     aceptación que pasa directo a en firme y ya no se retira, la primera oferta que sigue sujeta, el ajuste y aceptar su precio.
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
import { accionVisitaAdmin, borrarFotosVisitas, confirmarEnFirme, pedirVisita } from "../../src/lib/invierte-v2/visita-servidor";
import { rondaDesde } from "../../src/lib/invierte-v2/b4-servidor";
import { ofertaDeFila } from "../../src/lib/invierte-v2/rango-servidor";
import { visitaParaRonda } from "../../src/lib/invierte-v2/visita-lectura";
import { deptoConAcuerdo } from "../../src/lib/invierte-v2/acuerdo-servidor";
import { fotoSana, rutaFotoVisita, urlFotoVisita } from "../../src/lib/invierte-v2/visita";

/** El ancho de un JPEG, leído de su encabezado SOF (sin decodificar la imagen); 0 si no es un JPEG. */
function anchoJpeg(b: Buffer): number {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 0;
  for (let k = 2; k + 9 < b.length;) {
    if (b[k] !== 0xff) return 0;
    const m = b[k + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return b.readUInt16BE(k + 7);
    k += 2 + b.readUInt16BE(k + 2);
  }
  return 0;
}

const QA = "67977905-a84f-4ae5-8a08-28eb2d5d4b6f";
const AVISO = "4f543801-000f-4d45-87b8-b245b4b014fb";
const INTOCABLE_OFERTA = "715d5df2-62a3-4882-86dc-3e443a2bbd4f";
const INTOCABLE_AVISO = "a67843d8-dae1-4844-aa01-326c9141b8b2";
const ADMIN = { id: QA, email: "recorrido-b4@qa" }; // quien firma los pasos del admin en la prueba (un usuario real de auth: la cuenta de QA)
const USER = { id: QA, email: null };

const admin = createServiceClient();
export const MARCA = "invierte_recorrido_b4_en_curso";
const BANCO_PRUEBA = "Banco de prueba (recorrido B4)";
interface Marca { t0: string; deptoId: string; etapa: string | null; docId: string | null; /** La fecha de la etapa de antes (el paso a acuerdo la cambia, 25-nov-2026). */ etapaAt?: string | null }
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
  const [m, { count: of }, { count: docs }, { count: vis }] = await Promise.all([
    leerMarca(),
    admin.from("inv_ofertas").select("id", { count: "exact", head: true }).eq("user_id", QA),
    admin.from("inv_documentos").select("id", { count: "exact", head: true }).eq("user_id", QA).eq("banco", BANCO_PRUEBA),
    admin.from("inv_visitas").select("id", { count: "exact", head: true }).eq("user_id", QA),
  ]);
  return [m ? `la marca de una corrida del ${m.t0}` : null, of ? `${of} oferta(s) de la cuenta de QA` : null, docs ? `${docs} preaprobación(es) de prueba` : null, vis ? `${vis} visita(s) de la cuenta de QA` : null].filter((x): x is string => !!x);
}

/** LA LIMPIEZA: todo lo creado desde la marca, el depto a su etapa, y la marca al final. Idempotente; corre una sola vez a la vez. */
function limpiar(m: Marca | null = marcaActual): Promise<void> {
  if (limpiando) return limpiando;
  limpiando = (async () => {
    if (!m) return;
    const { data: creadas } = await admin.from("inv_ofertas").select("id").eq("user_id", QA);
    const ids = (creadas ?? []).map((x) => x.id as string);
    // Ofertas y visitas se apuntan entre sí, y una oferta en firme no puede soltar su visita (check y trigger): primero se suelta la visita
    // de su oferta, después se borran las ofertas y al final las visitas.
    await borrarFotosVisitas(admin, QA);
    await admin.from("inv_visitas").update({ oferta_id: null }).eq("user_id", QA);
    if (ids.length) await admin.from("inv_ofertas").update({ anterior_id: null, sugerida_uf: null, sugerida_visita_id: null }).in("id", ids);
    if (ids.length) await admin.from("inv_ofertas").delete().in("id", ids);
    await admin.from("inv_visitas").delete().eq("user_id", QA);
    await admin.from("inv_tareas").delete().eq("user_id", QA).gte("created_at", m.t0);
    await admin.from("inv_bitacora").delete().eq("user_id", QA).gte("created_at", m.t0);
    await admin.from("inv_documentos").delete().eq("user_id", QA).eq("banco", BANCO_PRUEBA);
    if (m.docId) await admin.from("inv_documentos").delete().eq("id", m.docId);
    if (m.etapa != null) await admin.from("inv_deptos").update({ etapa: m.etapa, ...(m.etapaAt !== undefined ? { etapa_at: m.etapaAt } : {}) }).eq("id", m.deptoId);
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
  // Las fotos de las visitas de la cuenta de QA también se van del bucket.
  const { data: carpetas } = await admin.storage.from("invierte").list(`visitas/${QA}`);
  if ((carpetas ?? []).length) quedan.push(`${(carpetas ?? []).length} carpeta(s) de fotos de visitas en el bucket`);
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

/** Empieza otra vuelta desde cero en el mismo depto de prueba: sin ofertas ni visitas de la cuenta de QA, y el depto en «listo». Ofertas y
 *  visitas se apuntan entre sí, y una oferta en firme no puede soltar su visita: primero se suelta la visita de su oferta. */
async function otraVuelta(): Promise<void> {
  await borrarFotosVisitas(admin, QA);
  await admin.from("inv_visitas").update({ oferta_id: null }).eq("user_id", QA);
  await admin.from("inv_ofertas").update({ anterior_id: null, sugerida_uf: null, sugerida_visita_id: null }).eq("user_id", QA);
  const { error } = await admin.from("inv_ofertas").delete().eq("user_id", QA);
  await admin.from("inv_visitas").delete().eq("user_id", QA);
  if (error) throw new Error(`no se pudo empezar la otra vuelta: ${error.message}`);
  if (marcaActual) await admin.from("inv_deptos").update({ etapa: "listo" }).eq("id", marcaActual.deptoId);
}

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
  marcaActual = { t0, deptoId, etapa: (d0.etapa as string | null) ?? null, docId: null, etapaAt: (d0.etapa_at as string | null) ?? null };
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
    espera(f1.ok && o1.estado === "firmada" && o1.es_prueba === true && o1.sujeta_a_visita === true && (await tareaPendiente("presentar_oferta")), "1 · firmada, de prueba, sujeta a visita, con la tarea de presentar", { f1, estado: o1.estado });

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

    // ── LA VISITA ANTES DE CERRAR EL PRECIO (24-nov-2026) ──
    // 12 · Una oferta nueva con contraoferta; «Visitar antes de responder» (la persona): visita pedida, sus tareas y el pedido de mantener.
    const r6 = await asegurarRango(admin, QA, AVISO, new Date(), { nueva: true });
    await firmarOferta(admin, USER, AVISO, { montoUF: r6?.recomendadoUF, acepto: true, leyo: true }, null);
    const o6 = await ultimaRonda(deptoId);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o6.id }, null);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o6.id, tipo: "contraoferta", montoUF: Math.round(Number(o6.monto_uf)) + 120, nota: "", vence: null }, null);
    const pv = await pedirVisita(admin, USER, AVISO, null);
    const o6a = await oferta(o6.id as string);
    const { data: v1 } = await admin.from("inv_visitas").select("*").eq("user_id", QA).order("created_at", { ascending: false }).limit(1).single();
    espera(pv.ok && v1?.estado === "pedida" && v1.pedida_desde === "contraoferta" && v1.modo == null && !!o6a.mantener_pedido_at && (await tareaPendiente("agendar_visita")) && (await tareaPendiente("pedir_mantener_contraoferta")), "12 · visitar antes de responder: visita pedida (quién va, sin decidir), sus tareas y el pedido de mantener", { pv, v: v1?.estado, m: o6a.mantener_pedido_at });

    // 13 · Quien vende acepta mantenerla (admin): la fecha nueva reemplaza al vencimiento; la de antes queda guardada.
    const nueva13 = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
    const mt = await accionVisitaAdmin(admin, ADMIN, { accion: "visita_mantener", ofertaId: o6.id, acepta: true, fecha: nueva13 }, null);
    const o6b = await oferta(o6.id as string);
    espera(mt.ok && o6b.mantener_respuesta === "acepta" && o6b.contraoferta_vence_original === o6a.contraoferta_vence && o6b.contraoferta_vence !== o6a.contraoferta_vence && !(await tareaPendiente("pedir_mantener_contraoferta")), "13 · mantener la contraoferta: la fecha nueva reemplaza al vencimiento, la original guardada", { mt, o: o6b.contraoferta_vence, orig: o6b.contraoferta_vence_original });

    // 14 · LA BASE: lo que sugiere Franco bajo la oferta, sin una visita con un arreglo publicado, se rechaza (check y trigger).
    const bajo = Math.round(Number(o6.monto_uf)) - 10;
    const { error: e14a } = await admin.from("inv_ofertas").update({ sugerida_uf: bajo }).eq("id", o6.id as string);
    const { error: e14b } = await admin.from("inv_ofertas").update({ sugerida_uf: bajo, sugerida_visita_id: v1!.id }).eq("id", o6.id as string);
    espera(!!e14a && !!e14b && /arreglo concreto/.test(e14b.message), "14 · la base rechaza sugerir bajo la oferta sin una visita con un arreglo publicado", { e14a: e14a?.message, e14b: e14b?.message });

    // 15 · Agendar y publicar el reporte con un arreglo que no se veía en las fotos (admin): el rango baja y lo que sugiere Franco también.
    const ag = await accionVisitaAdmin(admin, ADMIN, { accion: "visita_agendar", visitaId: v1!.id, fecha: new Date().toISOString().slice(0, 10) }, null);
    // Las fotos de la visita: dos URLs firmadas por foto (la original y su copia liviana), una foto que no es de aquí se rechaza. Fotos de
    // verdad, chicas (24-nov-2026, Fabrizio): la original de 160 × 120 y la copia liviana de 64 × 48; un JPEG de 1 × 1 el visor lo da por roto.
    const ORIG = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAB4AKADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAECBf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAXAQEBAQEAAAAAAAAAAAAAAAABAgQF/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A4IDqMQACABQoAgAUAAgAIAFCgCABTIDQxgAUKAIAFAAIACABQoAgAUAAsgNDIKAIAFAAIACABQoAgAUAAgAUyoNDGABQACAAgAUKAIAFAAIAFAAKANDIAAgAIAFCgCABQACABQACAoLIDQyAAIAFCgCABQACABQACAoIAFMgNDGABQoAgAUAAgAUAAgKCABQACyA0MgoAgAIAFAAIAFAAKgBQACABT//2Q==", "base64");
    const MINI = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAwAEADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEF/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABcBAQEBAQAAAAAAAAAAAAAAAAIDBAX/xAAVEQEBAAAAAAAAAAAAAAAAAAABAP/aAAwDAQACEQMRAD8AwQV0lsgQAVqBAAWYRQFagUAVWgEABZhFAVqBABWYUAUWgEUBWoEAFZhFAFqBf//Z", "base64");
    const sub = await accionVisitaAdmin(admin, ADMIN, { accion: "visita_fotos_subida", visitaId: v1!.id, archivos: [{ mime: "image/jpeg", bytes: ORIG.length }, { mime: "image/jpeg", bytes: ORIG.length }] }, null) as { ok: boolean; fotos?: { path: string; token: string; mini: string; tokenMini: string }[] };
    for (const u of sub.fotos ?? []) { await admin.storage.from("invierte").uploadToSignedUrl(u.path, u.token, ORIG, { contentType: "image/jpeg" }); await admin.storage.from("invierte").uploadToSignedUrl(u.mini, u.tokenMini, MINI, { contentType: "image/jpeg" }); }
    const ajena = await accionVisitaAdmin(admin, ADMIN, { accion: "visita_reporte", visitaId: v1!.id, puntos: [{ tema: "Baños", texto: "x", arreglo: false }], fotos: [{ path: "visitas/otra/persona.jpg", mini: "visitas/otra/persona-mini.jpg" }] }, null);
    const pb = await accionVisitaAdmin(admin, ADMIN, { accion: "visita_reporte", visitaId: v1!.id, puntos: [{ tema: "Baños", texto: "Filtración en el cielo del baño: hay que repararla.", arreglo: true, enFotos: false }, { tema: "Cocina", texto: "En buen estado.", arreglo: false }], fecha: new Date().toISOString().slice(0, 10), fotos: (sub.fotos ?? []).map((u) => ({ path: u.path, mini: u.mini })) }, null);
    const { data: fv } = await admin.from("inv_visitas").select("reporte").eq("id", v1!.id).single();
    const fotosGuardadas = ((fv?.reporte as { fotos?: unknown[] } | null)?.fotos ?? []).length;
    const { data: enBucket } = await admin.storage.from("invierte").list(`visitas/${QA}/${v1!.id}`);
    espera(sub.ok && (sub.fotos ?? []).length === 2 && !ajena.ok && fotosGuardadas === 2 && (enBucket ?? []).length === 4, "15 · las fotos de la visita: subidas con su copia liviana y guardadas con el reporte; una foto ajena se rechaza", { sub: sub.ok, ajena, fotosGuardadas, enBucket: (enBucket ?? []).length });
    // El visor abre la original: la dirección que pide el visor (urlFotoVisita sin «mini») lleva, por la misma función que usa la ruta, a la
    // foto original —los mismos bytes que se subieron, 160 px de ancho, sana para el visor—; la miniatura, a la copia liviana; otra persona, a nada.
    const { data: filaV } = await admin.from("inv_visitas").select("user_id, estado, reporte").eq("id", v1!.id).single();
    const pideFoto = (mini: boolean) => { const q = new URL(urlFotoVisita(v1!.id, 0, mini), "http://x").searchParams; return rutaFotoVisita(filaV, QA, q.get("visita") ?? "", Number(q.get("i")), q.get("mini") === "1"); };
    const bajar = async (ruta: string | null) => { if (!ruta) return Buffer.alloc(0); const { data: f } = await admin.storage.from("invierte").createSignedUrl(ruta, 60); return f?.signedUrl ? Buffer.from(await (await fetch(f.signedUrl)).arrayBuffer()) : Buffer.alloc(0); };
    const rOrig = pideFoto(false), rMini = pideFoto(true);
    const [bOrig, bMini] = await Promise.all([bajar(rOrig), bajar(rMini)]);
    const anchos = { orig: anchoJpeg(bOrig), mini: anchoJpeg(bMini) };
    espera(!!rOrig && !!rMini && rOrig !== rMini && bOrig.equals(ORIG) && bMini.equals(MINI) && anchos.orig === 160 && anchos.mini === 64 && fotoSana(anchos.orig) && fotoSana(anchos.mini) && !fotoSana(1) && rutaFotoVisita(filaV, "00000000-0000-0000-0000-000000000000", v1!.id, 0, false) === null,
      "15 · el visor abre la original (160 px, los bytes subidos) y la miniatura su copia liviana (64 px); otra persona no ve nada", { rOrig, rMini, anchos, iguales: bOrig.equals(ORIG) });
    // Para probar en el navegador con una sesión real (QA, 24-nov-2026): con RECORRIDO_PAUSA_ARCHIVO, deja la visita publicada con sus fotos,
    // escribe en ese archivo la visita y el aviso, y espera hasta que alguien lo borre (máximo 10 minutos). Después sigue y limpia como siempre.
    if (process.env.RECORRIDO_PAUSA_ARCHIVO) {
      const fs = await import("node:fs");
      fs.writeFileSync(process.env.RECORRIDO_PAUSA_ARCHIVO, JSON.stringify({ visitaId: v1!.id, avisoId: AVISO }));
      console.log("  … en pausa: borra el archivo para seguir");
      for (let k = 0; k < 600 && fs.existsSync(process.env.RECORRIDO_PAUSA_ARCHIVO); k++) await new Promise((r) => setTimeout(r, 1000));
    }
    const o6c = await oferta(o6.id as string);
    const { data: v1b } = await admin.from("inv_visitas").select("*").eq("id", v1!.id).single();
    espera(ag.ok && pb.ok && v1b?.estado === "reporte_publicado" && v1b.reporte_estado === "arreglos_menores" && (v1b.reporte_arreglos as string[]).length === 1 && Number(o6c.sugerida_uf) < Number(o6a.sugerida_uf) && o6c.sugerida_visita_id === v1!.id, "15 · el reporte con un arreglo baja lo que sugiere Franco, con la visita de respaldo", { ag, pb, v: v1b?.estado, antes: o6a.sugerida_uf, ahora: o6c.sugerida_uf });

    // ── DESPUÉS DE LA VISITA, TODA OFERTA ES EN FIRME (24-nov-2026) ──
    // 16 · Proponer menos que la oferta anterior con el reporte de respaldo: nace en firme. Con una sola casilla, no se firma.
    const v16 = await visitaParaRonda(admin, deptoId);
    const ro16 = rondaDesde({ ...ofertaDeFila(o6c), visita: v16 });
    const monto16 = ro16 ? Math.min(ro16.minUF + 10, Number(o6.monto_uf) - 1) : 0;
    const unaCasilla = ro16 ? await firmarRonda(admin, USER, AVISO, { desdeId: o6.id, montoUF: monto16, acepto: true, leyo: true }, null) : null;
    const pp = ro16 && ro16.minUF < Number(o6.monto_uf) ? await firmarRonda(admin, USER, AVISO, { desdeId: o6.id, montoUF: monto16, acepto: true, leyo: true, aceptoFirme: true }, null) : null;
    const o7 = await ultimaRonda(deptoId);
    espera(unaCasilla?.ok === false && unaCasilla.error === "casilla" && !!pp?.ok && Number(o7.monto_uf) < Number(o6.monto_uf) && o7.visita_id === v1!.id && o7.estado === "firmada" && o7.sujeta_a_visita === false && o7.en_firme_confirmo === true && o7.texto_version === "borrador-a-firme-20261124b", "16 · después de la visita la ronda nace en firme (con las dos casillas; con una sola, no se firma), con el reporte de respaldo", { unaCasilla, pp, o7: { m: o7.monto_uf, s: o7.sujeta_a_visita, v: o7.texto_version } });

    // 17 · Una oferta a firme no se retira mientras esté vigente: firmada ni presentada. Vence sola; otra oferta después, con la visita
    // publicada, también nace a firme.
    const rtFirmada = await retirarOferta(admin, USER, AVISO, null);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o7.id }, null);
    const rtPresentada = await retirarOferta(admin, USER, AVISO, null);
    const o7p = await oferta(o7.id as string);
    const vence17 = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_prueba_pasada", ofertaId: o7.id, modo: "vencer" }, null);
    const o7v = await oferta(o7.id as string);
    espera(!rtFirmada.ok && !rtPresentada.ok && o7p.estado === "presentada" && vence17.ok && o7v.estado === "sin_acuerdo" && o7v.sin_acuerdo_motivo === "vencida", "17 · una oferta a firme no se retira (firmada ni presentada) y vence sola", { rtFirmada, rtPresentada, e: o7p.estado, v: o7v.estado });
    const r17 = await asegurarRango(admin, QA, AVISO, new Date(), { nueva: true });
    const otraUna = await firmarOferta(admin, USER, AVISO, { montoUF: r17?.recomendadoUF, acepto: true, leyo: true }, null);
    const otra = await firmarOferta(admin, USER, AVISO, { montoUF: r17?.recomendadoUF, acepto: true, leyo: true, aceptoFirme: true }, null);
    const o9 = await ultimaRonda(deptoId);
    espera(otraUna.ok === false && otra.ok && o9.estado === "firmada" && o9.sujeta_a_visita === false && o9.visita_id === v1!.id, "17 · otra oferta después, con la visita publicada, nace a firme", { otraUna, otra, o9: { e: o9.estado, s: o9.sujeta_a_visita } });

    // 18 · Presentarla y que quien vende la acepte: pasa directo a «en firme», sin otro paso de la persona; ya no se puede retirar.
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o9.id }, null);
    const ac18 = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o9.id, tipo: "aceptada" }, null);
    const o9b = await oferta(o9.id as string);
    const { data: d18 } = await admin.from("inv_deptos").select("etapa, etapa_at").eq("id", deptoId).single();
    const rt18 = await retirarOferta(admin, USER, AVISO, null);
    const o9c = await oferta(o9.id as string);
    espera(ac18.ok && o9b.estado === "en_firme" && o9b.en_firme_como === "tras_visita" && !!o9b.en_firme_at && d18?.etapa === "en_firme" && !rt18.ok && o9c.estado === "en_firme", "18 · aceptada, la oferta en firme queda en firme directo (no vuelve a «Aceptaron, falta la visita») y ya no se retira", { ac18, e: o9b.estado, etapa: d18?.etapa, rt18 });
    // 18 · El paso a «acuerdo» deja la fecha de la etapa y su línea en la bitácora (como el cambio a mano), y el depto cuenta como acuerdo:
    // con él, los otros deptos de la persona quedan en pausa (25-nov-2026).
    const { data: bit18 } = await admin.from("inv_bitacora").select("accion, detalle").eq("user_id", QA).eq("accion", "depto_etapa").gte("created_at", t0);
    const lineaAcuerdo = (bit18 ?? []).find((b) => (b.detalle as { a?: string } | null)?.a === "en_firme" && (b.detalle as { aviso_id?: string } | null)?.aviso_id === AVISO);
    const conAcuerdo18 = await deptoConAcuerdo(admin, QA, null), sinEste18 = await deptoConAcuerdo(admin, QA, deptoId);
    espera(!!d18?.etapa_at && new Date(d18.etapa_at as string).getTime() >= new Date(t0).getTime() && !!lineaAcuerdo && conAcuerdo18 === deptoId && sinEste18 === null,
      "18 · el paso a acuerdo deja la fecha de la etapa y su línea en la bitácora, y el depto cuenta como acuerdo para los otros", { etapaAt: d18?.etapa_at, lineaAcuerdo, conAcuerdo18, sinEste18 });

    // ── Otra vuelta, desde cero: la visita pedida con la oferta ya aceptada (sujeta, firmada antes de visitar) ──
    await otraVuelta();
    await admin.from("inv_deptos").update({ etapa: "listo" }).eq("id", deptoId);
    // 19 · La primera oferta, antes de visitar, nace sujeta a visita; aceptada, queda «aceptada, sujeta a visita».
    const r19 = await asegurarRango(admin, QA, AVISO, new Date(), { nueva: true });
    await firmarOferta(admin, USER, AVISO, { montoUF: r19?.recomendadoUF, acepto: true, leyo: true }, null);
    const o10 = await ultimaRonda(deptoId);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o10.id }, null);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o10.id, tipo: "aceptada" }, null);
    const o10b = await oferta(o10.id as string);
    espera(o10.sujeta_a_visita === true && o10.texto_version === "borrador-20261124" && o10b.estado === "aceptada_sujeta", "19 · antes de visitar la oferta nace sujeta a visita, y aceptada queda sujeta", { s: o10.sujeta_a_visita, e: o10b.estado });

    // 20 · Pedir la visita desde la aceptada y publicar el reporte: confirmarla sigue como estaba (solo con la confirmación explícita).
    const visitaDesdeAceptada = async (desdeId: string): Promise<string> => {
      await pedirVisita(admin, USER, AVISO, null);
      const { data: v } = await admin.from("inv_visitas").select("id").eq("user_id", QA).order("created_at", { ascending: false }).limit(1).single();
      await accionVisitaAdmin(admin, ADMIN, { accion: "visita_agendar", visitaId: v!.id, fecha: new Date().toISOString().slice(0, 10) }, null);
      await accionVisitaAdmin(admin, ADMIN, { accion: "visita_reporte", visitaId: v!.id, puntos: [{ tema: "Baños", texto: "Filtración en el cielo del baño: hay que repararla.", arreglo: true, enFotos: false }], fecha: new Date().toISOString().slice(0, 10) }, null);
      return desdeId;
    };
    await visitaDesdeAceptada(o10.id as string);
    const sinConf = await confirmarEnFirme(admin, USER, AVISO, {}, null);
    const o10s = await oferta(o10.id as string);
    const conf = await confirmarEnFirme(admin, USER, AVISO, { confirmo: true }, null);
    const o10c = await oferta(o10.id as string);
    const { data: d20 } = await admin.from("inv_deptos").select("etapa").eq("id", deptoId).single();
    espera(!sinConf.ok && o10s.estado === "aceptada_sujeta" && conf.ok && o10c.estado === "en_firme" && o10c.en_firme_como === "tras_visita" && o10c.en_firme_confirmo === true && d20?.etapa === "en_firme" && (await tareaPendiente("comunicar_en_firme")), "20 · confirmar una aceptada después de visitar sigue como estaba: solo con la confirmación explícita", { sinConf, conf, e: o10c.estado, etapa: d20?.etapa });

    // 21 · Otra vuelta: aceptada, visitada con un arreglo; ajustar el precio con lo que se vio nace en firme.
    await otraVuelta();
    const r21 = await asegurarRango(admin, QA, AVISO, new Date(), { nueva: true });
    await firmarOferta(admin, USER, AVISO, { montoUF: r21?.recomendadoUF, acepto: true, leyo: true }, null);
    const o11a = await ultimaRonda(deptoId);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o11a.id }, null);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o11a.id, tipo: "aceptada" }, null);
    await visitaDesdeAceptada(o11a.id as string);
    const ro21 = rondaDesde({ ...ofertaDeFila(await oferta(o11a.id as string)), visita: await visitaParaRonda(admin, deptoId) });
    const aj = ro21?.tipo === "ajustar" ? await firmarRonda(admin, USER, AVISO, { desdeId: o11a.id, montoUF: ro21.minUF, acepto: true, leyo: true, aceptoFirme: true }, null) : null;
    const o11 = await ultimaRonda(deptoId);
    const o11ab = await oferta(o11a.id as string);
    espera(aj?.ok === true && aj.tipo === "ajustar" && o11.estado === "firmada" && o11.sujeta_a_visita === false && o11ab.estado === "reemplazada" && Number(o11.monto_uf) < Number(o11a.monto_uf), "21 · ajustar el precio con lo que se vio nace en firme, la aceptada reemplazada", { ro21, aj, o11: { e: o11.estado, s: o11.sujeta_a_visita } });

    // 22 · Aceptar su precio en firme: al comunicarlo queda en firme.
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_presentar", ofertaId: o11.id }, null);
    await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_respuesta", ofertaId: o11.id, tipo: "contraoferta", montoUF: Math.round(Number(o11.monto_uf)) + 20, nota: "", vence: null }, null);
    const o11b = await oferta(o11.id as string);
    const ac22 = await firmarRonda(admin, USER, AVISO, { desdeId: o11.id, montoUF: Number(o11b.contraoferta_uf), acepto: true, leyo: true, aceptoFirme: true }, null);
    const o12 = await ultimaRonda(deptoId);
    const cm22 = await accionOfertaAdmin(admin, ADMIN, { accion: "oferta_comunicada", ofertaId: o12.id }, null);
    const o12b = await oferta(o12.id as string);
    espera(ac22.ok && ac22.tipo === "aceptar" && o12.sujeta_a_visita === false && cm22.ok && o12b.estado === "en_firme" && o12b.en_firme_como === "tras_visita", "22 · aceptar su precio después de la visita: en firme al comunicarlo", { ac22, cm22, e: o12b.estado });
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
