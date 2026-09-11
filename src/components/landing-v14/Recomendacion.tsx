"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Sección 3 — "Lo que haría Franco": la card §5 del informe («La recomendación
// de Franco») para el MISMO ejemplo que la sección 2, rotando en sincronía.
//
// Es la única pieza del informe cuyo fondo depende del veredicto (gradiente del
// `--verdict-deep` a tinta, brightness 1.30 saturate .70, grano 16 %), y por eso
// tiene su propia pantalla (plan B de FASE 1.9, 11-sep-2026): bajo la miniatura
// la sección 2 medía 1.174 px a 1440 en el caso que importa (AJUSTA, la única
// con ecuación completa). Ritmo de la página: hero oscuro · respuesta papel ·
// recomendación papel · por qué creerle tinta · cierre papel.
//
// EL DATO ES EL DEL INFORME. `bloque` lo arma `construirLoQueHariaYo` en el
// servidor (landing-vivo.ts) y acá no se decide nada: QUÉ va en la caja, CUÁNDO
// hay «Alternativamente» y CUÁL es el estado sin salida es la misma lógica de
// `EcuacionRecomendacion` (LoQueHariaYoBloque.tsx, contrato §5 revisado del
// 11-sep-2026: «lo tuyo primero»), reescrita con clases `lr-` porque aquélla vive
// detrás del contexto del rediseño y del CSS `.doc-r2` del informe, que la landing
// no carga. Si cambia una regla allá, cambia acá: los dos leen el mismo modelo.
//
// SIN CTA EN LA CARD: el informe cierra con «Ver ajustes / Ver margen / Ver qué se
// probó», que abre el pop-up. La landing tiene un solo CTA (el campo de
// dirección) y un botón que no abre nada sería una promesa vacía.
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment } from "react";
import type { EjemploLanding, RecomendacionLanding } from "@/lib/landing-vivo";
import { BAJADA_RECOMENDACION, lineaNoDependeDeTi } from "@/lib/lo-que-haria-yo";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import type { Veredicto } from "@/lib/types";
import { Glifo } from "./Marca";
import { BarraProgreso, useRotacion } from "./Rotacion";

/** Píldora con signo (§5 revisado): la actual tenue, el destino en blanco sólido. */
function Pill({ veredicto, activa }: { veredicto: Veredicto; activa: boolean }) {
  return (
    <span className={`lr-pill${activa ? " a" : " de"}`}>
      {signoVeredicto(veredicto)} {etiquetaVeredicto(veredicto, "corta", veredicto)}
    </span>
  );
}

/** La card (contrato §5 revisado): COMPRAR (dos filas), sin salida (el número real,
 *  el puente y a dónde ir), sin mix con palancas que cruzan («Alternativamente» es la
 *  línea principal) y la forma completa: la caja de lo tuyo, Resultado, la oración
 *  de lo que no depende de ti y el costo del día uno. */
function Ecuacion({ veredicto, reco }: { veredicto: Veredicto; reco: RecomendacionLanding }) {
  const { bloque, alternativa, estado } = reco;
  if (!bloque) return null;
  const { filas, mix, contexto, descarte } = bloque;
  const soloEscalon = !!mix && mix.destino !== "COMPRAR";

  // Las alternativas: las palancas solas que cruzan y NO dependen de ti (arriendo,
  // precio). El pie y el plazo que cruzan solos son lo tuyo y viven en el pop-up.
  const alternativas = filas.filter((f) => f.rotuloCorto && f.quien !== "tuyo");
  const resultado = (
    <>
      <div className="lr-gt">Resultado</div>
      <div className="lr-res lr-trans">
        <Pill veredicto={veredicto} activa={false} />
        <i className="lr-fl">→</i>
        <Pill veredicto="COMPRAR" activa />
      </div>
    </>
  );
  const alternativamente =
    alternativas.length > 0 ? (
      <div className="lr-alt">
        <p className="lr-a1">
          Alternativamente:{" "}
          {alternativas.map((f, k) => (
            <Fragment key={`${f.nombre}-${k}`}>
              {k > 0 && " o "}
              <b>
                {f.cifra} de {f.nombre}
              </b>
            </Fragment>
          ))}{" "}
          <em>(c/u por separado)</em>
        </p>
        <p className="lr-a2">{lineaNoDependeDeTi(alternativas.map((f) => f.quien))}</p>
      </div>
    ) : null;

  if (!mix || soloEscalon) {
    const mostrarResultado = !soloEscalon && veredicto !== "COMPRAR" && filas.length > 0;
    const sinSalida = estado === "sin_salida";
    return (
      <div className="lr-eq">
        {contexto && <p className="lr-ctx">{contexto}</p>}
        {sinSalida && (
          <p className="lr-puente">
            Franco no encontró una combinación que lo haga convenir.
            <br />
            Prueba con otro departamento.
          </p>
        )}
        {sinSalida && alternativa && <p className="lr-donde">{alternativa}</p>}
        {veredicto === "COMPRAR" &&
          filas.map((f, k) => (
            <div className="lr-row" key={`${f.titulo}-${k}`}>
              <span className="lr-k">{f.rotuloCorto ?? f.titulo}</span>
              <span className="lr-v">
                <b>{f.cifra}</b>
                {f.objetivo && <em>{f.objetivo}</em>}
              </span>
            </div>
          ))}
        {mostrarResultado && alternativamente}
        {mostrarResultado && resultado}
        {descarte && <p className="lr-desc">{descarte}</p>}
      </div>
    );
  }

  return (
    <div className="lr-eq">
      {contexto && <p className="lr-ctx">{contexto}</p>}
      {/* LO TUYO PRIMERO: la caja con los chips del mix y, bajo la línea, lo que resulta */}
      <div className="lr-tuyo">
        <div className="lr-gt">Modificaciones que dependen de ti</div>
        <div className="lr-chips">
          {mix.movimiento.pie && (
            <span className="lr-chip-g">
              <span className="lr-chip">
                Pie <s>{mix.movimiento.pie.de}%</s> <b>{mix.movimiento.pie.a}%</b>
              </span>
              {mix.movimiento.plazo && <i className="lr-mas">+</i>}
            </span>
          )}
          {mix.movimiento.plazo && (
            <span className="lr-chip">
              Plazo <s>{mix.movimiento.plazo.de}</s> <b>{mix.movimiento.plazo.a} años</b>
            </span>
          )}
        </div>
        <div className="lr-pides">
          <span className="lr-fl">→</span>
          <div>
            <b>{mix.descuento ? `Negocias ${mix.descuento} dcto. en precio` : mix.sinDescuento}</b>
            {mix.descuento && mix.contraste && (
              <span className="lr-vs">({mix.contraste.de} si solo modificas el precio)</span>
            )}
          </div>
        </div>
      </div>
      {resultado}
      {alternativamente}
      {/* SIEMPRE con el mix (§5): sin esta línea «pon 10 puntos más de pie» suena gratis */}
      {mix.costo && <p className="lr-costo">{mix.costo}</p>}
    </div>
  );
}

