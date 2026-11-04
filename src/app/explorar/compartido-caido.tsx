"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EL DEPTO COMPARTIDO QUE YA NO ESTÁ (02-nov-2026, goal «Compartir un depto desde Explorar»): si al abrir el enlace el aviso
// ya no está publicado —o sigue publicado pero ya no está entre los que convienen—, lo dice, con la línea del depto que se
// compartió, y ofrece hasta tres parecidos que sí dan (compartir.ts › parecidosQueDan: su comuna, sus dormitorios, un precio
// parecido, del más cercano al más lejano). Tocar uno abre su tarjeta de siempre. Sin cuenta, el flujo de los parecidos va
// borroso, como en la lista.
// EL NEGOCIADO QUE YA NO LLEGA (03-nov-2026): el enlace de un depto de la capa «Si negocias» que con los datos de hoy ya no
// llega a Comprar dentro del tope del enlace dice eso, con el tope, y ofrece los mismos parecidos.
// DENTRO DE LA HOJA DEL COMPARTIDO (04-nov-2026, la pasada de Fabrizio; compartido-hoja.tsx): esto es su cuerpo cuando el depto ya
// no está. «Ver el mapa» y el cierre son de la hoja. Hasta el 04-nov era una tarjeta suelta sobre el mapa.
// ─────────────────────────────────────────────────────────────────────────────
import { lineaDepto } from "@/lib/guia/linea-depto";
import { flujoTexto } from "@/lib/explorar/explorar";
import { BORROSO } from "@/lib/explorar/abierto";
import { COMPARTIR_COPY, lineaConPrecio, type DeptoCompartido, type EstadoCaido } from "@/lib/explorar/compartir";
import { TOPE_NEGOCIAR_POR_DEFECTO } from "@/lib/explorar/capa-negociar";
import type { PinMapa } from "@/lib/explorar/portal";
import { Borroso, ImagenDepto, veredictoConPuntaje } from "./tarjeta-pin";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** Lo que dice el título cuando el depto compartido ya no está. */
export const tituloCaido = (estado: EstadoCaido, tope: number | null): string => {
  const c = COMPARTIR_COPY.caido;
  return estado === "despublicado" ? c.despublicado : estado === "no-llega" ? c.noLlega(tope ?? TOPE_NEGOCIAR_POR_DEFECTO) : c.noDa;
};

export function CompartidoCaido({ estado, tope = null, depto, parecidos, sinCuenta, alAbrir }: {
  estado: EstadoCaido;
  /** El tope del enlace de un negociado: lo dice el título de «ya no llega». */
  tope?: number | null;
  depto: DeptoCompartido | null;
  parecidos: PinMapa[];
  sinCuenta: boolean;
  alAbrir: (avisoId: string) => void;
  /** (De la tarjeta suelta de antes del 04-nov-2026; la hoja cierra por su cuenta.) */
  alCerrar?: () => void;
}) {
  const c = COMPARTIR_COPY.caido;
  const titulo = tituloCaido(estado, tope);
  return (
    <div className="ex-caido" data-explorar="compartido-caido" data-estado={estado}>
      <b className="ex-caido-t" data-explorar="caido-titulo">{titulo}</b>
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
    </div>
  );
}
