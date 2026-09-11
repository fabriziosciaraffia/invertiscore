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
// servidor (landing-vivo.ts) y acá no se decide nada: QUÉ filas van, CUÁNDO hay
// mix y CUÁL es el estado sin salida es la misma lógica de `EcuacionRecomendacion`
// (LoQueHariaYoBloque.tsx), reescrita con clases `lr-` porque aquélla vive detrás
// del contexto del rediseño y del CSS `.doc-r2` del informe, que la landing no
// carga. Si cambia una regla allá, cambia acá: los dos leen el mismo modelo.
//
// SIN CTA EN LA CARD: el informe cierra con «Ver ajustes / Ver margen / Ver qué se
// probó», que abre el pop-up. La landing tiene un solo CTA (el campo de
// dirección) y un botón que no abre nada sería una promesa vacía.
// ─────────────────────────────────────────────────────────────────────────────

import type { EjemploLanding, RecomendacionLanding } from "@/lib/landing-vivo";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { Veredicto } from "@/lib/types";
import { Glifo } from "./Marca";
import { BarraProgreso, useRotacion } from "./Rotacion";

/** Píldora de veredicto de la fila «Resultado»: la de salida apagada, la de
 *  llegada en blanco. Con el glifo de la landing como signo. */
function PillCorta({ veredicto, activa }: { veredicto: Veredicto; activa: boolean }) {
  return (
    <span className={`lr-pill${activa ? " a" : " de"}`} data-verdict={veredicto}>
      <Glifo veredicto={veredicto} />
      {etiquetaVeredicto(veredicto, "corta", veredicto)}
    </span>
  );
}

/** La ecuación (contrato §5), en los tres estados: COMPRAR (dos datos), sin salida
 *  (el número real, el puente y a dónde ir) y la ecuación completa (palancas solas,
 *  «Con lo tuyo», resultado y costo del día uno). */
function Ecuacion({ veredicto, reco }: { veredicto: Veredicto; reco: RecomendacionLanding }) {
  const { bloque, alternativa, sinSalida } = reco;
  if (!bloque) return null;
  const { filas, mix, contexto, descarte } = bloque;
  const soloEscalon = !!mix && mix.destino !== "COMPRAR";

  if (!mix || soloEscalon) {
    // Sin mix: las filas SON salidas (palancas que cruzan solas) y la transición se
    // dibuja; en COMPRAR no hay transición y en sin salida no se llega.
    const mostrarResultado = !soloEscalon && veredicto !== "COMPRAR" && filas.length > 0;
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
        {filas.map((f, k) => (
          <div className="lr-row" key={`${f.titulo}-${k}`}>
            <span className="lr-k">{f.rotuloCorto ?? f.titulo}</span>
            <span className="lr-v">
              <b>{f.cifra}</b>
              {f.objetivo && <em>{f.objetivo}</em>}
            </span>
          </div>
        ))}
        {mostrarResultado && (
          <div className="lr-row">
            <span className="lr-k">Resultado</span>
            <span className="lr-v lr-trans">
              <PillCorta veredicto={veredicto} activa={false} />
              <i className="lr-fl">→</i>
              <PillCorta veredicto="COMPRAR" activa />
            </span>
          </div>
        )}
        {descarte && <p className="lr-desc">{descarte}</p>}
      </div>
    );
  }

  // Las palancas solas y el mix son ALTERNATIVAS, no pasos: «Solo el precio» contra
  // «Con lo tuyo». Todas llegan al mismo lugar, y por eso «Resultado» va último.
  const solas = filas.filter((f) => f.rotuloCorto);
  return (
    <div className="lr-eq">
      {contexto && <p className="lr-ctx">{contexto}</p>}
      {solas.map((f, k) => (
        <div className="lr-row" key={`${f.titulo}-${k}`}>
          <span className="lr-k">{f.rotuloCorto}</span>
          <span className="lr-v">
            <b>{f.cifra}</b>
            {f.objetivo && <em>{f.objetivo}</em>}
          </span>
        </div>
      ))}
      {(mix.movimiento.pie || mix.movimiento.plazo || mix.descuento || mix.sinDescuento) && (
        <div className="lr-row">
          <span className="lr-k">Con lo tuyo</span>
          <span className="lr-v lr-chips">
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
            {(mix.descuento || mix.sinDescuento) && (
              <span className="lr-dcto-g">
                {(mix.movimiento.pie || mix.movimiento.plazo) && <i className="lr-fl">→</i>}
                {mix.descuento ? (
                  <b className="lr-dcto">{mix.descuento} <small>dcto.</small></b>
                ) : (
                  <b className="lr-sin">{mix.sinDescuento}</b>
                )}
              </span>
            )}
          </span>
        </div>
      )}
      <div className="lr-row">
        <span className="lr-k">Resultado</span>
        <span className="lr-v lr-trans">
          <PillCorta veredicto={veredicto} activa={false} />
          <i className="lr-fl">→</i>
          <PillCorta veredicto={mix.destino} activa />
        </span>
      </div>
      {/* SIEMPRE bajo el mix (§5): sin esta línea «pon 10 puntos más de pie» suena gratis */}
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
        <p className={`lr-bajada ${x(1).className}`} style={x(1).style}>
          {reco?.bajada ?? "Lo que Franco probó para este caso"}
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
