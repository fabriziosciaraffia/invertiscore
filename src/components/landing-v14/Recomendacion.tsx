"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Sección 3 — "Lo que haría Franco": «La recomendación de Franco» para el MISMO
// ejemplo que la sección 2, rotando en sincronía.
//
// ES LA CARD DEL INFORME, NO UNA COPIA (27-sep-2026, decisión de Fabrizio). Hasta
// el 11-sep la landing la reescribía con clases `lr-`, y quedó vieja dos veces: la
// card de master se simplificó el 24-sep («Resultado», «Alternativamente» y la línea
// de comunas se fueron al pop-up o dejaron de existir) y la copia siguió mostrándolos.
// Ahora se dibuja con las mismas piezas que `HeroLTR`: `PosicionFranco` con
// `LoQueHariaYoBloque` (Comprar y Ajustar) o `CardBuscarOtra` (Buscar otro), sobre la
// card que arma `construirCardLtr` en el servidor, y con su CSS, que es el del informe
// (`DocTokens`, dentro de `.doc-dictamen`). No va la alternativa de comunas: en renta
// larga solo la lleva un Ajustar sin salida, y desde el filtro del descuento (25-sep)
// ese caso pasa a Buscar otro, cuya card no la trae.
//
// EL POP-UP DE COMBINACIONES, DOS VARIANTES PARA ELEGIR (27-sep-2026, `?combinaciones=`):
//   · A (por omisión) — la MATRIZ REAL al lado de la card en escritorio y debajo en el
//     teléfono, con la celda de Franco marcada y sin interacción (`PopupAjustes estatico`).
//   · B — el botón de la card abre el POP-UP REAL, como en el informe. Abrirlo pausa la
//     rotación: si el ejemplo cambiara debajo, el pop-up quedaría en una card oculta.
// Los datos del pop-up son los que le pasa `HeroLTR` (landing-vivo.ts, `popup`). Buscar otro
// no tiene pop-up (`hayAjustesQueMostrar`), como en el informe.
//
// SIN SALTOS AL ROTAR: las tres cards —y las tres matrices— viven en la misma celda y se ve
// una; la celda mide lo que la más alta.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import type { EjemploLanding, PopupLanding } from "@/lib/landing-vivo";
import type { Veredicto } from "@/lib/types";
import { PUERTA_COMBINACIONES } from "@/lib/card-recomendacion";
import { PosicionFranco, type FooterPosicion } from "@/components/analysis/shared/PosicionFranco";
import { LoQueHariaYoBloque, CardBuscarOtra } from "@/components/analysis/shared/LoQueHariaYoBloque";
import { PopupAjustes } from "@/components/analysis/shared/PopupAjustes";
import { PopupAjustesTokens } from "@/components/analysis/shared/PopupAjustesTokens";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { Glifo } from "./Marca";
import { BarraProgreso, useRotacion } from "./Rotacion";

type VarianteCombinaciones = "a" | "b";

/** La variante del pop-up: `?combinaciones=b`; por omisión, A. Se lee al montar. */
function useVariante(): VarianteCombinaciones {
  const [v, setV] = useState<VarianteCombinaciones>("a");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("combinaciones") === "b") setV("b");
  }, []);
  return v;
}

/** El pop-up de combinaciones con los datos del ejemplo, como `cuerpoAjustes` en HeroLTR. */
function Combinaciones({ popup, veredicto, valorUF, estatico }: { popup: PopupLanding; veredicto: Veredicto; valorUF: number; estatico?: boolean }) {
  return (
    <PopupAjustes
      veredicto={veredicto}
      modalidad="LTR"
      distancia={popup.distancia}
      mixComprar={popup.mixComprar}
      currency="CLP"
      valorUF={valorUF}
      precioUF={popup.precioUF}
      referenciaArriendo={popup.referenciaArriendo}
      antes={popup.antes}
      estatico={estatico}
    />
  );
}

/** La card de un ejemplo, tal como la dibuja el informe. Con `conBoton`, el botón abre el pop-up. */
function Card({ ejemplo, conBoton = false }: { ejemplo: EjemploLanding; conBoton?: boolean }) {
  const { card, veredicto, estado, popup } = ejemplo;
  const bloque = card.buscar ? (
    <CardBuscarOtra causa={card.buscar.causa} distancia={card.buscar.distancia} />
  ) : card.bloque ? (
    <LoQueHariaYoBloque bloque={card.bloque} veredicto={veredicto} />
  ) : undefined;
  // La puerta, como en HeroLTR: Ajustar abre las combinaciones; Comprar, cómo queda con otro pie o
  // plazo; Buscar otro no tiene.
  const puerta = veredicto === "COMPRAR" ? PUERTA_COMBINACIONES.comprar : PUERTA_COMBINACIONES.ajustar;
  const footer: FooterPosicion | null =
    conBoton && popup
      ? {
          key: veredicto === "COMPRAR" ? "sensibilidad" : "distanciaVeredicto",
          k: puerta.k,
          l: "",
          btn: puerta.btn,
          cuerpo: <Combinaciones popup={popup} veredicto={veredicto} valorUF={ejemplo.valorUF} />,
        }
      : null;
  return (
    <PosicionFranco
      bloque={bloque}
      footer={footer}
      titulo="La recomendación de Franco"
      estado={estado}
      tipo="ltr"
      veredicto={veredicto}
      className=""
    />
  );
}

