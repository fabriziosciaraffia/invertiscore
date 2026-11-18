"use client";

// «Ver mi orden firmada» en Partimos (18-nov-2026, láminas 2.2-ver-mi-orden y 2.2-ver-mi-orden-pc): un botón secundario que
// abre la orden en la ventana de documentos, sobre la misma página. Se ve como el documento: el texto GUARDADO en la orden (lo
// que se firmó, sin el título repetido) y al final el registro de la firma, el mismo del PDF; bajo la fecha, «Versión N · es el
// mismo documento que descargas en PDF». «Descargar PDF» baja el PDF guardado. Al abrirla se anota la vista.
import { useState } from "react";
import type { ParrafoOrden, RegistroFirma } from "@/lib/invierte-v2/orden";
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { URL_DESCARGAR_ORDEN, URL_VER_ORDEN } from "@/lib/invierte-v2/destino";
import { RegistroDocumento, TextoDocumento, VentanaDocumento } from "./VentanaDocumento";

const D = FLUJO_COPY.documento;

export function VerOrden({ etiqueta, estado, firmada, version, parrafos, registro }: {
  etiqueta: string;
  estado: string;
  /** «18 de noviembre de 2026, 08:04». */
  firmada: string;
  version: number;
  parrafos: ParrafoOrden[];
  registro: RegistroFirma;
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
          meta={<><span><b>{D.firmada}</b> el {firmada}</span><span>{D.mismoDocumento(version)}</span></>}
          descargar={{ href: URL_DESCARGAR_ORDEN }}
          alCerrar={() => setAbierta(false)}
        >
          <TextoDocumento parrafos={parrafos} />
          <RegistroDocumento registro={registro} />
        </VentanaDocumento>
      )}
    </>
  );
}
