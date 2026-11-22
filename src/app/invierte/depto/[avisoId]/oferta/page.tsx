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
import { OfertaForm } from "@/components/invierte-v2/OfertaForm";

// LA OFERTA QUE RECOMIENDA FRANCO (etapa 3, B3; lámina 5.1). Solo con el depto listo, la preaprobación que deja ofertar y la oferta
// todavía en borrador (firmada, vuelve a la página del depto). ?monto=UF vuelve con el monto que la persona había elegido.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

export default async function OfertaPage({ params, searchParams }: { params: { avisoId: string }; searchParams: { monto?: string } }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const avisoId = decodeURIComponent(params.avisoId);
  const admin = createServiceClient();
  const p = await leerPaginaDepto(admin, user.id, avisoId);
  if (!p) redirect("/invierte");
  const o = p.oferta;
  if (p.etapa !== "listo" || !puedeOfertar(p.preaprobacion) || !o || o.estado !== "borrador") redirect(urlDepto(avisoId));
  const cfg = await leerConfigRango(admin);
  const monto = Number(searchParams.monto);
  return (
    <MarcoInvierte volver={null} pantalla="oferta" layout="formulario" cabecera={OFERTA_COPY.cabecera} pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={urlDepto(avisoId)} className="iv2-mi-inversion-a" data-inv2="volver-depto">← Depto de {p.datos.comuna ?? "tu lista"}</Link></div>
      <div className="inv-encabezado iv2-sumar-cab">
        <h1 className="iv2-titulo-res" id="iv2-t">{OFERTA_COPY.titulo}</h1>
        <p className="iv2-depto-s" data-inv2="oferta-depto">{p.tituloConNumero} · {lineaDepto(p.datos)} · publicado en UF {fmtUF(o.publicadoUF)}</p>
      </div>
      <OfertaForm avisoId={avisoId} urlFirmar={`${urlOferta(avisoId)}/firmar`} postura={o.postura} pisoUF={o.pisoUF} recomendadoUF={o.recomendadoUF} altoUF={o.altoUF}
        publicadoUF={o.publicadoUF} razones={o.razones} avisoFuertePct={cfg.avisoFuertePct} montoInicial={Number.isFinite(monto) && monto > 0 ? monto : null} />
    </MarcoInvierte>
  );
}
