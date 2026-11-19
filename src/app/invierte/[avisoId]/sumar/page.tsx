import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import type { Veredicto } from "@/lib/types";
import { URL_BASE, URL_PARTIMOS, URL_PERFIL, urlContacto } from "@/lib/invierte-v2/destino";
import { fmtUF } from "@/lib/invierte-v2/opciones";
import { SUMAR_COPY, diaMesChile } from "@/lib/invierte-v2/base";
import { vistaSumar } from "@/lib/invierte-v2/base-servidor";
import { METADATA_FLUJO, analysisDe, deptoParaPagina, origenDe, sesionYAcceso, volverAlOrigen } from "@/lib/invierte-v2/paginas";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { SumarDepto } from "@/components/invierte-v2/SumarDepto";

// SÚMALO A TUS OPCIONES (entrega 2, 19-nov-2026; lámina 3.3-sumar-otro-depto). Lo que abre «Invierte con Franco» en el mapa
// cuando la persona ya firmó: se salta el contacto y la firma (su orden cubre todos sus deptos). No hay botón para «solo verlo»:
// eso ya está en la tarjeta del mapa. Sin orden: el contacto; firmó pero sin perfil: Partimos (lo primero es el perfil); ya está
// entre sus deptos: lo dice y lleva a la base; hoy no le alcanza: lo dice, sin botón de sumar. Hasta seis activos: con seis,
// «Sumar a mis opciones» pregunta cuál deja. Sin acceso o un depto que no es del flujo (no usado): 404.
export const dynamic = "force-dynamic";
export const metadata = METADATA_FLUJO;

const S = SUMAR_COPY;

export default async function SumarPage({ params, searchParams }: { params: { avisoId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const { user, acceso } = await sesionYAcceso();
  if (!acceso) notFound();
  const depto = await deptoParaPagina(params.avisoId);
  if (!depto) notFound();
  const origen = origenDe(searchParams);
  const analysisId = analysisDe(searchParams);
  if (!user) redirect(urlContacto(depto.avisoId, origen, analysisId));
  const v = await vistaSumar(createServiceClient(), user.id, depto.avisoId);
  if (v.estado === "sin-orden") redirect(urlContacto(depto.avisoId, origen, analysisId));
  if (v.estado === "sin-perfil") redirect(URL_PARTIMOS);
  if (v.estado === "depto") notFound();
  const activos = (v.activos ?? []).map((a) => ({ avisoId: a.avisoId, datos: a.datos }));
  const topeUF = v.perfil?.topeUF ?? 0;
  return (
    <MarcoInvierte volver={volverAlOrigen(depto.avisoId, origen, analysisId)} pantalla="sumar" layout="formulario" cabecera={S.cabecera} pc={{ sesionEmail: user.email ?? null }}>
      <div className="inv-encabezado iv2-sumar-cab">
        <h1 className="iv2-titulo-res" id="iv2-t">{S.titulo}</h1>
        <p className="iv2-chip-linea" data-inv2="sumar-depto">
          <span>{depto.linea}{depto.precioUF ? ` · UF ${fmtUF(depto.precioUF)}` : ""}</span>
          {depto.veredicto && <ChipVeredicto v={depto.veredicto as Veredicto} puntaje={depto.veredicto === "COMPRAR" ? depto.score ?? null : null} />}
        </p>
      </div>
      {v.estado === "ya" ? (
        <>
          <p className="inv-parrafo" data-inv2="sumar-ya">{S.ya}</p>
          <div className="iv2-acciones"><Link href={URL_BASE} className="inv-principal" data-inv2="ver-mis-deptos">{S.verMisDeptos}</Link></div>
        </>
      ) : (
        <>
          <div className="iv2-gris" data-inv2="sin-firma">
            <p className="iv2-gris-t">{S.sinFirmaT}</p>
            <p className="iv2-gris-s">{S.sinFirma(diaMesChile(v.orden!.firmadoAt))}</p>
          </div>
          <div className="iv2-sumar-lineas">
            {v.alcanza
              ? <p data-inv2="te-alcanza"><b>{S.teAlcanza}</b> {S.conQue(v.perfil?.topeFuente ?? null)}</p>
              : <p data-inv2="no-te-alcanza"><b>{S.noTeAlcanza}:</b> {S.noTeAlcanzaLinea(v.datos?.precioUF ?? depto.precioUF ?? 0, topeUF)}</p>}
            {v.alcanza && <p data-inv2="entra-comparativo"><b>{S.entra}</b> {S.entraLinea(activos.length)}</p>}
          </div>
          <div className="iv2-acciones">
            {v.alcanza
              ? <SumarDepto avisoId={depto.avisoId} etiqueta={S.boton} origen="mapa" activos={activos} variante="principal" />
              : <Link href={URL_PERFIL} className="iv2-secundario" data-inv2="revisar-perfil">{S.revisarPerfil}</Link>}
          </div>
        </>
      )}
    </MarcoInvierte>
  );
}
