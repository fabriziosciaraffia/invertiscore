import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { lineaDepto } from "@/lib/invierte-v2/base";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { urlContraoferta, urlDepto, urlOferta } from "@/lib/invierte-v2/depto-flujo";
import { rondaDesde } from "@/lib/invierte-v2/b4-servidor";
import { leerPaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import { FIRMA_COPY as F, topeOferta } from "@/lib/invierte-v2/rango";
import { textoOferta } from "@/lib/invierte-v2/oferta-documento";
import { PREAPROB_COPY, puedeOfertar } from "@/lib/invierte-v2/preaprobacion";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { fechaLarga } from "@/lib/invierte-v2/rango-servidor";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { FirmaOfertaForm } from "@/components/invierte-v2/FirmaOfertaForm";
import { VerPreaprobacion } from "@/components/invierte-v2/Preaprobacion";

// REVISA Y FIRMA TU OFERTA (etapa 3, B3; láminas 5.1b del 23-nov-2026). ?monto=UF, el que eligió en la oferta (sin él, vuelve a la oferta).
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;


export default async function FirmarOfertaPage({ params, searchParams }: { params: { avisoId: string }; searchParams: { monto?: string; desde?: string; retirarOtra?: string } }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const avisoId = decodeURIComponent(params.avisoId);
  const monto = Math.round(Number(searchParams.monto));
  if (!(monto > 0)) redirect(urlOferta(avisoId));
  const admin = createServiceClient();
  // B4, una ronda nueva (?desde=<oferta>): aceptar su precio, proponer otro monto, reactivar una respuesta fuera de plazo o volver a
  // presentar una oferta vencida. El monto tiene que caber en lo que esa oferta admite (rondaDesde); el servidor lo valida de nuevo.
  const desdeId = typeof searchParams.desde === "string" && searchParams.desde ? searchParams.desde : null;
  const [p, pre, orden] = await Promise.all([leerPaginaDepto(admin, user.id, avisoId, { nuevaRonda: !desdeId }), leerPreaprobacion(admin, user.id), ultimaOrdenDe(admin, user.id)]);
  if (!p) redirect("/invierte");
  const desde = desdeId ? (p.oferta?.id === desdeId ? p.oferta : p.cierre?.id === desdeId ? p.cierre : null) : null;
  const ronda = desde ? rondaDesde(desde) : null;
  if (desdeId && (!desde || !ronda || monto < ronda.minUF || monto > ronda.maxUF)) redirect(urlDepto(avisoId));
  const o = desde ?? p.oferta;
  if (p.etapa !== "listo" || !puedeOfertar(p.preaprobacion) || !o || (!desde && o.estado !== "borrador") || !orden) redirect(urlDepto(avisoId));
  // El tope duro: un monto sobre lo publicado (escrito en la dirección) vuelve a la oferta con el publicado como monto.
  if (monto > topeOferta(o.publicadoUF)) redirect(`${urlOferta(avisoId)}?monto=${topeOferta(o.publicadoUF)}`);
  const sinCredito = pre.estado === "sin_credito";
  const conPre = F.conPreaprobacion(pre.doc?.banco ?? null, pre.doc?.montoAprobadoUF ?? null, fechaLarga(pre.doc?.vigenteHasta ?? null));
  const pagas = sinCredito ? F.sinCredito : `${F.pieYCredito(Math.round(monto * 0.2))}, ${conPre.replace(/^Con/, "con")}`;
  const documento = textoOferta({ nombre: orden.nombre, rut: orden.rut, depto: [p.tituloConNumero, lineaDepto(p.datos)].join(" · "), montoUF: monto, publicadoUF: o.publicadoUF, pagas, sujetaAVisita: true, vigenciaDias: 5 });
  const pagasLinea = sinCredito ? null : <>{F.preaprobacion(pre.doc?.banco ?? null, pre.doc?.montoAprobadoUF ?? null)} · <VerPreaprobacion etiqueta={F.ver} estado="Aprobada" titulo={PREAPROB_COPY.cabecera} meta={conPre} mime={pre.doc?.mime ?? null} /></>;
  return (
    <MarcoInvierte volver={null} pantalla="firmar-oferta" layout="formulario" cabecera="Tu oferta" pc={{ sesionEmail: user.email ?? null, invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href={desde ? (ronda?.tipo === "contra" || ronda?.tipo === "tardia_contra" ? urlContraoferta(avisoId) : urlDepto(avisoId)) : `${urlOferta(avisoId)}?monto=${monto}`} className="iv2-mi-inversion-a" data-inv2="cambiar-precio">← {F.volver}</Link></div>
      <div className="inv-encabezado iv2-sumar-cab">
        <h1 className="iv2-titulo-res" id="iv2-t">{F.titulo}</h1>
        <p className="iv2-depto-s" data-inv2="firma-depto">{p.direccion ?? p.tituloConNumero} · {lineaDepto(p.datos)}<span className="iv2-fo-pub"> · publicado en UF {fmtUF(o.publicadoUF)}</span></p>
      </div>
      <FirmaOfertaForm avisoId={avisoId} montoUF={monto} publicadoUF={o.publicadoUF} documento={documento} urlVolver={urlDepto(avisoId)} desdeId={desde?.id ?? null} retirarOtra={searchParams.retirarOtra === "1"}
        pagas={sinCredito ? F.sinCredito : F.pieYCredito(Math.round(monto * 0.2))} pagasLinea={pagasLinea} />
    </MarcoInvierte>
  );
}
