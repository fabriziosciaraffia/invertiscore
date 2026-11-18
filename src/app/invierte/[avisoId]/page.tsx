import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { esPie, esUrgencia } from "@/lib/invierte/invierte";
import { URL_PARTIMOS } from "@/lib/invierte-v2/destino";
import { leerPersona, ordenVigenteDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, analysisDe, deptoParaPagina, origenDe, sesionYAcceso, volverAlOrigen } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ContactoForm } from "@/components/invierte-v2/ContactoForm";

// 1.2 Contacto, paso 1 de 2 (etapa 1 de Invierte con Franco, 18-nov-2026). Sin acceso: 404. Ya firmó la versión vigente:
// Partimos (en esta etapa no se suman deptos). Con el modo «todos», se contesta sin sesión.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function ContactoPage({ params, searchParams }: { params: { avisoId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const { user, acceso } = await sesionYAcceso();
  if (!acceso) notFound();
  const depto = await deptoParaPagina(params.avisoId);
  if (!depto) notFound();
  let inicial = null;
  if (user) {
    const admin = createServiceClient();
    const [orden, persona] = await Promise.all([ordenVigenteDe(admin, user.id), leerPersona(admin, user.id)]);
    if (orden) redirect(URL_PARTIMOS);
    if (persona) inicial = { urgencia: esUrgencia(persona.urgencia) ? persona.urgencia : null, pie: esPie(persona.pie) ? persona.pie : null, whatsapp: persona.whatsapp };
  }
  const origen = origenDe(searchParams);
  return (
    <MarcoInvierte volver={volverAlOrigen(depto.avisoId, origen, analysisDe(searchParams))} pantalla="contacto" pc={{ sesionEmail: user?.email ?? null }}>
      <ContactoForm depto={depto} origen={origen} analysisId={analysisDe(searchParams)} inicial={inicial} sinSesion={!user} />
    </MarcoInvierte>
  );
}
