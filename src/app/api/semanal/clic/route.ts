import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { capturarServidor } from "@/lib/posthog-servidor";
import { chequearAlClic, seleccionPorToken } from "@/lib/guia/semanal-servidor";
import { puedeEntrarPorCorreo, rutaSueltoSemanal } from "@/lib/guia/semanal";
import { entrarConCorreo } from "@/lib/guia/entrada-correo";
import { rutaTres } from "@/lib/tres-analisis";
import { RUTA_SUELTO_INMEDIATO } from "@/lib/guia/inmediato";
import { waitUntil } from "@vercel/functions";
import { EVENTOS_META, idSemanalClic } from "@/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/semanal/clic (02-oct-2026): todo enlace del correo semanal pasa por acá. Mide el clic
// (`semanal_clic`), y si es un depto, RELEE SU FICHA (con la memoria y el tope de siempre): si se
// despublicó, la página lo dice. «Analizar uno · $9.990» sin saldo va a comprar el suelto, marcado como
// venido del correo. El aviso inmediato (05-oct-2026) pasa por acá también: mide `aviso_inmediato_clic`
// y su compra va marcada como venida del aviso.
// Desde el 13-oct-2026 el enlace ENTRA SOLO: sin sesión en ese aparato y dentro de los 7 días desde que salió el
// correo, deja adentro al dueño de la selección (entrada-correo.ts); con otra sesión abierta no toca nada.
// «SemanalClic» (15-oct-2026, medición para la campaña): el evento propio de Meta para públicos, uno por selección y
// destino, desde el servidor (con el navegador de quien hizo clic) y con el espejo para el pixel en la redirección.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{20,80}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const t = url.searchParams.get("t") ?? "";
  const a = url.searchParams.get("a");
  const ir = url.searchParams.get("ir");
  let espejoSC: EventoEspejo | null = null;
  const volver = (ruta: string) => conEspejo(NextResponse.redirect(new URL(ruta, url.origin), 302), [espejoSC], request);
  if (!TOKEN.test(t)) return volver("/dashboard");

  const admin = createServiceClient();
  const sel = await seleccionPorToken(admin, t);
  if (!sel) return volver("/dashboard");
  const avisoId = a && UUID.test(a) && sel.items.some((i) => i.avisoId === a) ? a : null;
  const destino = ir === "comprar" ? "comprar" : ir === "tres" ? "tres" : ir === "perfil" ? "perfil" : avisoId ? "depto" : "seleccion";

  if (sel.fuente === "inmediato") {
    // Con `await` (13-oct-2026): con `void` la respuesta salía antes que el evento y se podía perder.
    await capturarServidor({ event: "aviso_inmediato_clic", distinctId: sel.user_id, properties: { dia: sel.semana, aviso_id: avisoId, destino } }).catch(() => {});
  } else {
    await capturarServidor({
      event: "semanal_clic",
      distinctId: sel.user_id as string,
      properties: { semana: sel.semana, variante: sel.variante, aviso_id: avisoId, destino },
    }).catch(() => {});
  }

  const sc = await emitirEventoMeta(admin, {
    evento: EVENTOS_META.semanalClic,
    eventId: idSemanalClic(t, avisoId ?? destino),
    userId: sel.user_id as string,
    datos: { destino, fuente: sel.fuente === "inmediato" ? "inmediato" : "semanal", ...(avisoId ? { aviso_id: avisoId } : {}) },
    contexto: contextoDeRequest(request),
    origen: "semanal-clic",
  });
  espejoSC = sc.espejo;
  waitUntil(sc.envio);

  // El enlace entra solo (13-oct-2026): antes de cualquier destino, que todos piden sesión.
  const sesion = createClient();
  const { data: { user: actual } } = await sesion.auth.getUser();
  if (puedeEntrarPorCorreo({ conSesion: !!actual, enviadaAt: sel.enviadaAt })) {
    const entro = await entrarConCorreo(admin, sesion, sel.user_id);
    await capturarServidor({ event: "entrada_por_correo", distinctId: sel.user_id, properties: { fuente: sel.fuente, ok: entro, destino } }).catch(() => {});
  }

  // El correo corto de la semana sin deptos (13-oct-2026) lleva a cambiar las comunas del perfil.
  if (ir === "perfil") return volver("/dashboard#perfil");
  // El pack de tres (13-oct-2026): la línea del semanal a quien no tiene análisis; después de pagar vuelve a la selección.
  if (ir === "tres") return volver(rutaTres(sel.fuente === "inmediato" ? "inmediato" : "semanal", { variante: sel.variante, volver: `/semanal?t=${t}` }));
  // `ir=comprar`: el suelto, que es lo que ofrecían los correos que lo llevan (el semanal hasta el 13-oct y el inmediato).
  if (ir === "comprar" && sel.fuente === "inmediato") return volver(RUTA_SUELTO_INMEDIATO);
  if (ir === "comprar") return volver(rutaSueltoSemanal(sel.variante as "banda" | "tarjetas" | null));
  if (!avisoId) return volver(`/semanal?t=${t}`);
  const estado = await chequearAlClic(admin, avisoId).catch(() => "sin-chequeo" as const);
  return volver(`/semanal?t=${t}&a=${avisoId}${estado === "despublicado" ? "&d=1" : ""}`);
}
