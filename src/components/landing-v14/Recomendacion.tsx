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
// LAS COMBINACIONES SE ABREN AL TOCAR (QA 28-sep-2026, decisión de Fabrizio: variante B; la A y
// su parámetro `?combinaciones=` murieron). El botón de la card —el mismo `.rec-cta` del informe—
// abre un pop-up, pero lo que muestra es la MUESTRA: la matriz con la celda de Franco marcada,
// enmarcada, con su leyenda, sin la cabecera ni el resto del pop-up del informe
// (`PopupAjustes muestra`). Abrirlo pausa la rotación: si el ejemplo cambiara debajo, el pop-up
// quedaría en una card oculta. Los datos son los que le pasa `HeroLTR` (landing-vivo.ts,
// `popup`). Buscar otro no tiene pop-up (`hayAjustesQueMostrar`), como en el informe.
//
// SIN SALTOS NI HUECOS AL ROTAR: las tres cards viven en la misma celda y se ve una; la celda
// mide lo que la más alta y cada card se ESTIRA a esa altura (CSS), con el botón al pie: las tres
// tienen la misma composición y la altura reservada no se lee como un hueco.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, MouseEvent } from "react";
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
import { PieRotacion, useRotacion } from "./Rotacion";

/** LA MUESTRA del pop-up de combinaciones con los datos del ejemplo (los mismos que
 *  `cuerpoAjustes` en HeroLTR): la matriz enmarcada, con la celda de Franco marcada. */
function Muestra({ popup, veredicto, valorUF }: { popup: PopupLanding; veredicto: Veredicto; valorUF: number }) {
  return (
    <div className="lv-muestra">
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
        muestra
      />
      <p className="lv-muestra-nota">
        Una muestra del informe: la celda enmarcada es la recomendación de Franco. En tu informe, tocas cada combinación y ves
        cómo queda.
      </p>
    </div>
  );
}

/** La card de un ejemplo, tal como la dibuja el informe. Con `conBoton`, el botón abre la muestra. */
function Card({ ejemplo, conBoton = false }: { ejemplo: EjemploLanding; conBoton?: boolean }) {
  const { card, veredicto, estado, popup } = ejemplo;
  const bloque = card.buscar ? (
    <>
      <CardBuscarOtra causa={card.buscar.causa} distancia={card.buscar.distancia} />
      {/* Buscar otro no abre combinaciones (como en el informe): se dice, al pie, donde en las
          otras dos va el botón, para que las tres cards compongan igual. */}
      {conBoton && <p className="lv-reco-sin">Buscar otro no abre combinaciones: la card dice por qué no conviene y a qué distancia queda Comprar.</p>}
    </>
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
          cuerpo: <Muestra popup={popup} veredicto={veredicto} valorUF={ejemplo.valorUF} />,
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

/** La sección 3 de la landing: la card del ejemplo en pantalla, con la misma rotación que la
 *  sección 2 y el mismo pie (barra + pausa), y el botón que abre la muestra de combinaciones. */
export function LoQueHariaFranco() {
  const { ejemplos, i, out, delay, pausado, pausar } = useRotacion();
  if (!ejemplos[i]) return null;
  // abrir la muestra pausa la rotación (el pop-up vive dentro de la card del ejemplo)
  const alAbrir = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest(".rec-cta") && !pausado) pausar();
  };
  return (
    <div className="lv-sreco-grid-inner">
      <div className="lv-idx">Lo que haría Franco</div>
      <div className="lv-reco doc-dictamen lv-reco-doc" onClickCapture={alAbrir}>
        <DocTokens />
        <PopupAjustesTokens />
        <TokensHallazgos />
        <div className="lv-pila lv-cards">
          {ejemplos.map((x, j) => (
            <ItemReco key={x.id} x={x} activo={j === i} out={out} delay={delay} conBoton />
          ))}
        </div>
        <PieRotacion />
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
