import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { armarSeleccion, COLUMNAS_ENVIO, enviarSeleccion, type FilaSeleccion, type PresupuestoFichas } from "@/lib/guia/semanal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/semanal-reparar (20-oct-2026, la reparación): a las personas que el lunes recibieron el correo corto
// aunque había deptos que convenían —el mínimo de tres los descartó, o su informe no servía de origen—, su selección
// real con la regla nueva, esta semana, sin esperar al lunes. Body: `{ semana: "AAAA-MM-DD", userIds: [...] }`. Por
// persona: la fila de esa semana vuelve a «pendiente», se arma de nuevo (con el cupo de fichas de una corrida) y, si
// quedó con al menos un depto —confirmado o visto anoche sin confirmar—, se manda; si no, la fila vuelve a como estaba y
// no sale un segundo correo vacío. No es una corrida del cron: no late ni cierra. A una cuenta de prueba se le arma igual
// (28-oct-2026); el correo lo frena enviarCorreo (correo-destino.ts).
// Auth: `Authorization: Bearer ${CRON_SECRET}`, como el cron.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 300;
const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
const PRESUPUESTO_MS = 240_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = (await request.json().catch(() => ({}))) as { semana?: unknown; userIds?: unknown; soloArmar?: unknown };
  const semana = typeof b.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.semana) ? b.semana : null;
  const userIds = Array.isArray(b.userIds) ? b.userIds.filter((u): u is string => typeof u === "string" && UUID.test(u)).slice(0, 50) : [];
  if (!semana || userIds.length === 0) return NextResponse.json({ error: "semana (AAAA-MM-DD) y userIds" }, { status: 400 });
  const soloArmar = b.soloArmar === true;

  const admin = createServiceClient();
  const cfg = await leerConfigGuia(admin);
  const presupuesto: PresupuestoFichas = { lecturas: 0, bloqueada: false };
  const t0 = Date.now();
  const resultado: Array<Record<string, unknown>> = [];
  for (const userId of userIds) {
    if (Date.now() - t0 > PRESUPUESTO_MS) { resultado.push({ userId, resultado: "sin-tiempo" }); continue; }
    const { data: fila } = await admin.from("semanal_selecciones").select("id, estado, enviada_at, resend_id, items, items_str").eq("user_id", userId).eq("semana", semana).eq("tipo", "semanal").maybeSingle();
    if (!fila) { resultado.push({ userId, resultado: "sin-fila" }); continue; }
    if ((fila.items as unknown[] | null)?.length || (fila.items_str as unknown[] | null)?.length) { resultado.push({ userId, resultado: "ya-tenia-deptos" }); continue; }
    const antes = { estado: fila.estado as string, enviada_at: fila.enviada_at as string | null, resend_id: fila.resend_id as string | null };
    await admin.from("semanal_selecciones").update({ estado: "pendiente", enviada_at: null, resend_id: null, items: [], relleno: [] }).eq("id", fila.id);
    let armado: string;
    try {
      armado = await armarSeleccion(admin, userId, semana, cfg, presupuesto);
    } catch (e) {
      await admin.from("semanal_selecciones").update(antes).eq("id", fila.id);
      resultado.push({ userId, resultado: "fallo-armar", error: e instanceof Error ? e.message : String(e) });
      continue;
    }
    const { data: nueva } = await admin.from("semanal_selecciones").select(COLUMNAS_ENVIO).eq("id", fila.id).maybeSingle();
    const f = nueva as unknown as FilaSeleccion | null;
    const n = (f?.items?.length ?? 0) + (f?.relleno?.length ?? 0) + (f?.items_str?.length ?? 0);
    if (!f || n === 0 || soloArmar) {
      // Nada real que mandar (o solo se pidió armar): la fila vuelve a como estaba, sin un segundo correo vacío.
      if (!soloArmar || n === 0) await admin.from("semanal_selecciones").update(antes).eq("id", fila.id);
      resultado.push({ userId, resultado: n === 0 ? "sin-deptos" : "armada-sin-mandar", armado, items: f?.items?.length ?? 0, relleno: f?.relleno?.length ?? 0 });
      continue;
    }
    try {
      const envio = await enviarSeleccion(admin, f, SITIO);
      resultado.push({ userId, resultado: envio, armado, items: f.items?.length ?? 0, relleno: f.relleno?.length ?? 0 });
    } catch (e) {
      resultado.push({ userId, resultado: "fallo-enviar", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ semana, lecturas: presupuesto.lecturas, bloqueada: presupuesto.bloqueada, resultado });
}
