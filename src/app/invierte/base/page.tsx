import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { primerNombre } from "@/lib/invierte-v2/flujo";
import { BASE_COPY } from "@/lib/invierte-v2/base";
import { leerBase } from "@/lib/invierte-v2/base-servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VistaBase } from "@/components/invierte-v2/VistaBase";

// LA BASE (etapa 2, entrega 2, 19-nov-2026; láminas 3.3-base y 3.3-base-pc). La pantalla a la que siempre vuelve; lo que dibuja
// vive en VistaBase (la misma que muestra /dev/invierte-v2/base con datos de muestra). Sin acceso: 404; sin orden o sin elegidos:
// /invierte decide.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function BasePage() {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const base = await leerBase(createServiceClient(), user.id);
  if (!base || !base.elegidos.length) redirect(URL_INVIERTE);
  const nombre = primerNombre(base.orden.nombre, base.orden.nombres);
  return (
    <MarcoInvierte volver={null} pantalla="base" layout="contenido" cabecera={nombre ? BASE_COPY.hola(nombre) : BASE_COPY.titulo} pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }}>
      <VistaBase base={base} />
    </MarcoInvierte>
  );
}
