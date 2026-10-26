import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/correos/suprimir (26-oct-2026, reporte del lunes): agrega a la lista de supresión de Resend las
// direcciones de las cuentas que dieron rebote permanente, para que ningún envío vuelva a intentarlas y no sigan
// ensuciando la reputación del dominio. Body: `{ userIds: [...] }` (hasta 100). La dirección se lee de la cuenta; la
// respuesta no la devuelve: dice cuántas se pidieron, cuántas agregó Resend y de qué dominios eran.
// Auth: `Authorization: Bearer ${CRON_SECRET}`, como el cron.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const llave = process.env.RESEND_API_KEY;
  if (!llave) return NextResponse.json({ error: "sin RESEND_API_KEY" }, { status: 500 });

  const b = (await request.json().catch(() => ({}))) as { userIds?: unknown };
  const userIds = Array.isArray(b.userIds) ? Array.from(new Set(b.userIds.filter((u): u is string => typeof u === "string" && UUID.test(u)))).slice(0, 100) : [];
  if (userIds.length === 0) return NextResponse.json({ error: "userIds" }, { status: 400 });

  const admin = createServiceClient();
  const correos: string[] = [];
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    const correo = data?.user?.email?.trim().toLowerCase();
    if (correo) correos.push(correo);
  }
  const dominios = correos.reduce<Record<string, number>>((m, c) => { const d = c.split("@")[1] ?? "?"; m[d] = (m[d] ?? 0) + 1; return m; }, {});
  if (correos.length === 0) return NextResponse.json({ pedidas: userIds.length, agregadas: 0, dominios });

  const res = await fetch("https://api.resend.com/suppressions/batch/add", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ emails: correos }),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { data?: unknown[]; message?: string };
  if (!res.ok) return NextResponse.json({ pedidas: userIds.length, conCorreo: correos.length, error: `resend ${res.status}: ${cuerpo.message ?? ""}`.slice(0, 200), dominios }, { status: 502 });
  return NextResponse.json({ pedidas: userIds.length, conCorreo: correos.length, agregadas: Array.isArray(cuerpo.data) ? cuerpo.data.length : null, dominios });
}
