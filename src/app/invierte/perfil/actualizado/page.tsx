import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { URL_BASE } from "@/lib/invierte-v2/destino";
import { ACTUALIZADO_COPY } from "@/lib/invierte-v2/base";
import { perfilActualizado } from "@/lib/invierte-v2/base-servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VistaActualizado } from "@/components/invierte-v2/VistaActualizado";

// PERFIL ACTUALIZADO (entrega 2, 19-nov-2026; lámina 3.3-perfil-editado). Después de cambiar pie, renta, comunas o
// preaprobación, quien ya había elegido deptos llega acá: se recalcula todo, Franco dice lo que cambió, qué deptos entran y cuáles
// quedan fuera de su alcance hoy (no se borran: quedan marcados). Compara contra la foto de sus deptos guardada al confirmar el
// perfil, así dice lo mismo aunque se recargue. «Ver mis opciones» lleva al resultado, con las nuevas para elegir. Sin acceso:
// 404; sin un cambio guardado: la base.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function PerfilActualizadoPage() {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const r = await perfilActualizado(createServiceClient(), { id: user.id, email: user.email ?? null });
  if (!r) redirect(URL_BASE);
  return (
    <MarcoInvierte volver={null} pantalla="perfil-actualizado" layout="formulario" cabecera={ACTUALIZADO_COPY.cabecera} pc={{ sesionEmail: user.email ?? null, invierte: true }} miInversion>
      <VistaActualizado r={r} />
    </MarcoInvierte>
  );
}
