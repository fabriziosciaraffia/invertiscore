import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fichaCompartida, fichaCompartidaCacheada } from "@/lib/explorar/compartir-servidor";
import { segunLaNoche } from "@/lib/explorar/negociado-hoy";
import { esAvisoId } from "@/lib/explorar/enlace-compartido";
import { esTopeNegociar } from "@/lib/explorar/capa-negociar";
import { almacenFirmas, emitirFirma, sesionDe } from "@/lib/explorar/firmas-servidor";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { asegurarInvitacion } from "@/lib/referido-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/compartido { a, m?, n? } (02-nov-2026; firmada desde el 03-nov-2026, goal «los enlaces compartidos llevan
// una firma»): lo que necesita «Compartir» para armar el enlace y su texto, en el mismo toque.
//   · LA FIRMA del enlace para ese aviso y, con cuenta, para el código de invitación de quien comparte (lo pone el servidor:
//     nadie firma con el código de otro) — firma-compartido.ts. Con el tope de 60 por hora por sesión y por IP
//     (firmas-servidor.ts): pasado el tope, 429 y no hay enlace.
//   · CÓMO ESTÁ EL AVISO con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy) —«comprar» con su puntaje,
//     «no-da» o «despublicado»—, para quien mira con otro pie, plazo o tasa (el texto dice lo de por defecto, no lo suyo).
//   · CON `n=<tope>` (un negociado de la capa «Si negocias»): si no da Comprar, «negociado» con su precio negociado y su
//     descuento —los de la noche, como el texto de quien comparte con cuenta, que los saca del pin: sin la verificación de
//     hoy, que lee comparables y haría esperar a la hoja del sistema (negociado-hoy.ts › segunLaNoche)—, o «no-llega» si su
//     descuento no cabe en el tope. Lo pide también quien comparte SIN CUENTA un negociado (su precio no viajó al navegador).
// Hasta el 03-nov-2026 era un GET público en la caché del CDN: con él cualquiera leía el precio negociado de cualquier aviso.
// Ahora es POST, sin caché, y sale solo junto con una firma, bajo su mismo tope.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const RUTA = "POST /api/explorar/compartido";
const SIN_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { a?: unknown; m?: unknown; n?: unknown };
  const a = typeof b.a === "string" ? b.a.toLowerCase() : null;
  if (!esAvisoId(a)) return NextResponse.json({ error: "aviso" }, { status: 400, headers: SIN_CACHE });
  const modalidad = b.m === "str" ? "str" : "ltr";
  const tope = esTopeNegociar(b.n) ? Number(b.n) : null;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const admin = createServiceClient();
    const huella = huellaDeRequest(request);
    // El código de quien comparte lo pone el servidor: la firma lo incluye y el enlace lo lleva.
    const codigo = user ? (await asegurarInvitacion(admin, { userId: user.id, conNombre: false, dispositivo: huella.dispositivo }))?.codigo ?? null : null;
    const firma = await emitirFirma(almacenFirmas(admin), { avisoId: a, codigo, sesion: sesionDe(user?.id ?? null, huella.dispositivo), ip: huella.ip, conCuenta: !!user });
    if ("error" in firma) return NextResponse.json({ error: firma.error }, { status: firma.error === "tope" ? 429 : 503, headers: SIN_CACHE });
    const f = tope != null && modalidad === "ltr"
      ? await fichaCompartida(admin, a, "ltr", { veredicto: true, tope, verificar: segunLaNoche })
      : await fichaCompartidaCacheada(a, modalidad);
    if (!f) return NextResponse.json({ error: "no-existe" }, { status: 404, headers: SIN_CACHE });
    const neg = f.estado === "negociado" && f.neg ? { p: f.neg.p, d: f.neg.d } : null;
    return NextResponse.json({ firma: firma.firma, codigo, estado: f.estado, score: f.score, neg }, { headers: SIN_CACHE });
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "firma", extra: { modalidad } });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: SIN_CACHE });
  }
}
