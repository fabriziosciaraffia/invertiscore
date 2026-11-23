"use client";

// «LO QUE VE FRANCO» EN LA PÁGINA DEL DEPTO (segunda vuelta del rediseño, 23-nov-2026, láminas 4.2): la tarjeta azul con las tres líneas
// de la versión corta tal como están guardadas, y «Ver todo lo que ve Franco», que abre la versión completa en una ventana sin salir.
// Solo con la lectura ya guardada (la trae el servidor): sin lectura no se dibuja, y abrir la página nunca pide una lectura nueva —la
// ventana usa la misma lectura (`inicial`), así que LoQueVeFranco no consulta nada—. Es la única tarjeta con fondo azul de la página.
import { useState } from "react";
import { LECTURA_COPY as L, alertaPrimero, type LecturaFranco } from "@/lib/invierte-v2/lectura-franco";
import { VentanaDocumento } from "./VentanaDocumento";
import { LoQueVeFranco } from "./LoQueVeFranco";

export const VER_TODO = "Ver todo lo que ve Franco";

export function LoQueVeFrancoDepto({ avisoId, lectura }: { avisoId: string; lectura: LecturaFranco | null }) {
  const [abierto, setAbierto] = useState(false);
  if (!lectura || !lectura.corta?.length) return null;
  const alerta = alertaPrimero(lectura) ? (lectura.alerta.nivel === "grave" ? "grave" : "revisar") : null;
  return (
    <section className="iv2-dp-vf" aria-labelledby="iv2-vf-t" data-inv2="lo-que-ve-franco">
      <div className="iv2-dp-vf-cab">
        <h2 className="iv2-dp-vf-t" id="iv2-vf-t">{L.rotulo}</h2>
        {alerta && <span className="iv2-lectura-chip" data-inv2="lectura-chip">{L.alertaNivel[alerta]}</span>}
      </div>
      <ul className="iv2-dp-vf-lineas" data-inv2="vf-lineas">{lectura.corta.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <button type="button" className="iv2-enlace-azul iv2-dp-vf-ver" onClick={() => setAbierto(true)} data-inv2="ver-todo-franco">{VER_TODO}</button>
      {abierto && (
        <VentanaDocumento nombre="lo-que-ve-franco" variante="lista" titulo={L.rotulo} alCerrar={() => setAbierto(false)} accion="Cerrar">
          <LoQueVeFranco avisoId={avisoId} variante="detalles" inicial={lectura} />
        </VentanaDocumento>
      )}
    </section>
  );
}
