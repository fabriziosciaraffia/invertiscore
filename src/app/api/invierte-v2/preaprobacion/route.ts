import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { confirmarSubida, leerPreaprobacion, pedirSubida, sinCredito, todaviaNo, urlDocumento } from "@/lib/invierte-v2/preaprobacion-servidor";
import { leerPreaprobacionIA } from "@/lib/invierte-v2/preaprobacion-ia";
import { capturarServidor } from "@/lib/posthog-servidor";
import { NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";

// /api/invierte-v2/preaprobacion (entrega 3, 19-nov-2026). Sin acceso: 404.
//   POST { accion: "subir", mime, bytes }  → la URL firmada de subida (el archivo va del navegador al bucket privado).
//   POST { accion: "listo", id }           → confirma la subida: huella, lectura con IA (si hay llave), tarea y bitácora.
//   POST { accion: "sin-credito" }         → «Compro sin crédito».
//   POST { accion: "todavia-no" }          → «Todavía no la tengo»: la tarea de explicarle cómo pedirla.
//   GET                                    → «Ver lo que subí»: su documento vigente (redirige a la URL firmada de 60 s).
//   GET ?formato=json                      → la misma URL firmada en JSON (la foto de la ventana: WebKit no sigue la redirección en un <img>).
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  const u = { id: user.id, email: user.email ?? null };
  const b = (await request.json().catch(() => ({}))) as { accion?: unknown; mime?: unknown; bytes?: unknown; id?: unknown };
  if (b.accion === "subir") {
    const r = await pedirSubida(admin, u, { mime: b.mime, bytes: b.bytes });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : r.error === "sin-orden" ? 409 : 400 });
    return NextResponse.json({ ok: true, id: r.id, path: r.path, token: r.token }, { headers: { "Cache-Control": "no-store" } });
  }
  if (b.accion === "listo") {
    if (typeof b.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return NextResponse.json({ error: "datos" }, { status: 400 });
    const cliente = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
    const r = await confirmarSubida(admin, u, b.id, { leerIA: cliente ? (a) => leerPreaprobacionIA(cliente, a) : null }, contextoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "guardar" ? 500 : 400 });
    await capturarServidor({ event: "inv2_preaprobacion_subida", distinctId: user.id, correo: user.email ?? null, properties: { leida: r.leida } }).catch(() => false);
    return NextResponse.json({ ok: true });
  }
  if (b.accion === "sin-credito" || b.accion === "todavia-no") {
    const ok = b.accion === "sin-credito" ? await sinCredito(admin, u, contextoDe(request)) : await todaviaNo(admin, u, contextoDe(request));
    if (!ok) return NextResponse.json({ error: "guardar" }, { status: 500 });
    await capturarServidor({ event: b.accion === "sin-credito" ? "inv2_compra_sin_credito" : "inv2_preaprobacion_todavia_no", distinctId: user.id, correo: user.email ?? null, properties: {} }).catch(() => false);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "accion" }, { status: 400 });
}

export async function GET(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  const { doc } = await leerPreaprobacion(admin, user.id);
  const url = doc ? await urlDocumento(admin, doc) : null;
  if (!url) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  if (new URL(request.url).searchParams.get("formato") === "json") return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
}
