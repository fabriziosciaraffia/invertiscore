"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LA HOJA DEL DEPTO COMPARTIDO (04-nov-2026, la pasada de Fabrizio): el enlace compartido abre EL DEPTO como protagonista. Sobre el
// mapa centrado en el pin, una hoja como la de bienvenida, «Te compartieron este depto», con la tarjeta grande del depto —la foto
// de la calle o el mapa chico, la línea, el precio, el chip con su puntaje y, si es negociado, los dos veredictos; el flujo, borroso
// sin cuenta—, el botón de analizar (con cuenta) o de registrarse (sin cuenta), o «Ya lo analizaste · Ver informe», y «Ver el mapa»
// para cerrarla. Sin la bienvenida encima y sin la tarjeta del carrusel. Si el depto ya no está, la misma hoja lo dice y ofrece los
// parecidos (compartido-caido.tsx). Hasta el 04-nov el enlace abría la tarjeta chica del pin, o una tarjeta de «ya no está».
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { botonOcupado } from "@/lib/carga-global";
import { GUIA } from "@/lib/guia/copy";
import { lineaDepto } from "@/lib/guia/linea-depto";
import { flujoTexto } from "@/lib/explorar/explorar";
import { PORTAL_COPY, type PinMapa } from "@/lib/explorar/portal";
import { ABIERTO_COPY, BORROSO } from "@/lib/explorar/abierto";
import { COMPARTIR_COPY, type DeptoCompartido, type EstadoCaido } from "@/lib/explorar/compartir";
import { conCifrasNegociado, esNegociado, NEGOCIAR_COPY } from "@/lib/explorar/capa-negociar";
import { YA_ANALIZADO } from "@/lib/guia/semanal-str";
import { Borroso, ImagenDepto, useCalle, VeredictoDelPin, VeredictosNegociado } from "./tarjeta-pin";
import { CompartidoCaido } from "./compartido-caido";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export type CasoCompartido =
  | { tipo: "pin"; pin: PinMapa }
  | { tipo: "caido"; estado: EstadoCaido; depto: DeptoCompartido | null; parecidos: PinMapa[] };

export function HojaCompartida({ caso, tope = null, sinCuenta, informe = null, generando = null, alAnalizar, alVerInforme, alAbrirParecido, alCerrar }: {
  caso: CasoCompartido;
  /** El tope del enlace de un negociado (el título de «ya no llega»). */
  tope?: number | null;
  sinCuenta: boolean;
  /** El informe del depto si la cuenta ya lo analizó: en vez de «Analizar este», «Ya lo analizaste · Ver informe». */
  informe?: string | null;
  generando?: string | null;
  /** Con cuenta, el pop-up de «Analizar este»; sin cuenta, la hoja de registro (lo decide quien la monta, como la tarjeta). */
  alAnalizar: (p: PinMapa) => void;
  alVerInforme?: (avisoId: string, informeId: string) => void;
  alAbrirParecido: (avisoId: string) => void;
  alCerrar: () => void;
}) {
  const boton = useRef<HTMLButtonElement>(null);
  const tipos = useCalle(caso.tipo === "pin" ? [caso.pin.avisoId] : []);
  // Escape la cierra, en captura como la bienvenida (un render a mitad del evento no lo saca).
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useEffect(() => {
    boton.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopImmediatePropagation(); cerrarRef.current(); };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, []);
  const c = COMPARTIR_COPY.hoja;
  const p = caso.tipo === "pin" ? caso.pin : null;
  return (
    <div className="ex-bienvenida-velo ex-comp-velo" data-explorar="compartido-hoja" data-caso={caso.tipo}>
      <section className="ex-bienvenida ex-comp" role="dialog" aria-modal="true" aria-labelledby="ex-comp-t">
        <h2 id="ex-comp-t" className="ex-comp-t" data-explorar="compartido-titulo">{c.titulo}</h2>
        {p ? (
          <article className="ex-comp-tarjeta" data-explorar="compartido-tarjeta" data-aviso={p.avisoId}>
            {/* La imagen al costado, más grande que en la tarjeta del pin (la foto de la calle viene de 200 × 200: a todo el ancho se
                vería borrosa). */}
            <ImagenDepto avisoId={p.avisoId} tipo={tipos[p.avisoId]} clase="ex-img ex-comp-img" ajustar={esNegociado(p)} />
            <div className="ex-comp-datos">
            <span className="ex-ojo" data-explorar="linea">{lineaDepto(p)}</span>
            <b className="ex-precio ex-comp-precio" data-explorar="precio">UF {miles(p.precioUF)}{esNegociado(p) && <span className="ex-publicado"> {NEGOCIAR_COPY.publicado}</span>}</b>
            {esNegociado(p) ? (
              <VeredictosNegociado p={p} />
            ) : (
              <>
                <span className="ex-linea2" data-explorar="veredicto"><VeredictoDelPin p={p} /></span>
                {sinCuenta ? (
                  <span className="ex-linea2" data-explorar="flujo-oculto">{ABIERTO_COPY.flujo} <Borroso texto={BORROSO.flujo} /> {ABIERTO_COPY.alMes}</span>
                ) : p.flujo != null && (
                  <span className="ex-linea2" data-explorar="flujo"><b className={p.flujo < 0 ? "ex-neg" : undefined}>{flujoTexto(p.flujo)}</b> {PORTAL_COPY.alMes}</span>
                )}
              </>
            )}
            </div>
          </article>
        ) : caso.tipo === "caido" && (
          <CompartidoCaido estado={caso.estado} tope={tope} depto={caso.depto} parecidos={caso.parecidos} sinCuenta={sinCuenta} alAbrir={alAbrirParecido} />
        )}
        <div className="ex-comp-acciones">
          {p && (sinCuenta ? (
            <button ref={boton} type="button" className="ex-cta ex-cta-triada" onClick={() => alAnalizar(p)} data-explorar="compartido-registrate">{ABIERTO_COPY.cta}</button>
          ) : informe ? (
            <EnlaceCarga href={`/analisis/${informe}`} className="ex-cta ex-cta-enlace" data-explorar="compartido-ver-informe" onClick={() => alVerInforme?.(p.avisoId, informe)}>{YA_ANALIZADO.texto} · {YA_ANALIZADO.enlace}</EnlaceCarga>
          ) : (
            <button ref={boton} type="button" className="ex-cta" onClick={() => alAnalizar(p)} disabled={!!generando} {...botonOcupado(generando === p.avisoId)} data-explorar="compartido-analizar">
              {generando === p.avisoId ? GUIA.analizando : esNegociado(p) && conCifrasNegociado(p) ? NEGOCIAR_COPY.analizarA(p.neg.p) : PORTAL_COPY.analizar}
            </button>
          ))}
          <button ref={p ? undefined : boton} type="button" className="ex-enlace ex-comp-mapa" onClick={alCerrar} data-explorar="compartido-ver-mapa">{c.verMapa}</button>
        </div>
      </section>
    </div>
  );
}
