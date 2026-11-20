// /dev/invierte-v2/detalles (20-nov-2026): lo que los detalles en modo Invierte ponen alrededor del informe —la barra con «← Mi
// inversión» y el chip, el depto con sus fotos y «Lo que ve Franco», y la acción de abajo—, con un aviso REAL (?aviso=uuid: sus
// fotos guardadas y su lectura), para revisar en pantalla los casos que la cuenta de prueba no tiene: sin fotos, con alerta grave,
// su depto de entrada antes de elegir. El informe va como un bloque de muestra. Sin escrituras.
//   ?relacion=entrada (por defecto) | suyo | recomendado · ?alcanza=0 la entrada fuera de alcance
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { fotosDe } from "@/lib/invierte-v2/fotos-servidor";
import { leerLecturas } from "@/lib/invierte-v2/lectura-franco-servidor";
import type { ModoDetalles } from "@/lib/invierte-v2/detalles-modo";
import { AccionDetalles, BarraDetalles, CabeceraDetalles, CabezaDeDetalles } from "@/components/invierte-v2/DetallesInvierte";
import { HeaderFranco } from "@/components/chrome/HeaderFranco";

export const dynamic = "force-dynamic";

export default async function DetallesDemo({ searchParams }: { searchParams: { aviso?: string; relacion?: string; alcanza?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const avisoId = /^[0-9a-f-]{36}$/i.test(searchParams.aviso ?? "") ? searchParams.aviso! : "00000000-0000-0000-0000-000000000000";
  const admin = createServiceClient();
  const [fotos, lecturas] = await Promise.all([fotosDe(admin, [avisoId]), leerLecturas(admin, [avisoId])]);
  const cabeza = { avisoId, nombre: "Santiago · 4D2B · 96 m²", veredicto: "COMPRAR", score: 79, fotos: fotos[avisoId] ?? 0, lectura: lecturas[avisoId] ?? null };
  const relacion = searchParams.relacion === "suyo" || searchParams.relacion === "recomendado" ? searchParams.relacion : "entrada";
  const modo: ModoDetalles = relacion === "suyo" ? { cabeza, relacion, whatsapp: "56900000000" }
    : relacion === "recomendado" ? { cabeza, relacion, avisoId, linea: "Franco te lo recomienda: a 6 cuadras del tuyo, te deja $139.000 al mes.", activos: [] }
    : { cabeza, relacion, avisoId, alcanza: searchParams.alcanza !== "0", activos: [] };
  return (
    <>
      <div className="iv2-det-solo-movil"><CabeceraDetalles /></div>
      <div className="iv2-det-solo-pc"><HeaderFranco sesion={{ email: "muestra@ejemplo.cl" }} invierte="inversion" /></div>
      <BarraDetalles modo={modo} />
      <div className="container mx-auto max-w-6xl px-4 py-8 iv2-con-det-accion">
        <CabezaDeDetalles modo={modo} />
        <section style={{ border: "1px dashed var(--franco-border)", borderRadius: 16, padding: 24, minHeight: 600, color: "var(--franco-text-muted)" }}>El informe de siempre va aquí.</section>
      </div>
      <AccionDetalles modo={modo} />
    </>
  );
}
