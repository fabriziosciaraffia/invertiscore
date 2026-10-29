import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import type { EleccionesDeptos } from "@/lib/deptos/respuesta";
import { detalleExplorar, perfilDelPedido } from "@/lib/explorar/abierto";
import { esPuertaDeptos, guardarPendienteGoogle } from "@/lib/deptos/servidor";
import { ipDelRequest } from "@/lib/api-helpers/anon-cap";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/google { elecciones } (16-oct-2026): antes de irse a Google, lo elegido en /deptos queda guardado con
// una clave al azar (todavía no se sabe el correo) y la clave vuelve, para viajar en el destino de vuelta. El callback la
// pasa a nombre del correo (reclavarPendienteGoogle) y la cuenta nace igual que por código. El mismo tope por IP que el
// pedido del código.
// ─────────────────────────────────────────────────────────────────────────────

const VENTANA_MS = 60 * 60 * 1000;
const TOPE_POR_IP = 12;
const pedidos = new Map<string, number[]>();

function topado(ip: string): boolean {
  const ahora = Date.now();
  const xs = (pedidos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  xs.push(ahora);
  pedidos.set(ip, xs);
  return xs.length > TOPE_POR_IP;
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { elecciones?: Partial<EleccionesDeptos>; filtros?: unknown; puerta?: unknown; detalle?: unknown };
  const v = perfilDelPedido(b);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (topado(ipDelRequest(request))) return NextResponse.json({ error: "tope" }, { status: 429 });
  try {
    const puerta = esPuertaDeptos(b.puerta) ? b.puerta : null;
    const p = await guardarPendienteGoogle(createServiceClient(), v.perfil, puerta, puerta === "E" ? detalleExplorar(typeof b.detalle === "string" ? b.detalle : null) : null);
    return NextResponse.json({ p });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/deptos/google", operacion: "pendiente" });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