/** La card para /metodologia: un ejemplo quieto, con el CSS del informe montado. */
export function CardRecomendacion({ ejemplo }: { ejemplo: EjemploLanding }) {
  return (
    <div className="doc-dictamen lv-reco-doc">
      <DocTokens />
      <Card ejemplo={ejemplo} />
    </div>
  );
}

type Delay = (k: number) => CSSProperties;

/** Un ejemplo de la pila de cards: quién es (comuna, tipología y veredicto) y su card. */
function ItemReco({ x, activo, out, delay, conBoton }: { x: EjemploLanding; activo: boolean; out: boolean; delay: Delay; conBoton: boolean }) {
  const fx = `lv-x${out || !activo ? " out" : ""}`;
  return (
    <div className={`lv-pila-item${activo ? " on" : ""}`} data-verdict={x.veredicto} aria-hidden={!activo}>
      <div className={`lv-reco-quien ${fx}`} style={activo ? delay(0) : undefined}>
        <span>
          <b>{x.comuna}</b>
          {x.detalle && <> · {x.detalle}</>}
        </span>
        <span className="lv-reco-quien-v">
          <Glifo veredicto={x.veredicto} />
          {x.etiqueta}
        </span>
      </div>
      <div className={fx} style={activo ? delay(1) : undefined}>
        <Card ejemplo={x} conBoton={conBoton} />
      </div>
    </div>
  );
}

/** Variante A · la matriz del ejemplo, sola y quieta. Buscar otro no tiene: se dice. */
function ItemMatriz({ x, activo, out, delay }: { x: EjemploLanding; activo: boolean; out: boolean; delay: Delay }) {
  const fx = `lv-x${out || !activo ? " out" : ""}`;
  return (
    <div className={`lv-pila-item${activo ? " on" : ""}`} aria-hidden={!activo}>
      <div className={`doc-tokens lv-matriz ${fx}`} style={activo ? delay(2) : undefined}>
        {x.popup ? (
          <Combinaciones popup={x.popup} veredicto={x.veredicto} valorUF={x.valorUF} estatico />
        ) : (
          <p className="lv-matriz-nada">Buscar otro no abre combinaciones: la card dice por qué no conviene y a qué distancia queda Comprar.</p>
        )}
      </div>
    </div>
  );
}

/** La sección 3 de la landing: la card del ejemplo en pantalla, con la misma rotación que la
 *  sección 2 y el control de pausa, y las combinaciones en la variante elegida. */
export function LoQueHariaFranco() {
  const { ejemplos, i, out, delay, rota, pausado, pausar, seguir } = useRotacion();
  const variante = useVariante();
  if (!ejemplos[i]) return null;
  // B · abrir el pop-up pausa la rotación (el pop-up vive dentro de la card del ejemplo)
  const alAbrir = (e: MouseEvent<HTMLDivElement>) => {
    if (variante === "b" && (e.target as Element).closest(".rec-cta") && !pausado) pausar();
  };
  return (
    <div className="lv-sreco-grid-inner" data-combinaciones={variante}>
      <div className="lv-idx">Lo que haría Franco</div>
      <div className="lv-reco doc-dictamen lv-reco-doc" onClickCapture={alAbrir}>
        <DocTokens />
        <PopupAjustesTokens />
        {variante === "b" && <TokensHallazgos />}
        <div className="lv-pila lv-cards">
          {ejemplos.map((x, j) => (
            <ItemReco key={x.id} x={x} activo={j === i} out={out} delay={delay} conBoton={variante === "b"} />
          ))}
        </div>
        {variante === "a" && (
          <div className="lv-pila lv-matrices">
            {ejemplos.map((x, j) => (
              <ItemMatriz key={x.id} x={x} activo={j === i} out={out} delay={delay} />
            ))}
          </div>
        )}
        <div className="lv-reco-pie">
          <BarraProgreso />
          {/* Rotación PAUSABLE desde acá: la card es larga y se lee. Con
              reduced-motion no hay rotación, así que no hay botón. */}
          {rota && (
            <button type="button" className="lv-pausa" aria-pressed={pausado} onClick={pausado ? seguir : pausar}>
              <i aria-hidden="true">{pausado ? "▶" : "❚❚"}</i>
              {pausado ? "Seguir" : "Pausar"}
            </button>
          )}
        </div>
      </div>
      <div className="lv-reco-texto">
        <h2 className="lv-reco-h2">
          Cada informe termina con <mark>una recomendación</mark>, no con un puntaje.
        </h2>
        <p>
          Franco prueba cada cambio por separado —precio, arriendo, pie, plazo— y después combina los que dependen de ti.
          Si el veredicto ya es Comprar, te dice cuánto aguanta antes de dejar de serlo.
        </p>
        <p>Y si nada alcanza, te lo dice con el número real de lo que haría falta, y por qué.</p>
      </div>
    </div>
  );
}
