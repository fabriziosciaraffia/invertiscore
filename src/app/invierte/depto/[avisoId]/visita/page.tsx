import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { urlDepto } from "@/lib/invierte-v2/depto-flujo";
import { leerPaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ReporteVisita } from "@/components/invierte-v2/ReporteVisita";
import { VISITA_COPY } from "@/lib/invierte-v2/visita";

// EL REPORTE DE LA VISITA (24-nov-2026; lámina 4.4 del 24-nov). Solo lectura y solo con el reporte publicado; si no, vuelve al depto.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function ReporteVisitaPage({ params }: { params: { avisoId: string } }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const avisoId = decodeURIComponent(params.avisoId);
  const p = await leerPaginaDepto(createServiceClient(), user.id, avisoId);
  if (!p) redirect("/invierte");
  if (!p.visita || p.visita.estado !== "reporte_publicado") redirect(urlDepto(avisoId));
  const aceptada = p.oferta?.estado === "aceptada_sujeta" || p.visita.pedidaDesde === "aceptada";
  return (
    <MarcoInvierte volver={null} pantalla="reporte-visita" layout="formulario" cabecera={VISITA_COPY.reporteT} pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={urlDepto(avisoId)} className="iv2-mi-inversion-a" data-inv2="volver-depto">← {p.direccion ?? p.tituloConNumero}</Link></div>
      <ReporteVisita v={p.visita} volverA={urlDepto(avisoId)} aceptada={aceptada} />
    </MarcoInvierte>
  );
}
