import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { EVENTOS_META } from "@/lib/meta/ids";
import { emitirRegistroAlCrear } from "@/lib/meta/registro";

// ─────────────────────────────────────────────────────────────────────────────
// EL RELLENO DEL CompleteRegistration (22-oct-2026, pedido de Fabrizio). Hasta ese día el evento dependía de contestar
// «¿Cuándo piensas comprar?» y no salía nunca: desde el 16-oct, 7 cuentas reales y 1 con el evento. Meta acepta un
// `event_time` de hasta 7 días atrás, así que las cuentas que nacieron sin el evento en esa ventana lo mandan ahora, con
// la hora de su alta. Las de prueba las deja fuera emitirEventoMeta (quedan «omitido_cuenta_prueba»).
//
// POST /api/admin/meta-registros-pendientes · Auth: `Authorization: Bearer ${CRON_SECRET}`, como el relleno de Meta Ads.
// Body: { desde?: "2026-10-16", dry?: true }. Con `dry`, solo lista. Responde cada cuenta con el estado que quedó en
// meta_eventos. No es un cron (una ruta de cron no puede responder sin cerrarCron): va en /api/admin.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
/** Lo que Meta acepta hacia atrás. (No se exporta: una ruta de Next solo exporta sus handlers y su config; el build lo rechaza.) */
const VENTANA_RELLENO_MS = 7 * 24 * 3600_000;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { desde?: unknown; dry?: unknown };
  const desde = typeof body.desde === "string" && /^\d{4}-\d{2}-\d{2}/.test(body.desde) ? Date.parse(body.desde) : Date.parse("2026-10-16");
  const dry = body.dry === true;
  const ahora = Date.now();
  const piso = Math.max(desde, ahora - VENTANA_RELLENO_MS);

  const admin = createServiceClient();
  const { data: lista, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const cuentas = lista.users.filter((u) => u.created_at && Date.parse(u.created_at) >= piso && Date.parse(u.created_at) <= ahora);
  const ids = cuentas.map((u) => u.id);
  const { data: hechos } = ids.length
    ? await admin.from("meta_eventos").select("user_id").eq("evento", EVENTOS_META.registro).eq("prueba", false).in("user_id", ids)
    : { data: [] as Array<{ user_id: string | null }> };
  const conEvento = new Set((hechos ?? []).map((h) => h.user_id));
  const pendientes = cuentas.filter((u) => !conEvento.has(u.id));

  const salida: Array<{ user_id: string; created_at: string; estado: string; detalle?: string | null }> = [];
  for (const u of pendientes) {
    if (dry) { salida.push({ user_id: u.id, created_at: u.created_at!, estado: "pendiente" }); continue; }
    const r = await emitirRegistroAlCrear(admin, u, null, { origen: "relleno", eventTime: Math.floor(Date.parse(u.created_at!) / 1000) });
    if (!r) { salida.push({ user_id: u.id, created_at: u.created_at!, estado: "fuera-de-ventana" }); continue; }
    await r.envio;
    const { data: fila } = await admin.from("meta_eventos").select("estado, detalle").eq("evento", EVENTOS_META.registro).eq("user_id", u.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    salida.push({ user_id: u.id, created_at: u.created_at!, estado: (fila?.estado as string | undefined) ?? r.estado, detalle: (fila?.detalle as string | null | undefined) ?? null });
  }
  return NextResponse.json({ desde: new Date(piso).toISOString(), cuentas: cuentas.length, conEvento: conEvento.size, pendientes: pendientes.length, dry, salida });
}
