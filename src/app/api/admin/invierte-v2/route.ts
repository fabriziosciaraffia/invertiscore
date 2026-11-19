import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { CLAVE_MODO, TABLA_ACCESO, correoDeLista, esModo } from "@/lib/invierte-v2/acceso";
import { olvidarAcceso } from "@/lib/invierte-v2/acceso-servidor";
import { anotarVista, completarOrden, leerOrdenPorId, reiniciarPrueba, urlFirmadaPdf } from "@/lib/invierte-v2/servidor";
import { DEPS_FIRMA } from "@/lib/invierte-v2/rutas";
import { CLAVE_WHATSAPP_FRANCO, numeroWhatsapp } from "@/lib/invierte-v2/base";

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/invierte-v2 (etapa 1 de Invierte con Franco, 18-nov-2026). Solo administradores de ADMIN_EMAIL.
//   POST { accion: "agregar" | "quitar", email }   → la lista del interruptor.
//   POST { accion: "modo", modo }                   → apagado | lista | todos (la fila de config).
//   POST { accion: "reiniciar", userId }            → «Reiniciar prueba» (solo cuentas de prueba sin ninguna orden real).
//   POST { accion: "reenviar", ordenId }            → «Reenviar copia»: completa la orden (PDF y copia) y dice el motivo si no sale.
//   POST { accion: "tarea", id }                   → «Marcar hecha» una tarea interna (entrega 2, la ficha de la persona).
//   POST { accion: "whatsapp", numero }            → el número de «Escribirle» de la base (vacío lo quita; entrega 2).
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
  const id = new URL(request.url).searchParams.get("orden");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "datos" }, { status: 400 });
  const orden = await leerOrdenPorId(gate.sb, id);
  if (!orden) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  const url = await urlFirmadaPdf(gate.sb, orden);
  if (!url) return NextResponse.json({ error: "pdf" }, { status: 503 });
  await anotarVista(gate.sb, orden, { actor: "admin", email: gate.adminUser.email ?? null }, null);
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
}
