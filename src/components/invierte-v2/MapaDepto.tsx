"use client";

// EL MAPA CHICO DEL DEPTO (rediseño del 23-nov-2026, láminas 4.2): la imagen estática con el punto y «Ver mapa», que la abre más grande
// en una ventana. Sin JavaScript de mapas ni lecturas de la publicación (mapa-depto.ts). En celular va en una fila con la ubicación; en PC,
// como columna de la cabeza con su rótulo encima.
import { useState } from "react";
import { DEPTO_COPY as D } from "@/lib/invierte-v2/depto-flujo";
import { VentanaDocumento } from "./VentanaDocumento";

export function MapaDepto({ chico, grande, confirmada, linea }: { chico: string | null; grande: string | null; confirmada: boolean; linea: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const rotulo = confirmada ? D.ubicacionConfirmada : D.ubicacionAprox;
  return (
    <div className="iv2-dp-mapa" data-inv2="mapa-depto" data-confirmada={confirmada ? "si" : "no"}>
      {chico ? (
        <button type="button" className="iv2-dp-mapa-img" onClick={() => setAbierto(true)} aria-label={D.verMapa} style={{ backgroundImage: `url("${chico}")` }} data-inv2="mapa-chico">
          <span className="iv2-dp-mapa-chip">{rotulo}</span>
        </button>
      ) : <span className="iv2-dp-mapa-img iv2-dp-mapa-vacio" aria-hidden="true" />}
      <div className="iv2-dp-mapa-txt">
        <span className="iv2-dp-mapa-t">{rotulo}</span>
        {linea && <span className="iv2-dp-mapa-s">{linea}</span>}
        {chico && <button type="button" className="iv2-enlace-azul iv2-dp-mapa-ver" onClick={() => setAbierto(true)} data-inv2="ver-mapa">{D.verMapa}</button>}
      </div>
      {abierto && grande && (
        <VentanaDocumento nombre="mapa" variante="chica" titulo={rotulo} alCerrar={() => setAbierto(false)} accion="Cerrar">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen de Static Maps, ya del tamaño justo */}
          <img src={grande} alt={rotulo} className="iv2-dp-mapa-grande" width={640} height={440} />
        </VentanaDocumento>
      )}
    </div>
  );
}
