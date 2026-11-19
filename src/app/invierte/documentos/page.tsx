import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { URL_BASE, URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { DOCUMENTOS_COPY, diaMesChile } from "@/lib/invierte-v2/base";
import { fechaFirmaLarga, partesDeTexto, registroDeFirma } from "@/lib/invierte-v2/orden";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { ESTADOS_COPY, PREAPROB_COPY, URL_PREAPROBACION, lineaAprobada } from "@/lib/invierte-v2/preaprobacion";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VerOrden } from "@/components/invierte-v2/VerOrden";
import { VerPreaprobacion } from "@/components/invierte-v2/Preaprobacion";

// TUS DOCUMENTOS (entrega 2, 19-nov-2026; lámina 3.3-documentos). La orden firmada se «Ver» en la ventana de documentos, sobre la
// página (la misma de Partimos); «Los detalles de tus deptos» lleva a la base, donde cada uno tiene «Abrir». La preaprobación
// (entrega 3) muestra su estado: por subir («Subir», en rojo como la lámina), en revisión, aprobada o por corregir. La oferta, la
// promesa y la escritura dicen «Más adelante». Sin acceso: 404; sin orden: /invierte decide.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

const D = DOCUMENTOS_COPY;

function Fila({ titulo, linea, children, apagada = false, nombre }: { titulo: string; linea: string; children: React.ReactNode; apagada?: boolean; nombre: string }) {
  return (
    <li className="iv2-doc-fila" data-inv2={`doc-${nombre}`}>
      <div className="iv2-depto-id">
        <span className={apagada ? "iv2-doc-fila-t iv2-apagado" : "iv2-doc-fila-t"}>{titulo}</span>
        <span className="iv2-depto-s">{linea}</span>
      </div>
      {children}
    </li>
  );
}

export default async function DocumentosPage() {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const admin = createServiceClient();
  const [orden, pre] = await Promise.all([ultimaOrdenDe(admin, user.id), leerPreaprobacion(admin, user.id)]);
  if (!orden) redirect(URL_INVIERTE);
  const d = pre.doc;
  const lineaPre = pre.estado === "aprobada" && d ? lineaAprobada({ banco: d.banco, montoUF: d.montoAprobadoUF, vigenteHasta: d.vigenteHasta })
    : pre.estado === "en_revision" ? ESTADOS_COPY.en_revision.titulo
    : pre.estado === "por_corregir" ? d?.motivo ?? ESTADOS_COPY.por_corregir.titulo
    : pre.estado === "sin_credito" ? ESTADOS_COPY.sin_credito.titulo
    : D.preaprobacionLinea;
  const texto = partesDeTexto(orden.texto);
  return (
    <MarcoInvierte volver={URL_BASE} pantalla="documentos" layout="formulario" cabecera={D.cabecera} pc={{ sesionEmail: user.email ?? null }}>
      <h1 className="iv2-titulo-res iv2-solo-pc-titulo" id="iv2-t">{D.cabecera}</h1>
      <ul className="iv2-doc-filas">
        <Fila nombre="orden" titulo={D.orden} linea={D.ordenLinea(diaMesChile(orden.firmadoAt))}>
          <VerOrden clase="iv2-enlace-azul iv2-doc-accion" etiqueta={D.ver} estado={FLUJO_COPY.partimos.estado} firmada={fechaFirmaLarga(orden.firmadoAt)}
            version={orden.textoVersion} parrafos={texto.parrafos} registro={registroDeFirma(orden)} />
        </Fila>
        <Fila nombre="preaprobacion" titulo={D.preaprobacion} linea={lineaPre}>
          {(pre.estado === "en_revision" || pre.estado === "aprobada") && d?.path
            ? <VerPreaprobacion etiqueta={D.ver} estado={pre.estado === "aprobada" ? "Aprobada" : null} titulo={PREAPROB_COPY.cabecera} meta={lineaPre} mime={d.mime} />
            : pre.estado === "sin_credito" ? <span className="iv2-depto-s iv2-nowrap">{ESTADOS_COPY.sin_credito.chip}</span>
            : <Link href={pre.estado === "por_corregir" ? `${URL_PREAPROBACION}?subir=1` : URL_PREAPROBACION} className="iv2-enlace-azul iv2-doc-accion iv2-accion-roja" data-inv2="doc-subir">{pre.estado === "por_corregir" ? ESTADOS_COPY.por_corregir.boton : D.subir}</Link>}
        </Fila>
        <Fila nombre="detalles" titulo={D.detalles} linea={D.detallesLinea}>
          <Link href={URL_BASE} className="iv2-enlace-azul iv2-doc-accion" data-inv2="doc-ver-detalles">{D.ver}</Link>
        </Fila>
        <Fila nombre="oferta" titulo={D.oferta} linea={D.ofertaLinea} apagada>
          <span className="iv2-depto-s iv2-nowrap">{D.masAdelante}</span>
        </Fila>
        <Fila nombre="promesa" titulo={D.promesa} linea={D.promesaLinea} apagada>
          <span className="iv2-depto-s iv2-nowrap">{D.masAdelante}</span>
        </Fila>
      </ul>
    </MarcoInvierte>
  );
}
