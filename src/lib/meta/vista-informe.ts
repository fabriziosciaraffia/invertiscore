/**
 * ViewContent (15-oct-2026, medición para la campaña): el DUEÑO ve su informe —con sesión, el dueño anónimo con su
 * cookie, o su navegador de origen (oferta-informe.ts › quienMiraElInforme)—, con el veredicto y la comuna. Sale una
 * vez por informe, desde el servidor al dibujar la página; el espejo baja al cliente como prop y el pixel lo repite
 * con el mismo id. Nadie más lo dispara: ni un informe compartido, ni el demo, ni el admin mirando.
 */
import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase/service";
import { EVENTOS_META, idVistaInforme } from "@/lib/meta/ids";
import { contextoDeCabeceras, emitirEventoMeta } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";

export async function emitirVistaInforme(p: {
  analysisId: string;
  /** El dueño, si la fila tiene (la cuenta de la sesión o la que reclamó el informe). */
  userId: string | null;
  email: string | null;
  veredicto: string | null;
  comuna: string | null;
  modalidad: "ltr" | "str";
  ruta: string;
}): Promise<EventoEspejo | null> {
  try {
    const h = headers();
    const e = await emitirEventoMeta(createServiceClient(), {
      evento: EVENTOS_META.vistaInforme,
      eventId: idVistaInforme(p.analysisId),
      userId: p.userId,
      email: p.email,
      datos: { content_ids: [p.analysisId], content_type: "product", veredicto: p.veredicto, comuna: p.comuna, modalidad: p.modalidad },
      contexto: contextoDeCabeceras(h, `https://${h.get("host") ?? "refranco.ai"}${p.ruta}`),
      origen: "informe",
    });
    waitUntil(e.envio);
    return e.espejo;
  } catch (err) {
    console.error("[meta] vista del informe:", err);
    return null;
  }
}
