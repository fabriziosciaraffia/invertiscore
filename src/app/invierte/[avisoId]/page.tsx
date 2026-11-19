import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { esPie, esUrgencia } from "@/lib/invierte/invierte";
import { urlSumar } from "@/lib/invierte-v2/base";
import { leerPersona, ordenVigenteDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, analysisDe, deptoParaPagina, origenDe, sesionYAcceso, volverAlOrigen } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ContactoForm } from "@/components/invierte-v2/ContactoForm";

// 1.2 Contacto, paso 1 de 2 (etapa 1 de Invierte con Franco, 18-nov-2026). Sin acceso: 404. Ya firmó la versión vigente:
// «Súmalo a tus opciones» (entrega 2, 19-nov-2026: su orden cubre todos sus deptos; sin perfil, esa página lo manda a Partimos).
// Con el modo «todos», se contesta sin sesión.
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
    if (orden) redirect(`${urlSumar(depto.avisoId)}?${new URLSearchParams({ desde: origenDe(searchParams), ...(analysisDe(searchParams) ? { a: analysisDe(searchParams)! } : {}) })}`);
    if (persona) inicial = { urgencia: esUrgencia(persona.urgencia) ? persona.urgencia : null, pie: esPie(persona.pie) ? persona.pie : null, whatsapp: persona.whatsapp };
  }
  const origen = origenDe(searchParams);
  return (
    <MarcoInvierte volver={volverAlOrigen(depto.avisoId, origen, analysisDe(searchParams))} pantalla="contacto" pc={{ sesionEmail: user?.email ?? null }}>
      <ContactoForm depto={depto} origen={origen} analysisId={analysisDe(searchParams)} inicial={inicial} sinSesion={!user} />
    </MarcoInvierte>
  );
}
