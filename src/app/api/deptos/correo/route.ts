import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { CORREO_OK, type EleccionesDeptos } from "@/lib/deptos/respuesta";
import { detalleExplorar, perfilDelPedido } from "@/lib/explorar/abierto";
import { correoTieneCuenta, esPuertaDeptos, guardarPendiente } from "@/lib/deptos/servidor";
import { ipDelRequest } from "@/lib/api-helpers/anon-cap";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/correo { correo, elecciones } (16-oct-2026, la puerta B): antes de mandar el código, guarda lo que la
// persona eligió en /deptos (deptos_pendientes, por correo: la cuenta nace con ese perfil aunque el código se escriba en
// otro aparato) y anota si el correo ya tenía cuenta, para que el alta no la duplique (tipoDeAlta). Eso NO vuelve al
// navegador (16-oct-2026, decisión de Fabrizio): la pantalla dice lo mismo exista o no la cuenta, y nadie puede averiguar
// por acá si un correo está en Franco. El Lead de Meta lo manda la pantalla (/api/meta/lead, origen «seleccion»).
// Un tope por IP en memoria, como el del análisis anónimo: es solo para frenar el abuso obvio.
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
  const b = (await request.json().catch(() => ({}))) as { correo?: unknown; elecciones?: Partial<EleccionesDeptos>; filtros?: unknown; puerta?: unknown; detalle?: unknown };
  const correo = typeof b.correo === "string" ? b.correo.trim() : "";
  if (!CORREO_OK.test(correo)) return NextResponse.json({ error: "correo" }, { status: 400 });
  // Los chips de /deptos (o los de un pin de Explorar); en la puerta E, también los filtros de «Avísame de nuevos».
  const v = perfilDelPedido(b);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (topado(ipDelRequest(request))) return NextResponse.json({ error: "tope" }, { status: 429 });
  try {
    const admin = createServiceClient();
    const existe = await correoTieneCuenta(admin, correo);
    if (existe == null) return NextResponse.json({ error: "interno" }, { status: 500 });
    // La puerta (22-oct-2026): B en /deptos, C en la página del invitado; la mide `alta_perdida`. E (29-oct-2026): Explorar
    // sin cuenta, con el detalle de la llegada (landing o directo) para la atribución.
    const puerta = esPuertaDeptos(b.puerta) ? b.puerta : null;
    await guardarPendiente(admin, correo, v.perfil, existe, puerta, puerta === "E" ? detalleExplorar(typeof b.detalle === "string" ? b.detalle : null) : null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/deptos/correo", operacion: "pendiente" });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
