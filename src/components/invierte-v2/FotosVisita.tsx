"use client";

// LAS FOTOS DEL REPORTE DE LA VISITA (24-nov-2026; lámina 4.4 del 24-nov): la línea «N fotos de la visita · toca una para verla en
// grande» y una tira con las miniaturas (la copia liviana de cada foto, completa, sin recortar ni filtrar). Tocar una abre el visor que ya
// existe, con la foto original.
import { useState } from "react";
import { VisorFotos } from "./VisorFotos";
import { VISITA_COPY as VC, urlFotoVisita } from "@/lib/invierte-v2/visita";

const VISIBLES = 4;

/** `muestra`: solo en /dev, las direcciones de unas fotos de ejemplo en vez de las de la visita. */
export function FotosVisita({ visitaId, n, muestra = null }: { visitaId: string; n: number; muestra?: string[] | null }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  if (!n) return null;
  const vis = Math.min(n, VISIBLES);
  const url = (i: number, mini = false) => (muestra ? muestra[i % muestra.length] : urlFotoVisita(visitaId, i, mini));
  return (
    <section className="iv2-rv-fotos" data-inv2="rv-fotos" aria-label={VC.fotosVisita(n)}>
      <p className="iv2-rv-fotos-l">{VC.fotosVisita(n)}</p>
      <ul className="iv2-rv-tira">
        {Array.from({ length: vis }, (_, i) => (
          <li key={i}>
            <button type="button" className="iv2-rv-mini" onClick={() => setAbierta(i)} aria-label={`Ver la foto ${i + 1} de ${n}`} data-inv2="rv-mini">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url(i, true)} alt="" loading="lazy" />
              {i === vis - 1 && n > vis && <span className="iv2-rv-mas" aria-hidden="true">+{n - vis}</span>}
            </button>
          </li>
        ))}
      </ul>
      {abierta != null && (
        <VisorFotos avisoId={visitaId} n={n} inicio={abierta} titulo={VC.reporteT} alCerrar={() => setAbierta(null)}
          src={(k) => url(k)} mini={(k) => url(k, true)} />
      )}
    </section>
  );
}
