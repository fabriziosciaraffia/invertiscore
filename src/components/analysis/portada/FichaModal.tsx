"use client";

// Ficha del depto evaluado — en el Modal del informe (forma A, 24-sep-2026).
// Contrato: mockup `ficha-depto.html`, forma A. Lista agrupada de rótulo y valor, secciones
// cortas, sin prosa, y DE SOLO LECTURA: ningún botón ni link de edición (el «ajústalos» de la
// versión anterior llevaba a una acción que no existe como producto).
//
// POR QUÉ UN PORTAL: la ficha se abre desde la portada, y el overlay de antes, hijo directo de
// `.doc-hero`, caía bajo `.doc-dictamen .doc-hero > *{position:relative}` (PortadaInforme.tsx):
// perdía su `position:fixed` y se abría DENTRO de la caja del hero, con scroll propio. El Modal
// va ahora al `.doc-dictamen` que contiene la portada: fuera del hero (que además aísla su
// contexto de apilamiento) y dentro de los tokens del informe.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/analysis/hallazgos/vocabulario";
import type { FichaDepto } from "@/lib/ficha-depto";

const ES = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

/** El cuerpo de la ficha: grupos de filas rótulo | valor. Exportado para el gate. */
export function FichaCuerpo({ ficha }: { ficha: FichaDepto }) {
  return (
    <div className="doc-tokens fa">
      {ficha.grupos.map((g) => (
        <section key={g.titulo} className="fa-g">
          <h4 className="fa-t">{g.titulo}</h4>
          <div className="fa-c">
            {g.filas.map((f) => (
              <div key={f.k} className="fa-f">
                <span className="fa-k">
                  {f.k}
                  {f.etiqueta && <span className="fa-tag">{f.etiqueta}</span>}
                </span>
                <span className="fa-v">{f.v}</span>
                {(f.sub || f.dif) && (
                  <>
                    <span className="fa-s">{f.sub ?? ""}</span>
                    <span className={`fa-d${f.dif ? ` fa-d-${f.dif.tono}` : ""}`}>{f.dif?.texto ?? ""}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function FichaModal({ ficha, open, onClose }: { ficha: FichaDepto; open: boolean; onClose: () => void }) {
  const ancla = useRef<HTMLSpanElement>(null);
  const [destino, setDestino] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setDestino((ancla.current?.closest(".doc-dictamen") as HTMLElement | null) ?? document.body);
  }, []);

  return (
    <>
      <span ref={ancla} hidden />
      {open && destino
        ? createPortal(
            <Modal
              abierto
              onClose={onClose}
              titulo={ficha.titulo}
              sub={ficha.sub ?? undefined}
              pie={ficha.ufValue > 0 ? `UF ${ES(ficha.ufValue)} del día del análisis` : undefined}
            >
              <FichaCuerpo ficha={ficha} />
            </Modal>,
            destino,
          )
        : null}
    </>
  );
}
