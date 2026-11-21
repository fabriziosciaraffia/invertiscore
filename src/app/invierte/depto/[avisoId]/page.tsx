import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { DEPTO_COPY } from "@/lib/invierte-v2/depto-flujo";
import { leerPaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VistaDepto } from "@/components/invierte-v2/VistaDepto";

// LA PÁGINA DE UN DEPTO (etapa 3, B1, 21-nov-2026; láminas 4.1 y 4.2): a donde lleva la tarjeta de la base. Solo para sus deptos
// elegidos; otro depto (o uno que dejó de estar entre los suyos) vuelve a /invierte, que decide. Sin acceso: 404. Lo que dibuja vive
// en VistaDepto (la misma que muestra /dev/invierte-v2/depto con datos de muestra).
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function DeptoPage({ params }: { params: { avisoId: string } }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const p = await leerPaginaDepto(createServiceClient(), user.id, decodeURIComponent(params.avisoId));
  if (!p) redirect(URL_INVIERTE);
  return (
    <MarcoInvierte volver={null} pantalla="depto" layout="contenido" cabecera={DEPTO_COPY.cabecera} pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }} miInversion>
      <VistaDepto p={p} />
    </MarcoInvierte>
  );
}
