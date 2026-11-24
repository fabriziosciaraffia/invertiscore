import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { lineaDepto } from "@/lib/invierte-v2/base";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { urlDepto, urlOferta } from "@/lib/invierte-v2/depto-flujo";
import { leerPaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { leerConfigRango } from "@/lib/invierte-v2/rango-servidor";
import { OFERTA_COPY } from "@/lib/invierte-v2/rango";
import { puedeOfertar } from "@/lib/invierte-v2/preaprobacion";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { esMotorFijo } from "@/lib/invierte-v2/cifras-motor";
import { rondaDesde } from "@/lib/invierte-v2/b4-servidor";
import { OfertaForm } from "@/components/invierte-v2/OfertaForm";

// LA OFERTA QUE RECOMIENDA FRANCO (etapa 3, B3; lámina 5.1). Solo con el depto listo, la preaprobación que deja ofertar y la oferta
// todavía en borrador (firmada, vuelve a la página del depto). ?monto=UF vuelve con el monto que la persona había elegido.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function OfertaPage({ params, searchParams }: { params: { avisoId: string }; searchParams: { monto?: string; desde?: string } }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const avisoId = decodeURIComponent(params.avisoId);
  const admin = createServiceClient();
  // B4, «Proponer otro monto» (?desde=<oferta>): la misma pantalla, con el piso en la oferta anterior y el tope en lo que piden.
  const desdeId = typeof searchParams.desde === "string" && searchParams.desde ? searchParams.desde : null;
  const p = await leerPaginaDepto(admin, user.id, avisoId, { nuevaRonda: !desdeId });
  if (!p) redirect("/invierte");
  const desde = desdeId ? (p.oferta?.id === desdeId ? p.oferta : p.cierre?.id === desdeId ? p.cierre : null) : null;
  const ronda = desde ? rondaDesde(desde) : null;
  // La visita (24-nov-2026): «Ajustar el precio con lo que viste» desde la aceptada, con el piso del rango recalculado.
  if (desdeId && (!desde || !ronda || (ronda.tipo !== "contra" && ronda.tipo !== "tardia_contra" && ronda.tipo !== "ajustar"))) redirect(urlDepto(avisoId));
  const o = desde ?? p.oferta;
  if (p.etapa !== "listo" || !puedeOfertar(p.preaprobacion) || !o || (!desde && o.estado !== "borrador")) redirect(urlDepto(avisoId));
  const cfg = await leerConfigRango(admin);
  const monto = Number(searchParams.monto);
  return (
    <MarcoInvierte volver={null} pantalla="oferta" layout="formulario" cabecera={OFERTA_COPY.cabecera} pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={urlDepto(avisoId)} className="iv2-mi-inversion-a" data-inv2="volver-depto">← {p.direccion ?? p.tituloConNumero}</Link></div>
      <div className="inv-encabezado iv2-sumar-cab">
        <h1 className="iv2-titulo-res" id="iv2-t">{OFERTA_COPY.titulo}</h1>
        <p className="iv2-depto-s" data-inv2="oferta-depto">{lineaDepto(p.datos)} · publicado en UF {fmtUF(o.publicadoUF)}</p>
      </div>
      <OfertaForm avisoId={avisoId} urlFirmar={desde ? `${urlOferta(avisoId)}/firmar?desde=${encodeURIComponent(desde.id)}${ronda?.tipo === "tardia_contra" && p.otraViva ? "&retirarOtra=1" : ""}` : `${urlOferta(avisoId)}/firmar`} postura={o.postura} pisoUF={o.pisoUF} recomendadoUF={o.recomendadoUF} altoUF={o.altoUF}
        publicadoUF={o.publicadoUF} razones={o.razones} avisoFuertePct={cfg.avisoFuertePct} comprarUF={o.comprarUF} montoInicial={Number.isFinite(monto) && monto > 0 ? monto : null}
        motor={esMotorFijo(p.ubicacion?.analisis?.motor) ? p.ubicacion.analisis.motor : null} minUF={ronda?.minUF ?? null} maxUF={ronda?.maxUF ?? null} />
    </MarcoInvierte>
  );
}
