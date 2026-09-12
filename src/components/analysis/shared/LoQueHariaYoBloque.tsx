// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE HARÍA YO» — el cuerpo determinista (10-sep-2026)
//
// Dibuja lo que `construirLoQueHariaYo` arma. Sin lógica propia: si acá hay un
// `if` que decide QUÉ decir, está en el archivo equivocado — el modelo es puro y
// se testea aparte.
//
// Contrato visual: docs/wireframes/rediseno-informe/lo-que-haria-yo-apretado.html
// Las cifras del wireframe son ILUSTRATIVAS (Fabrizio las armó con datos de otra
// seed); mandan las del motor.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { Fragment } from "react";
import { lineaNoDependeDeTi, type BloqueLoQueHariaYo } from "@/lib/lo-que-haria-yo";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";

export function LoQueHariaYoBloque({
  bloque,
  veredicto,
  alternativa,
}: {
  bloque: BloqueLoQueHariaYo;
  veredicto?: string;
  /** LA ALTERNATIVA DE COMUNAS (§5), ya redactada por el motor. Solo llega en el
   *  estado sin salida y solo cuando alguna comuna cruza: `null` es un caso real
   *  —151 de las 604 filas del parque— y ahí la card no inventa nada. */
  alternativa?: string | null;
}) {
  return <EcuacionRecomendacion bloque={bloque} veredicto={veredicto} alternativa={alternativa} />;
}

/* ─────────────────────────────────────────────────────────────────────────────
   LA CARD (contrato §5 revisado, 11-sep-2026) — «lo tuyo primero»

   La recomendación ES lo que puedes hacer tú. Por eso el mix va en una caja propia
   —«Modificaciones que dependen de ti»— con los chips y, bajo una línea, lo que
   resulta: «→ Negocias −X% dcto. en precio», y entre paréntesis cuánto habría que
   pedir sin mover lo tuyo. Resultado va INMEDIATAMENTE después, con signo en las
   píldoras. Las palancas que no dependen de ti van al final, en una sola oración
   —«Alternativamente: +X% de arriendo o −Y% de precio (c/u por separado)»— seguida de
   por qué no son la recomendación: «Pero eso no depende de ti: lo pone …».

   LO QUE SE CAMBIA VA TACHADO Y TRANSPARENTE; LO NUEVO, SÓLIDO. Aplica a los chips.

   LAS TRES ACOTACIONES —el paréntesis, «Pero eso no depende de ti» y el costo del día
   uno— van al mismo tamaño y opacidad. Ninguna destaca. Y el costo SIEMPRE acompaña al
   mix: sin esa línea el mix miente por omisión.

   NINGUNA CIFRA LLEVA CHIP DE «QUIÉN LO PONE»: el grupo y la oración ya lo dicen. El
   chip por fila vive en el pop-up de palancas.

   EL DESTINO SALE DEL DATO. Un mix que solo llega al escalón intermedio NO es una
   recomendación: la card cae al estado sin salida y el escalón vive en el pop-up.
   ───────────────────────────────────────────────────────────────────────────── */
