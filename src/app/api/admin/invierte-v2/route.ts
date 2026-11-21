import { NextResponse } from "next/server";
import { createAdminServiceClient, requireAdmin } from "@/lib/admin-auth";
import { CLAVE_MODO, TABLA_ACCESO, correoDeLista, esModo } from "@/lib/invierte-v2/acceso";
import { olvidarAcceso } from "@/lib/invierte-v2/acceso-servidor";
import { anotarVista, completarOrden, leerOrdenPorId, reiniciarPrueba, urlFirmadaPdf } from "@/lib/invierte-v2/servidor";
import { DEPS_FIRMA } from "@/lib/invierte-v2/rutas";
import { CLAVE_WHATSAPP_FRANCO, numeroWhatsapp } from "@/lib/invierte-v2/base";
import { aprobar, documentoPorId, pedirCorregir, urlDocumento, type DepsRevision } from "@/lib/invierte-v2/preaprobacion-servidor";
import { validarAprobacion, validarMotivo } from "@/lib/invierte-v2/preaprobacion";
import { sendPreaprobacionInvierte } from "@/lib/email";
import { estadoInterruptor } from "@/lib/invierte-v2/acceso-servidor";
import { puedeRecibirCopia } from "@/lib/invierte-v2/copias-servidor";
import { ajustarPorPreaprobacion, confirmarUbicacion, registrarAcuerdo } from "@/lib/invierte-v2/depto-servidor";

