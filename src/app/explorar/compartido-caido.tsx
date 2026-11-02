"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL DEPTO COMPARTIDO QUE YA NO ESTÁ (02-nov-2026, goal «Compartir un depto desde Explorar»): si al abrir el enlace el aviso
// ya no está publicado —o sigue publicado pero ya no está entre los que convienen—, en el lugar de la tarjeta del pin va
// esta: lo dice, con la línea del depto que se compartió, y ofrece hasta tres parecidos que sí dan (compartir.ts ›
// parecidosQueDan: su comuna, sus dormitorios, un precio parecido, del más cercano al más lejano). Tocar uno abre su
// tarjeta de siempre; «Ver el mapa» la cierra. Sin cuenta, el flujo de los parecidos va borroso, como en la lista.
// ─────────────────────────────────────────────────────────────────────────────
import { lineaDepto } from "@/lib/guia/linea-depto";
import { flujoTexto } from "@/lib/explorar/explorar";
import { BORROSO } from "@/lib/explorar/abierto";
import { COMPARTIR_COPY, lineaConPrecio, type DeptoCompartido, type EstadoCompartido } from "@/lib/explorar/compartir";
import type { PinMapa } from "@/lib/explorar/portal";
import { Borroso, ImagenDepto, veredictoConPuntaje } from "./tarjeta-pin";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export function CompartidoCaido({ estado, depto, parecidos, sinCuenta, alAbrir, alCerrar }: {
  estado: Exclude<EstadoCompartido, "comprar">;
  depto: DeptoCompartido | null;
  parecidos: PinMapa[];
  sinCuenta: boolean;
  alAbrir: (avisoId: string) => void;
  alCerrar: () => void;
}) {
  const c = COMPARTIR_COPY.caido;
  return (
    <section className="ex-tarjeta-wrap" aria-label={estado === "despublicado" ? c.despublicado : c.noDa} data-explorar="compartido-caido" data-estado={estado}>
      <div className="ex-tarjeta-caja ex-caido">
        <div className="ex-caido-cab">
          <b className="ex-caido-t" data-explorar="caido-titulo">{estado === "despublicado" ? c.despublicado : c.noDa}</b>
          <button type="button" className="ex-x ex-caido-x" aria-label={c.cerrar} onClick={alCerrar} data-explorar="caido-cerrar">×</button>
        </div>
        {depto && <span className="ex-ojo ex-caido-linea" data-explorar="caido-linea">{lineaConPrecio(depto)}</span>}
        {parecidos.length > 0 ? (
          <>
            <span className="ex-caido-sub">{c.parecidos}</span>
            <ul className="ex-caido-lista" data-explorar="parecidos">
              {parecidos.map((p) => (
                <li key={p.avisoId}>
                  <button type="button" className="ex-caido-fila" onClick={() => alAbrir(p.avisoId)} data-explorar="parecido" data-aviso={p.avisoId} aria-label={`${lineaDepto(p)} · UF ${miles(p.precioUF)}`}>
                    <ImagenDepto avisoId={p.avisoId} tipo={undefined} clase="ex-mini ex-caido-mini" carga="lazy" />
                    <span className="ex-fila-datos">
                      <span className="ex-ojo">{lineaDepto(p)}</span>
                      <b className="ex-precio-l">UF {miles(p.precioUF)}</b>
                      <span className="ex-linea2">
                        <b className="ex-ver">{veredictoConPuntaje(p)}</b>
                        {sinCuenta ? <> · <Borroso texto={BORROSO.flujo} /></> : p.flujo != null && <> · <b className={p.flujo < 0 ? "ex-neg" : undefined}>{flujoTexto(p.flujo)}</b></>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="ex-caido-sub" data-explorar="sin-parecidos">{c.sinParecidos}</p>
        )}
        <button type="button" className="ex-enlace ex-caido-mapa" onClick={alCerrar} data-explorar="caido-ver-mapa">{c.verMapa}</button>
      </div>
    </section>
  );
}
