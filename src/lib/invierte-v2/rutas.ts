// ─────────────────────────────────────────────────────────────────────────────
// LO COMÚN DE LAS RUTAS /api/invierte-v2/… (etapa 1, 18-nov-2026): la sesión, el interruptor (sin acceso: 404, como si la
// ruta no existiera), el contexto del pedido (IP y navegador) y las dependencias reales de la firma (el PDF y el correo).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendCopiaOrdenInvierte } from "@/lib/email";
import { accesoInvierteV2 } from "./acceso-servidor";
import { pdfOrden, horaChile } from "./orden-pdf";
import type { ContextoPedido, DepsFirma } from "./servidor";

export const NO_EXISTE = () => NextResponse.json({ error: "no-existe" }, { status: 404, headers: { "Cache-Control": "no-store" } });

/** La persona con sesión y acceso; si no, null (la ruta responde 404). */
export async function personaConAcceso(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (await accesoInvierteV2(user)) ? user : null;
}

export async function personaConSesion(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export function contextoDe(request: Request): ContextoPedido {
  const h = request.headers;
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
  };
}

export const DEPS_FIRMA: DepsFirma = {
  generarPdf: pdfOrden,
  enviarCopia: (p) => sendCopiaOrdenInvierte({ to: p.to, userId: p.userId, nombre: p.nombre.split(/\s+/)[0] ?? null, depto: p.depto, fecha: horaChile(p.firmadoAt).replace(/,.*$/, ""), pdf: p.pdf, ordenId: p.ordenId }),
};
