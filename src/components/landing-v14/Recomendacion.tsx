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
// (`DocTokens`, dentro de `.doc-dictamen`).
//
// LO ÚNICO QUE CAMBIA: sin botón. En el informe la card abre el pop-up de todas las
// combinaciones; la landing tiene un solo CTA (el campo de dirección) y un botón que no
// abre nada sería una promesa vacía. Tampoco va la alternativa de comunas: en renta
// larga solo la lleva un Ajustar sin salida, y desde el filtro del descuento (25-sep)
// ese caso pasa a Buscar otro, cuya card no la trae.
//
// SIN SALTOS AL ROTAR: las tres cards viven en la misma celda y se ve una; la celda
// mide lo que la más alta (Ajustar, con su caja de modificaciones).
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type { EjemploLanding } from "@/lib/landing-vivo";
import { PosicionFranco } from "@/components/analysis/shared/PosicionFranco";
import { LoQueHariaYoBloque, CardBuscarOtra } from "@/components/analysis/shared/LoQueHariaYoBloque";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { Glifo } from "./Marca";
import { BarraProgreso, useRotacion } from "./Rotacion";

/** La card de un ejemplo, tal como la dibuja el informe (sin el botón del pop-up). */
function Card({ ejemplo }: { ejemplo: EjemploLanding }) {
  const { card, veredicto, estado } = ejemplo;
  const bloque = card.buscar ? (
    <CardBuscarOtra causa={card.buscar.causa} distancia={card.buscar.distancia} />
  ) : card.bloque ? (
    <LoQueHariaYoBloque bloque={card.bloque} veredicto={veredicto} />
  ) : undefined;
  return (
    <PosicionFranco
      bloque={bloque}
      footer={null}
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

/** Un ejemplo de la pila: quién es (comuna, tipología y veredicto) y su card. */
function ItemReco({ x, activo, out, delay }: { x: EjemploLanding; activo: boolean; out: boolean; delay: (k: number) => CSSProperties }) {
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
        <Card ejemplo={x} />
      </div>
    </div>
  );
}

/** La sección 3 de la landing: la card del ejemplo en pantalla, con la misma
 *  rotación que la sección 2 y el control de pausa. */
export function LoQueHariaFranco() {
  const { ejemplos, i, out, delay, rota, pausado, pausar, seguir } = useRotacion();
  if (!ejemplos[i]) return null;
  return (
    <div className="lv-sreco-grid-inner">
      <div className="lv-idx">Lo que haría Franco</div>
      <div className="lv-reco doc-dictamen lv-reco-doc">
        <DocTokens />
        <div className="lv-pila">
          {ejemplos.map((x, j) => (
            <ItemReco key={x.id} x={x} activo={j === i} out={out} delay={delay} />
          ))}
        </div>
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