/** La card sola, sin rotación: la usa /metodologia (sección 04) con el ejemplo
 *  congelado, y la sección 3 de la landing la envuelve con las transiciones. */
export function CardRecomendacion({
  ejemplo,
  out = false,
  delay,
  children,
}: {
  ejemplo: EjemploLanding;
  out?: boolean;
  delay?: (k: number) => { transitionDelay: string };
  children?: React.ReactNode;
}) {
  const reco = ejemplo.recomendacion;
  const estado = reco?.estado ?? "sin_bloque";
  const d = delay ?? (() => ({ transitionDelay: "0ms" }));
  const x = (k: number) => ({ className: `lv-x${out ? " out" : ""}`, style: d(k) });
  return (
    <article className="lv-reco" data-verdict={ejemplo.veredicto} aria-live={delay ? "polite" : undefined}>
      <div className="lv-reco-fondo" aria-hidden="true" />
      <div className="lv-reco-cuerpo">
        <div {...x(0)}>
          <span className="lv-reco-eyebrow">
            <span>
              <b>{ejemplo.comuna}</b>
              {ejemplo.detalle && <> · {ejemplo.detalle}</>}
            </span>
            <span className="lv-reco-eyebrow-v" data-verdict={ejemplo.veredicto}>
              <Glifo veredicto={ejemplo.veredicto} />
              {ejemplo.etiqueta}
            </span>
          </span>
        </div>
        <h3 {...x(1)}>La recomendación de Franco</h3>
        {/* la bajada según el ESTADO (§5 revisado): con salida lleva la píldora neutra */}
        <p className={`lr-bajada ${x(1).className}`} style={x(1).style}>
          {BAJADA_RECOMENDACION[estado]}
          {estado === "con_salida" && (
            <span className="lr-pill-neutra">
              {signoVeredicto("COMPRAR")} {etiquetaVeredicto("COMPRAR", "corta")}
            </span>
          )}
        </p>
        <div {...x(2)}>{reco && <Ecuacion veredicto={ejemplo.veredicto} reco={reco} />}</div>
        {children}
      </div>
    </article>
  );
}

/** La sección 3 de la landing: la card del ejemplo en pantalla, con la misma
 *  rotación que la sección 2 y el control de pausa. */
export function LoQueHariaFranco() {
  const { ejemplos, i, out, delay, rota, pausado, pausar, seguir } = useRotacion();
  const x = ejemplos[i];
  if (!x) return null;
  return (
    <div className="lv-sreco-grid-inner">
      <div className="lv-idx">Lo que haría Franco</div>
      <CardRecomendacion ejemplo={x} out={out} delay={delay}>
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
      </CardRecomendacion>
      <div className="lv-reco-texto">
        <h2 className="lv-reco-h2">
          Cada informe termina con <mark>una recomendación</mark>, no con un puntaje.
        </h2>
        <p>
          Franco prueba cada cambio por separado —precio, arriendo, pie, plazo— y después combina los que dependen de ti.
          Si el veredicto ya es Comprar, te dice cuánto aguanta antes de dejar de serlo.
        </p>
        <p>
          Y si nada alcanza, te lo dice con el número real de lo que haría falta, y te nombra dónde un depto así sí
          convendría.
        </p>
      </div>
    </div>
  );
}