/** El correo de la revisión: solo a quien el interruptor deja (mientras el modo no sea «todos», la lista). */
const DEPS_REVISION: DepsRevision = {
  correo: (p) => sendPreaprobacionInvierte(p),
  puedeRecibir: async (email) => { const { modo, lista } = await estadoInterruptor(); return puedeRecibirCopia(modo, lista, email); },
};

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/invierte-v2 (etapa 1 de Invierte con Franco, 18-nov-2026). Solo administradores de ADMIN_EMAIL.
//   POST { accion: "agregar" | "quitar", email }   → la lista del interruptor.
//   POST { accion: "modo", modo }                   → apagado | lista | todos (la fila de config).
//   POST { accion: "reiniciar", userId }            → «Reiniciar prueba» (solo cuentas de prueba sin ninguna orden real).
//   POST { accion: "reenviar", ordenId }            → «Reenviar copia»: completa la orden (PDF y copia) y dice el motivo si no sale.
//   POST { accion: "tarea", id }                   → «Marcar hecha» una tarea interna (entrega 2, la ficha de la persona).
//   POST { accion: "whatsapp", numero }            → el número de «Escribirle» de la base (vacío lo quita; entrega 2).
//   POST { accion: "aprobar", id, banco, montoUF, vigenteHasta } → aprueba la preaprobación (entrega 3) y le avisa por correo.
//   POST { accion: "corregir", id, motivo }        → pide subirla de nuevo, con el motivo que ve la persona, y le avisa.
//   POST { accion: "acuerdo", userId, avisoId, acuerdo, alternativa } → el acuerdo con quien vende (etapa 3, B1).
//   POST { accion: "ubicacion", avisoId, direccion, numero, lat, lng } → la ubicación confirmada y el análisis rehecho (B1).
//   GET  ?documento=<id>                            → «Ver» la preaprobación (URL firmada de 60 s), anotado en la bitácora.
//   GET  ?orden=<id>                                → «Ver»: la orden firmada (URL firmada de 60 s), anotada en la bitácora.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { sb, adminUser } = gate;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = b?.accion;
  if (accion === "agregar" || accion === "quitar") {
    const email = correoDeLista(b?.email);
    if (!email) return NextResponse.json({ error: "correo" }, { status: 400 });
    const { error } = accion === "agregar"
      ? await sb.from(TABLA_ACCESO).upsert({ email, agregado_por: adminUser.email ?? null }, { onConflict: "email", ignoreDuplicates: true })
      : await sb.from(TABLA_ACCESO).delete().eq("email", email);
    if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });
    olvidarAcceso();
    return NextResponse.json({ ok: true });
  }
  if (accion === "modo") {
    if (!esModo(b?.modo)) return NextResponse.json({ error: "modo" }, { status: 400 });
    const { error } = await sb.from("config").upsert({ key: CLAVE_MODO, value: b.modo, updated_at: new Date().toISOString().replace("Z", "") }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });
    olvidarAcceso();
    return NextResponse.json({ ok: true, modo: b.modo });
  }
  if (accion === "reiniciar") {
    if (typeof b?.userId !== "string" || !UUID.test(b.userId)) return NextResponse.json({ error: "datos" }, { status: 400 });
    const r = await reiniciarPrueba(sb, b.userId, adminUser.email ?? null);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "no-es-prueba" || r.error === "orden-real" ? 409 : 500 });
    return NextResponse.json(r);
  }
  if (accion === "reenviar") {
    if (typeof b?.ordenId !== "string" || !UUID.test(b.ordenId)) return NextResponse.json({ error: "datos" }, { status: 400 });
    const orden = await leerOrdenPorId(sb, b.ordenId);
    if (!orden) return NextResponse.json({ error: "no-existe" }, { status: 404 });
    if (orden.copiaEnviadaAt) return NextResponse.json({ ok: true, copia: true, ya: true });
    const c = await completarOrden(sb, orden, DEPS_FIRMA, "admin");
    return NextResponse.json({ ok: c.copia, copia: c.copia, motivo: c.motivoCopia }, { status: c.copia ? 200 : 502 });
  }
  if (accion === "aprobar" || accion === "corregir") {
    if (typeof b?.id !== "string" || !UUID.test(b.id)) return NextResponse.json({ error: "datos" }, { status: 400 });
    let r;
    if (accion === "aprobar") {
      const v = validarAprobacion(b);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      r = await aprobar(createAdminServiceClient(), adminUser.email ?? null, b.id, v.a, DEPS_REVISION);
    } else {
      const motivo = validarMotivo(b?.motivo);
      if (!motivo) return NextResponse.json({ error: "motivo" }, { status: 400 });
      r = await pedirCorregir(createAdminServiceClient(), adminUser.email ?? null, b.id, motivo, DEPS_REVISION);
    }
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "no-existe" ? 404 : r.error === "estado" ? 409 : 500 });
    // Etapa 3, B1: con la preaprobación que cambia, sus deptos que esperaban pasan a listo (y al revés).
    const { data: doc } = await sb.from("inv_documentos").select("user_id").eq("id", b.id).maybeSingle();
    if (doc?.user_id) await ajustarPorPreaprobacion(createAdminServiceClient(), doc.user_id as string);
    return NextResponse.json({ ok: true, correo: r.correo });
  }
  // Etapa 3, B1: el acuerdo con quien vende y la ubicación confirmada (con el análisis rehecho). Los hace una persona de Franco.
  if (accion === "acuerdo") {
    if (typeof b?.userId !== "string" || !UUID.test(b.userId) || typeof b?.avisoId !== "string") return NextResponse.json({ error: "datos" }, { status: 400 });
    const r = await registrarAcuerdo(createAdminServiceClient(), { id: adminUser.id, email: adminUser.email ?? null }, b.userId, b.avisoId, b.acuerdo, b.alternativa);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 400 });
    return NextResponse.json(r);
  }
  if (accion === "ubicacion") {
    if (typeof b?.avisoId !== "string" || !UUID.test(b.avisoId)) return NextResponse.json({ error: "datos" }, { status: 400 });
    const r = await confirmarUbicacion(createAdminServiceClient(), { id: adminUser.id, email: adminUser.email ?? null }, b.avisoId, b);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" || r.error === "config" ? 500 : 400 });
    return NextResponse.json(r);
  }
  if (accion === "tarea") {
    if (typeof b?.id !== "string" || !UUID.test(b.id)) return NextResponse.json({ error: "datos" }, { status: 400 });
    const { error } = await sb.from("inv_tareas").update({ estado: "hecha", hecha_por: adminUser.email ?? null, hecha_at: new Date().toISOString() }).eq("id", b.id).eq("estado", "pendiente");
    if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (accion === "whatsapp") {
    const vacio = typeof b?.numero === "string" && !b.numero.trim();
    const numero = numeroWhatsapp(b?.numero);
    if (!vacio && !numero) return NextResponse.json({ error: "numero" }, { status: 400 });
    const { error } = vacio
      ? await sb.from("config").delete().eq("key", CLAVE_WHATSAPP_FRANCO)
      : await sb.from("config").upsert({ key: CLAVE_WHATSAPP_FRANCO, value: numero, updated_at: new Date().toISOString().replace("Z", "") }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "accion" }, { status: 400 });
}

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const docId = new URL(request.url).searchParams.get("documento");
  if (docId) {
    if (!UUID.test(docId)) return NextResponse.json({ error: "datos" }, { status: 400 });
    const doc = await documentoPorId(gate.sb, docId);
    const url = doc ? await urlDocumento(gate.sb, doc) : null;
    if (!doc || !url) return NextResponse.json({ error: "no-existe" }, { status: 404 });
    await gate.sb.from("inv_bitacora").insert({ user_id: doc.userId, actor: "admin", actor_email: gate.adminUser.email ?? null, accion: "preaprobacion_vista", detalle: { documento: doc.id }, es_prueba: doc.esPrueba });
    return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  const id = new URL(request.url).searchParams.get("orden");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const orden = await leerOrdenPorId(gate.sb, id);
  if (!orden) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  const url = await urlFirmadaPdf(gate.sb, orden);
  if (!url) return NextResponse.json({ error: "pdf" }, { status: 503 });
  await anotarVista(gate.sb, orden, { actor: "admin", email: gate.adminUser.email ?? null }, null);
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
}
