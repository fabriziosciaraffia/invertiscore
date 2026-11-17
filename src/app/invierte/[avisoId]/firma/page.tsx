import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { deptoDeLinea } from "@/lib/invierte-v2/orden";
import { URL_PARTIMOS, urlFirma } from "@/lib/invierte-v2/destino";
import { leerPersona, ordenVigenteDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, analysisDe, deptoParaPagina, origenDe, sesionYAcceso, volverAlOrigen } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { FirmaForm } from "@/components/invierte-v2/FirmaForm";

// 2.1 Firma, paso 2 de 2 (etapa 1 de Invierte con Franco, 18-nov-2026). Sin acceso: 404. Sin sesión (modo «todos»): la cuenta
// se pide acá, con el registro de siempre, y se vuelve a esta misma pantalla. Ya firmó la versión vigente: Partimos.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function FirmaPage({ params, searchParams }: { params: { avisoId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const { user, acceso } = await sesionYAcceso();
  if (!acceso) notFound();
  const depto = await deptoParaPagina(params.avisoId);
  if (!depto) notFound();
  const origen = origenDe(searchParams);
  const analysisId = analysisDe(searchParams);
  if (!user) redirect(`/register?next=${encodeURIComponent(urlFirma(depto.avisoId, origen, analysisId))}`);
  const admin = createServiceClient();
  const [orden, persona] = await Promise.all([ordenVigenteDe(admin, user.id), leerPersona(admin, user.id)]);
  if (orden) redirect(URL_PARTIMOS);
  return (
    <MarcoInvierte volver={volverAlOrigen(depto.avisoId, origen, analysisId)} paso={FLUJO_COPY.paso2} pantalla="firma" layout="firma" pc={{ sesionEmail: user.email ?? null, rotulo: FLUJO_COPY.rotuloFirma }}>
      <FirmaForm depto={depto} deptoCorto={deptoDeLinea(depto.linea)} origen={origen} analysisId={analysisId} sinContacto={!persona} />
    </MarcoInvierte>
  );
}
