import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { esOrigen } from "@/lib/invierte/invierte";
import { destinoInvierte } from "@/lib/invierte-v2/destino";
import { leerPersona, ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";

// /invierte (18-nov-2026, decisión de Fabrizio): la dirección única del flujo. Los correos y mensajes que no piden una acción
// puntual enlazan acá —el botón «Seguir con mi inversión» de la copia de la orden, por ejemplo— y la ruta decide según el
// estado de la persona (destinoInvierte, destino.ts): sin sesión pide entrar y vuelve; sin acceso, 404 como las demás rutas
// nuevas; con orden firmada, Partimos; con el contacto a medias, la firma de su depto; si no, el mapa.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function InviertePage() {
  const { user, acceso } = await sesionYAcceso();
  let firmo = false;
  let contacto: { avisoId: string; origen: "explorar" | "informe" | "seleccion" } | null = null;
  if (user && acceso) {
    const admin = createServiceClient();
    const [orden, persona] = await Promise.all([ultimaOrdenDe(admin, user.id), leerPersona(admin, user.id)]);
    firmo = !!orden;
    if (persona && esOrigen(persona.origen)) contacto = { avisoId: persona.avisoOrigen, origen: persona.origen };
  }
  const d = destinoInvierte({ sesion: !!user, acceso, firmo, contacto });
  if (d.tipo === "no-existe") notFound();
  redirect(d.url);
}
