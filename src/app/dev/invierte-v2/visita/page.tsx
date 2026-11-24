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

// Fotos de ejemplo (?fotos=n): dibujos de distintas proporciones, para revisar que la tira y el visor las muestran completas.
const FOTO_EJEMPLO = (w: number, h: number, t: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#D9DEE6"/><rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="none" stroke="#2B558F" stroke-width="6"/><text x="50%" y="50%" font-family="Inter,Arial" font-size="${Math.round(Math.min(w, h) / 6)}" fill="#141414" text-anchor="middle" dominant-baseline="middle">${t}</text></svg>`)}`;
const FOTOS_EJEMPLO = [FOTO_EJEMPLO(1200, 800, "Baño"), FOTO_EJEMPLO(800, 1200, "Cocina"), FOTO_EJEMPLO(1000, 1000, "Living"), FOTO_EJEMPLO(1600, 600, "Vista")];

export default function VisitaDemo({ searchParams }: { searchParams: { caso?: string; fotos?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const caso = searchParams.caso === "arreglo" || searchParams.caso === "aceptada" ? searchParams.caso : "coincide";
  const volver = "/dev/invierte-v2/depto?etapa=listo&confirmada=1&oferta=contraoferta&visita=hecha";
  return (
    <MarcoInvierte volver={null} pantalla="reporte-visita" layout="formulario" cabecera={VISITA_COPY.reporteT} pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={volver} className="iv2-mi-inversion-a">← Av. Grecia 1250</Link></div>
      {(() => {
        const n = Math.min(12, Math.max(0, Number(searchParams.fotos) || 0));
        const v = { ...visitaMuestra(caso), fotos: Array.from({ length: n }, (_, i) => ({ path: `ejemplo-${i}`, mini: `ejemplo-${i}-mini` })) };
        return <ReporteVisita v={v} volverA={volver} aceptada={caso === "aceptada"} muestraFotos={n ? FOTOS_EJEMPLO : null} />;
      })()}
    </MarcoInvierte>
  );
}
