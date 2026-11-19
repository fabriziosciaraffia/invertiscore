import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { URL_BASE, URL_INVIERTE } from "@/lib/invierte-v2/destino";
import { ESTADOS_COPY, PREAPROB_COPY, URL_PREAPROBACION, lineaAprobada } from "@/lib/invierte-v2/preaprobacion";
import { leerPreaprobacion } from "@/lib/invierte-v2/preaprobacion-servidor";
import { ultimaOrdenDe } from "@/lib/invierte-v2/servidor";
import { diaMesChile } from "@/lib/invierte-v2/base";
import { METADATA_FLUJO, sesionYAcceso } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { SubirPreaprobacion, VerPreaprobacion } from "@/components/invierte-v2/Preaprobacion";

// TU PREAPROBACIÓN (entrega 3, 19-nov-2026; láminas 3.4-preaprobacion y 3.4-preaprobacion-estados). Sin nada vigente (o con
// ?subir=1, desde «Subir otra»), la pantalla de subir: por qué se pide, la caja del archivo, «Subir mi preaprobación», «Todavía no
// la tengo» y «Compro sin crédito». Con algo vigente, la tarjeta de su estado (la persona ve uno solo) y «Volver a mis deptos».
// Sin acceso: 404; sin orden firmada: /invierte decide.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

const P = PREAPROB_COPY;
const E = ESTADOS_COPY;

export default async function PreaprobacionPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { user, acceso } = await sesionYAcceso();
  if (!user || !acceso) notFound();
  const admin = createServiceClient();
  const [orden, pre] = await Promise.all([ultimaOrdenDe(admin, user.id), leerPreaprobacion(admin, user.id)]);
  if (!orden) redirect(URL_INVIERTE);
  const subir = pre.estado === "subir" || searchParams.subir === "1";
  const d = pre.doc;
  return (
    <MarcoInvierte volver={URL_BASE} pantalla="preaprobacion" layout="formulario" cabecera={P.cabecera} pc={{ sesionEmail: user.email ?? null, invierte: true }} miInversion>
      {subir ? (
        <>
          <div className="inv-encabezado iv2-sumar-cab">
            <h1 className="iv2-titulo-res" id="iv2-t">{P.titulo}</h1>
            <p className="iv2-linea-chica">{P.linea}</p>
          </div>
          <div className="iv2-por-que" data-inv2="por-que-preaprobacion">
            <p className="iv2-gris-t">{P.porQueT}</p>
            <p className="iv2-gris-s">{P.porQue}</p>
          </div>
          <SubirPreaprobacion />
        </>
      ) : (
        <>
          <h1 className="iv2-sr" id="iv2-t">{P.cabecera}</h1>
          <div className="iv2-tarjeta-estado" data-inv2={`estado-${pre.estado}`}>
            {pre.estado === "en_revision" && <>
              <span className="iv2-estado-gris">{E.en_revision.chip}</span>
              <p className="iv2-estado-t">{E.en_revision.titulo}</p>
              <p className="iv2-linea-chica">{E.en_revision.texto}</p>
              <VerPreaprobacion etiqueta={E.en_revision.ver} estado={null} titulo={P.cabecera} meta={`Subida el ${diaMesChile(d!.createdAt)}`} mime={d!.mime} />
            </>}
            {pre.estado === "aprobada" && <>
              <span className="iv2-estado">{E.aprobada.chip}</span>
              <p className="iv2-estado-t">{E.aprobada.titulo}</p>
              <p className="iv2-linea-chica" data-inv2="linea-aprobada">{lineaAprobada({ banco: d!.banco, montoUF: d!.montoAprobadoUF, vigenteHasta: d!.vigenteHasta })}</p>
              <VerPreaprobacion etiqueta={E.aprobada.ver} estado="Aprobada" titulo={P.cabecera} meta={lineaAprobada({ banco: d!.banco, montoUF: d!.montoAprobadoUF, vigenteHasta: d!.vigenteHasta })} mime={d!.mime} />
              {pre.otra && (
                <div className="iv2-otra-subida" data-inv2="otra-subida">
                  <p className="iv2-gris-t">{pre.otra.estado === "por_corregir" ? E.otraRechazada : E.otraEnRevision}</p>
                  {pre.otra.estado === "por_corregir" && pre.otra.motivo && <p className="iv2-gris-s" data-inv2="otra-motivo">{pre.otra.motivo}</p>}
                </div>
              )}
            </>}
            {pre.estado === "por_corregir" && <>
              <span className="iv2-estado-ciruela iv2-chip-arriba">{E.por_corregir.chip}</span>
              <p className="iv2-estado-t">{E.por_corregir.titulo}</p>
              {d!.motivo && <p className="iv2-linea-chica" data-inv2="motivo">{d!.motivo}</p>}
              <Link href={`${URL_PREAPROBACION}?subir=1`} className="iv2-secundario" data-inv2="subir-otra">{E.por_corregir.boton}</Link>
            </>}
            {pre.estado === "sin_credito" && <>
              <span className="iv2-estado">{E.sin_credito.chip}</span>
              <p className="iv2-estado-t">{E.sin_credito.titulo}</p>
              <p className="iv2-linea-chica">{E.sin_credito.texto}</p>
              <Link href={`${URL_PREAPROBACION}?subir=1`} className="iv2-enlace-azul iv2-doc-accion" data-inv2="subir-igual">{P.subir}</Link>
            </>}
            {pre.estado === "explicando" && <>
              <span className="iv2-estado-gris">{E.explicando.chip}</span>
              <p className="iv2-estado-t">{E.explicando.titulo}</p>
              <p className="iv2-linea-chica">{E.explicando.texto}</p>
              <Link href={`${URL_PREAPROBACION}?subir=1`} className="iv2-enlace-azul iv2-doc-accion" data-inv2="subir-igual">{P.subir}</Link>
            </>}
          </div>
          <div className="iv2-acciones"><Link href={URL_BASE} className="inv-principal" data-inv2="volver-deptos">{P.volver}</Link></div>
        </>
      )}
    </MarcoInvierte>
  );
}
