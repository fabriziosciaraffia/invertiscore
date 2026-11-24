// /dev/invierte-v2/visita (24-nov-2026; lámina 4.4 del 24-nov): el reporte de la visita con datos de muestra, sin cuentas ni escrituras.
//   ?caso=coincide (por defecto) | arreglo (un arreglo que no se veía en las fotos: la sugerencia baja) | aceptada (con la oferta aceptada)
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { ReporteVisita } from "@/components/invierte-v2/ReporteVisita";
import { VISITA_COPY } from "@/lib/invierte-v2/visita";
import { visitaMuestra } from "@/lib/invierte-v2/muestra-visita";

export const dynamic = "force-dynamic";

export default function VisitaDemo({ searchParams }: { searchParams: { caso?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const caso = searchParams.caso === "arreglo" || searchParams.caso === "aceptada" ? searchParams.caso : "coincide";
  const volver = "/dev/invierte-v2/depto?etapa=listo&confirmada=1&oferta=contraoferta&visita=hecha";
  return (
    <MarcoInvierte volver={null} pantalla="reporte-visita" layout="formulario" cabecera={VISITA_COPY.reporteT} pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={volver} className="iv2-mi-inversion-a">← Av. Grecia 1250</Link></div>
      <ReporteVisita v={visitaMuestra(caso)} volverA={volver} aceptada={caso === "aceptada"} />
    </MarcoInvierte>
  );
}