function EcuacionRecomendacion({
  bloque,
  veredicto,
  alternativa,
}: {
  bloque: BloqueLoQueHariaYo;
  veredicto?: string;
  alternativa?: string | null;
}) {
  const { mix, filas, contexto, descarte } = bloque;
  const corta = (v?: string) => (v ? etiquetaVeredicto(v, "corta", v) : "");
  // Píldoras con signo (§5 revisado): la actual tenue, el destino en blanco sólido.
  const pill = (v: string, cls: "de" | "a") => (
    <span className={cls === "de" ? "rec-pill de" : "rec-pill a"}>
      {signoVeredicto(v)} {corta(v)}
    </span>
  );
  const soloEscalon = !!mix && mix.destino !== "COMPRAR";

  // LAS ALTERNATIVAS: las palancas solas que cruzan y NO dependen de ti (arriendo, precio).
  // El pie y el plazo que cruzan solos no se nombran acá —son lo tuyo— y viven en el pop-up.
  const alternativas = filas.filter((f) => f.rotuloCorto && f.quien !== "tuyo");
  const resultado = (
    <>
      <div className="rec-gt">Resultado</div>
      <div className="rec-res rec-trans">
        {pill(veredicto ?? "", "de")}
        <i className="rec-fl">→</i>
        {pill("COMPRAR", "a")}
      </div>
    </>
  );
  const alternativamente =
    alternativas.length > 0 ? (
      <div className="rec-alt">
        <p className="rec-a1">
          Alternativamente:{" "}
          {alternativas.map((f, i) => (
            <Fragment key={`${f.nombre}-${i}`}>
              {i > 0 && " o "}
              <b>
                {f.cifra} de {f.nombre}
              </b>
            </Fragment>
          ))}
          {/* «(c/u por separado)» SOLO con dos alternativas (12-sep-2026): con una no hay
              «cada una», y la oración cierra con punto. Medido: 74 cards LTR y 15 STR. */}
          {alternativas.length > 1 ? " " : "."}
          {alternativas.length > 1 && <em>(c/u por separado)</em>}
        </p>
        <p className="rec-a2">{lineaNoDependeDeTi(alternativas.map((f) => f.quien))}</p>
      </div>
    ) : null;

  // SIN LA CAJA hay tres estados: COMPRAR —dos filas con rótulo de una palabra—, sin
  // salida —el número real y el puente— y sin mix con palancas que cruzan, donde
  // «Alternativamente» pasa a ser la línea principal y Resultado se conserva.
  if (!mix || soloEscalon) {
    // LA FILA «RESULTADO» NO ES DEL MIX, ES DE LA CARD. Sin mix, cuando hay filas, esas
    // filas SON salidas —palancas que cruzan solas, medidas por el motor contra COMPRAR—
    // y la transición es tan cierta como con mix. NO va en COMPRAR (ya está ahí) ni en
    // sin salida (no se llega, que es justamente lo que dice).
    const mostrarResultado = !soloEscalon && veredicto !== "COMPRAR" && filas.length > 0;
    // EL ESTADO SIN SALIDA: o el mix solo llega al escalón intermedio, o no hay mix ni
    // palancas que crucen. COMPRAR no lo es —ahí hay dos datos— y tener filas tampoco.
    const sinSalida = veredicto !== "COMPRAR" && (soloEscalon || filas.length === 0);
    return (
      <div className="rec-eq">
        {contexto && <p className="rec-ctx">{contexto}</p>}
        {/* EL PUENTE. Sin esto la card decía cuánto haría falta y dejaba al lector ahí,
            sin nada que hacer con esa cifra: nombra que se probó y para dónde ir. */}
        {sinSalida && (
          <p className="rec-puente">
            Franco no encontró una combinación que lo haga convenir.
            <br />
            Prueba con otro departamento.
          </p>
        )}
        {/* Y DÓNDE (§5): «a dónde ir» es un dato del motor —el mismo depto corrido en las
            otras comunas del roster— y va sin cifras, solo cuando alguna cruza. */}
        {sinSalida && alternativa && <p className="rec-donde">{alternativa}</p>}
        {/* COMPRAR: dos filas con rótulo de una palabra — «Aguanta» y «Verifica». */}
        {veredicto === "COMPRAR" &&
          filas.map((f, i) => (
            <div className="rec-row" key={`${f.titulo}-${i}`}>
              <span className="rec-k">{f.rotuloCorto ?? f.titulo}</span>
              {/* Con oración (12-sep-2026) la fila se lee como cuerpo, no como cifra en mono:
                  «El arriendo puede caer hasta $720.000 (−6,3%) y sigue siendo Comprar.» */}
              {f.oracion ? (
                <span className="rec-v rec-o">{f.oracion}</span>
              ) : (
                <span className="rec-v">
                  <b>{f.cifra}</b>
                  {f.objetivo && <em>{f.objetivo}</em>}
                </span>
              )}
            </div>
          ))}
        {/* SIN MIX, CON PALANCAS QUE CRUZAN: «Alternativamente» es la línea principal. */}
        {mostrarResultado && alternativamente}
        {mostrarResultado && (
          resultado
        )}
        {descarte && <p className="rec-desc">{descarte}</p>}
      </div>
    );
  }

  return (
    <div className="rec-eq">
      {contexto && <p className="rec-ctx">{contexto}</p>}
      {/* LO TUYO PRIMERO: la caja con los chips del mix y, bajo la línea, lo que resulta. */}
      <div className="rec-tuyo">
        <div className="rec-gt">Modificaciones que dependen de ti</div>
        <div className="rec-chips">
          {mix.movimiento.pie && (
            <span className="rec-chip-g">
              <span className="rec-chip">
                Pie <s>{mix.movimiento.pie.de}%</s> <b>{mix.movimiento.pie.a}%</b>
              </span>
              {/* El «+» viaja con el primer chip: así el salto de línea cae después del
                  signo y nunca antes (a 390 px quedaba solo arriba del segundo chip). */}
              {mix.movimiento.plazo && <i className="rec-mas">+</i>}
            </span>
          )}
          {mix.movimiento.plazo && (
            <span className="rec-chip">
              Plazo <s>{mix.movimiento.plazo.de}</s> <b>{mix.movimiento.plazo.a} años</b>
            </span>
          )}
        </div>
        <div className="rec-pides">
          <span className="rec-fl">→</span>
          <div>
            <b>{mix.descuento ? `Negocias ${mix.descuento} dcto. en precio` : mix.sinDescuento}</b>
            {/* El paréntesis cuelga del descuento: sin descuento no hay contra qué contrastar
                y la línea ya dice lo que importa («Sin pedirle un peso al vendedor»). */}
            {mix.descuento && mix.contraste && (
              <span className="rec-vs">({mix.contraste.de} si solo modificas el precio)</span>
            )}
          </div>
        </div>
      </div>
      {/* RESULTADO, inmediatamente después de lo tuyo. */}
      {resultado}
      {/* LO QUE NO DEPENDE DE TI, en una sola oración, después. */}
      {alternativamente}
      {/* EL COSTO DEL DÍA UNO, siempre con el mix. */}
      {mix.costo && <p className="rec-cost">{mix.costo}</p>}
    </div>
  );
}
