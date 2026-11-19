import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { PERFIL_COPY } from "@/lib/invierte-v2/perfil";
import { URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { contextoPerfil } from "@/lib/invierte-v2/perfil-servidor";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { PerfilForm } from "@/components/invierte-v2/PerfilForm";

// El perfil de inversión (etapa 2, 18-nov-2026; láminas 3.1): «Hacer mi perfil de inversión» de Partimos llega acá. Sin acceso:
// 404. Sin orden firmada: /invierte decide. Precarga las comunas (la del depto con que entró y las de su perfil guardado), el
// pie sugerido y, si ya lo hizo, lo que contestó; nada se guarda hasta «Ver mis opciones». «Volver» (20-nov-2026): a la pantalla
// del flujo que lo mandó (`?volver=/invierte/…`) o, si ya tenía perfil, a su inversión; la primera vez, nada (viene de Partimos).
function volverPerfil(v: string | string[] | undefined, yaTenia: boolean): string | null {
  if (typeof v === "string" && /^\/invierte\/[A-Za-z0-9_\-/?=&%.]*$/.test(v) && !v.startsWith("//")) return v;
  return yaTenia ? URL_INVIERTE : null;
}
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function PerfilPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const admin = createServiceClient();
  if (!(await ultimaOrdenDe(admin, user.id))) redirect(URL_INVIERTE);
  const [c, pre] = await Promise.all([contextoPerfil(admin, user.id), leerPreaprobacion(admin, user.id)]);
  const g = c.guardado;
  return (
    <MarcoInvierte volver={volverPerfil(searchParams.volver, g != null)} pantalla="perfil" layout="formulario" cabecera={PERFIL_COPY.titulo} pc={{ sesionEmail: user.email ?? null }}>
      <PerfilForm inicial={{
        comunas: c.comunas, deEntrada: c.deEntrada, dePerfil: c.dePerfil, pieSugeridoUF: c.pieSugeridoUF,
        objetivo: g?.objetivo ?? null, preocupaciones: g?.preocupaciones ?? [], preaprobado: g?.preaprobado ?? null,
        montoPreaprobadoUF: g?.montoPreaprobadoUF ?? null, pieTiene: g?.pieTiene ?? null, rentaCLP: g?.rentaCLP ?? null,
        otrasCuotasCLP: g?.otrasCuotasCLP ?? null, noDiceRenta: g?.noDiceRenta ?? false,
        puedeSubirPreaprobacion: pre.estado === "subir" || pre.estado === "por_corregir" || pre.estado === "explicando",
      }} />
    </MarcoInvierte>
  );
}
