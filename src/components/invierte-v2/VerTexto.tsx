"use client";

// «Ver» un documento de texto en su ventana, sin salir (etapa 3, B3): la oferta firmada en «Documentos de este depto».
import { useState } from "react";
import { VentanaDocumento } from "./VentanaDocumento";

export function VerTexto({ titulo, parrafos, etiqueta = "Ver" }: { titulo: string; parrafos: string[]; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" className="iv2-enlace-azul" onClick={() => setAbierto(true)} data-inv2="ver-documento">{etiqueta}</button>
      {abierto && (
        <VentanaDocumento nombre="documento-depto" titulo={titulo} alCerrar={() => setAbierto(false)} accion="Cerrar">
          <div className="iv2-of-texto">{parrafos.map((t, i) => <p key={i} className={/^BORRADOR/.test(t) ? "iv2-of-borrador" : undefined}>{t}</p>)}</div>
        </VentanaDocumento>
      )}
    </>
  );
}
