import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { PERFIL_COPY } from "@/lib/invierte-v2/perfil";
import { URL_BASE, URL_INVIERTE, URL_OPCIONES } from "@/lib/invierte-v2/destino";
import { adoptarPerfilAsesoria } from "@/lib/invierte-v2/asesoria-servidor";
import { contextoPerfil } from "@/lib/invierte-v2/perfil-servidor";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { primerNombre } from "@/lib/invierte-v2/flujo";
import { FranjaOrden } from "@/components/invierte-v2/FranjaOrden";
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
  const orden = await ultimaOrdenDe(admin, user.id);
  if (!orden) redirect(URL_INVIERTE);
  // EL PERFIL DE LA ASESORÍA MANDA (27-nov-2026): quien llega con él no vuelve a contestar su perfil; se usa tal cual, se suman sus
  // deptos elegidos y va directo a «Tus deptos» (asesoria-servidor.ts; en el paseo, «Tu resultado» los escondía tras los parecidos). Una sola vez: después, esta página es para editarlo.
  if ((await adoptarPerfilAsesoria(admin, { id: user.id, email: user.email ?? null })).adoptado) redirect(URL_BASE);
  const [c, pre] = await Promise.all([contextoPerfil(admin, user.id), leerPreaprobacion(admin, user.id)]);
  const g = c.guardado;
  // La primera vez (sin perfil guardado: recién firmó, o vuelve desde Partimos) lleva la franja «Orden firmada» y el saludo; al
  // editar, no (decisión de Fabrizio, 19-nov-2026).
  const primeraVez = g == null;
  return (
    <MarcoInvierte volver={volverPerfil(searchParams.volver, g != null)} pantalla="perfil" layout="formulario" cabecera={PERFIL_COPY.titulo} pc={{ sesionEmail: user.email ?? null, invierte: true }} miInversion={!primeraVez}
      franja={primeraVez ? <FranjaOrden orden={orden} /> : undefined}>
      <PerfilForm inicial={{
        primeraVez: primeraVez ? { nombre: primerNombre(orden.nombre, orden.nombres) } : undefined,
        comunas: c.comunas, donde: g?.donde ?? "cerca", deEntrada: c.deEntrada, dePerfil: c.dePerfil, pieSugeridoUF: c.pieSugeridoUF, pieAyudaUF: c.pieAyudaUF, pieNoSabe: g?.topeSupuestos?.pieNoSabe === true,
        objetivo: g?.objetivo ?? null, preocupaciones: g?.preocupaciones ?? [], preaprobado: g?.preaprobado ?? null,
        montoPreaprobadoUF: g?.montoPreaprobadoUF ?? null, pieTiene: g?.pieTiene ?? null, rentaCLP: g?.rentaCLP ?? null,
        otrasCuotasCLP: g?.otrasCuotasCLP ?? null, noDiceRenta: g?.noDiceRenta ?? false,
        puedeSubirPreaprobacion: pre.estado === "subir" || pre.estado === "por_corregir" || pre.estado === "explicando",
      }} />
    </MarcoInvierte>
  );
}
