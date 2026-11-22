// /dev/invierte-v2/oferta (etapa 3, B3, 22-nov-2026): las pantallas de la oferta con datos de muestra, sin cuentas ni escrituras.
//   ?pantalla=oferta (por defecto; lámina 5.1) | firmar (lámina 5.1b) · ?monto=UF (en oferta, el monto con que parte; en firmar, el que firma)
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { OfertaForm } from "@/components/invierte-v2/OfertaForm";
import { FirmaOfertaForm } from "@/components/invierte-v2/FirmaOfertaForm";
import { FIRMA_COPY as F, OFERTA_COPY } from "@/lib/invierte-v2/rango";
import { textoOferta } from "@/lib/invierte-v2/oferta-documento";

export const dynamic = "force-dynamic";

const R = { postura: "negocia_poco" as const, pisoUF: 2905, recomendadoUF: 2936, altoUF: 2967, publicadoUF: 3090 };
const RAZONES = ["Ya bajó UF 80 hace tres semanas: quien vende está dispuesto a moverse.", "En su mismo edificio se venden dos deptos parecidos más baratos: es un argumento para pedir rebaja.", "La cocina tiene muebles dañados y piso manchado: es un argumento concreto para pedir rebaja."];
const DEPTO = "Avenida Libertador Bernardo O'Higgins · Metro Parque Bustamante · Providencia · 2D2B · 58 m² · publicado en UF 3.090";

export default function OfertaDemo({ searchParams }: { searchParams: { pantalla?: string; monto?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const monto = Number(searchParams.monto);
  if (searchParams.pantalla === "firmar") {
    const m = monto > 0 ? monto : 2936;
    const conPre = F.conPreaprobacion("Santander", 5000, "20 de marzo");
    const documento = textoOferta({ nombre: "María José Fernández Valdivieso", rut: "12.345.678-5", depto: DEPTO, montoUF: m, publicadoUF: 3090, pagas: `${F.pieYCredito(Math.round(m * 0.2))}, ${conPre.replace(/^Con/, "con")}`, sujetaAVisita: true, vigenciaDias: 5 });
    const resumen = (
      <>
        <dl className="iv2-of-resumen" data-inv2="resumen-oferta">
          <div><dt>{F.ofreces}</dt><dd className="iv2-of-ofreces">UF {m.toLocaleString("es-CL")}</dd></div>
          <div><dt>{F.comoPagas}</dt><dd>{F.pieYCredito(Math.round(m * 0.2))}<span className="iv2-of-pre">{conPre} · <span className="iv2-enlace-azul">{F.ver}</span></span></dd></div>
          <div><dt>{F.vigencia}</dt><dd>{F.vigenciaTexto}</dd></div>
          <div><dt>{F.condicion}</dt><dd>{F.sujeta}</dd></div>
        </dl>
        <div className="iv2-msj-franco"><span className="iv2-msj-franco-de">{F.sujetaT}</span>{F.sujetaTexto}</div>
        <section className="iv2-dp-sec" aria-labelledby="iv2-despues-t">
          <h2 className="iv2-dp-h2" id="iv2-despues-t">{F.despuesT}</h2>
          <ol className="iv2-of-pasos">{F.despues.map((t, i) => <li key={i}><span className="iv2-of-num" aria-hidden="true">{i + 1}</span><span>{t}</span></li>)}</ol>
        </section>
      </>
    );
    return (
      <MarcoInvierte volver={null} pantalla="firmar-oferta" layout="formulario" cabecera="Tu oferta" pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
        <div className="iv2-mi-inversion"><Link href={`/dev/invierte-v2/oferta?monto=${m}`} className="iv2-mi-inversion-a">← {F.volver}</Link></div>
        <div className="inv-encabezado iv2-sumar-cab"><h1 className="iv2-titulo-res" id="iv2-t">{F.titulo}</h1><p className="iv2-depto-s">{DEPTO}</p></div>
        <FirmaOfertaForm avisoId="muestra" montoUF={m} documento={documento} urlVolver="/dev/invierte-v2/depto?etapa=listo&oferta=firmada" resumen={resumen} />
      </MarcoInvierte>
    );
  }
  return (
    <MarcoInvierte volver={null} pantalla="oferta" layout="formulario" cabecera={OFERTA_COPY.cabecera} pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }}>
      <div className="iv2-mi-inversion"><Link href="/dev/invierte-v2/depto?etapa=listo" className="iv2-mi-inversion-a">← Depto de Providencia</Link></div>
      <div className="inv-encabezado iv2-sumar-cab"><h1 className="iv2-titulo-res" id="iv2-t">{OFERTA_COPY.titulo}</h1><p className="iv2-depto-s">{DEPTO}</p></div>
      <OfertaForm avisoId="muestra" urlFirmar="/dev/invierte-v2/oferta?pantalla=firmar" {...R} razones={RAZONES} avisoFuertePct={5} montoInicial={monto > 0 ? monto : null} />
    </MarcoInvierte>
  );
}
