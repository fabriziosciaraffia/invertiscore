"use client";

// «Ver mi orden firmada» en Partimos (18-nov-2026, láminas 2.2-ver-mi-orden y 2.2-ver-mi-orden-pc): un botón secundario que
// abre la orden en la ventana de documentos, sobre la misma página. El texto es el GUARDADO en la orden (lo que se firmó), no
// la plantilla vigente; «Descargar PDF» baja el PDF guardado. Al abrirla se anota la vista (bitácora + inv2_orden_vista).
import { useState } from "react";
import type { ParrafoOrden } from "@/lib/invierte-v2/orden";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { URL_DESCARGAR_ORDEN, URL_VER_ORDEN } from "@/lib/invierte-v2/destino";
import { TextoDocumento, VentanaDocumento } from "./VentanaDocumento";

const D = FLUJO_COPY.documento;

export function VerOrden({ etiqueta, estado, firmada, quien, titulo, parrafos }: {
  etiqueta: string;
  estado: string;
  /** «18 de noviembre de 2026, 08:04». */
  firmada: string;
  /** «Camila Rojas Pérez · RUT 16.482.317-5 · Versión 1». */
  quien: string;
  titulo: string;
  parrafos: ParrafoOrden[];
}) {
  const [abierta, setAbierta] = useState(false);
  function abrir() {
    setAbierta(true);
    void fetch(URL_VER_ORDEN, { method: "POST", cache: "no-store" }).catch(() => undefined);
  }
  return (
    <>
      <button type="button" className="iv2-secundario" onClick={abrir} aria-haspopup="dialog" data-inv2="ver-orden">{etiqueta}</button>
      {abierta && (
        <VentanaDocumento
          nombre="orden"
          estado={estado}
          titulo={D.tituloOrden}
          meta={<><span><b>{D.firmada}</b> el {firmada}</span><span>{quien}</span></>}
          descargar={{ href: URL_DESCARGAR_ORDEN }}
          alCerrar={() => setAbierta(false)}
        >
          <TextoDocumento titulo={titulo} parrafos={parrafos} />
        </VentanaDocumento>
      )}
    </>
  );
}
