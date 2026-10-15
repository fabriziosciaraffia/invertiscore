/**
 * El Lead desde el navegador (15-oct-2026): alguien dejó su correo. El servidor decide —un Lead por correo, fuera las
 * cuentas de prueba— y deja el espejo en la cookie de la respuesta; acá se consume en el acto para que el pixel lo
 * repita con el mismo id. Nunca lanza: un Lead perdido no frena el registro.
 */
import { consumirCookieEspejo, espejarMeta } from "@/lib/meta/espejo";
import type { Puerta } from "@/lib/atribucion-puerta";

export type OrigenLead = "banner" | "seleccion" | "invitado";

export async function avisarLead(email: string, origen: OrigenLead, puerta?: Puerta): Promise<void> {
  try {
    await fetch("/api/meta/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, origen, ...(puerta ? { puerta } : {}) }),
    });
    espejarMeta(consumirCookieEspejo());
  } catch {
    /* el Lead se pierde; el registro sigue */
  }
}
