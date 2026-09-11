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

import type { BloqueLoQueHariaYo, QuienLaPone } from "@/lib/lo-que-haria-yo";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { useRediseno } from "@/components/analysis/RedisenoContexto";

const TEXTO_CHIP: Record<QuienLaPone, string> = {
  vendedor: "lo pone el vendedor",
  mercado: "lo pone el mercado",
  tuyo: "lo pones tú",
};

export function LoQueHariaYoBloque({ bloque, veredicto }: { bloque: BloqueLoQueHariaYo; veredicto?: string }) {
  const { rotulo, contexto, filas, mix, descarte } = bloque;
  const rediseno = useRediseno();
  if (rediseno) return <EcuacionRecomendacion bloque={bloque} veredicto={veredicto} />;
  return (
    <div className="lqhy">
      <div className="lqhy-kick">{rotulo}</div>

      {filas.map((f, i) => (
        <div className="lqhy-row" key={`${f.titulo}-${i}`}>
          <div className="lqhy-q">
            {f.titulo}
            {/* El chip en el color del veredicto solo cuando la palanca es TUYA: es la
                única que el lector puede mover hoy, y el color lo dice sin una palabra. */}
            <span className={`lqhy-chip${f.quien === "tuyo" ? " tuyo" : ""}`}>{TEXTO_CHIP[f.quien]}</span>
          </div>
          <div className="lqhy-n">
            {f.cifra}
            <small>{f.objetivo ?? ""}</small>
          </div>
        </div>
      ))}

      {/* La cifra imposible: chica, en mono apagado y ANTES del mix. No es una fila —el
          mismo peso visual dejaba al lector sin saber cuál de los dos números mirar—:
          es el contexto que hace legible la acción de abajo. */}
      {contexto && <p className="lqhy-ctx">{contexto}</p>}

      {mix && (
        <div className="lqhy-mix">
          <div className="lqhy-mix-k">{mix.titulo}</div>
          <div className="lqhy-mix-mov">
            {mix.movimiento.pie && (
              <>
                Pie <span className="de">{mix.movimiento.pie.de}%</span>
                <span className="fl">→</span>
                {mix.movimiento.pie.a}%
              </>
            )}
            {mix.movimiento.pie && mix.movimiento.plazo && " · "}
            {mix.movimiento.plazo && (
              <>
                Plazo <span className="de">{mix.movimiento.plazo.de}</span>
                <span className="fl">→</span>
                {mix.movimiento.plazo.a} años
              </>
            )}
          </div>
          {/* El tachado necesita DOS números; sin solo-precio que cruce se dibuja solo el
              descuento que el mix sí pide, y si no pide ninguno no va nada. */}
          {mix.contraste ? (
            <div className="lqhy-mix-res">
              <span className="a">{mix.contraste.de}</span>
              <span className="fl">→</span>
              <span className="b">{mix.contraste.a}</span>
              <span className="u">el descuento que tendrías que pedir</span>
            </div>
          ) : mix.descuento ? (
            <div className="lqhy-mix-res">
              <span className="b">{mix.descuento}</span>
              <span className="u">el descuento que tendrías que pedir</span>
            </div>
          ) : null}
          {/* Sin descuento no queda un hueco: el hueco no distingue «no pide» de «no se
              calculó», y que no pida es la mitad que importa. */}
          {mix.sinDescuento && (
            <div className="lqhy-mix-res">
              <span className="b">{mix.sinDescuento}</span>
            </div>
          )}
          {mix.costo && <div className="lqhy-mix-cost">{mix.costo}</div>}
        </div>
      )}

      {descarte && <p className="lqhy-desc">{descarte}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LA ECUACIÓN (contrato §5)

   El mismo dato de arriba, en la forma que el contrato pide: tres filas con rótulo
   fijo a la izquierda —Cambias / Negocias / Resultado— y el valor a la derecha.

   LO QUE SE CAMBIA VA TACHADO Y TRANSPARENTE; LO NUEVO, SÓLIDO. Es la regla que hace
   legible la ecuación de un vistazo: el ojo salta a lo sólido y entiende el movimiento
   sin leer. Aplica a los chips y al precio.

   EL COSTO DEL DÍA UNO SIEMPRE ACOMPAÑA AL MIX. Sin esa línea el mix miente por
   omisión: «pon 10 puntos más de pie» suena gratis hasta que dice cuánta plata es.

   EL DESTINO SALE DEL DATO, no de un literal. Si el mix deja en un veredicto menor que
   COMPRAR, la fila «Resultado» lo dice. No es el caso que §5 quiere mostrar —«nunca un
   mix que solo llega al escalón intermedio»— pero mentir sobre adónde deja sería peor
   que mostrarlo: la decisión de qué hacer con esos casos es de producto y vive en el
   motor, no acá.
   ───────────────────────────────────────────────────────────────────────────── */
function EcuacionRecomendacion({ bloque, veredicto }: { bloque: BloqueLoQueHariaYo; veredicto?: string }) {
  const { mix, filas, contexto, descarte } = bloque;
  const corta = (v?: string) => (v ? etiquetaVeredicto(v, "corta", v) : "");

  // LA RECOMENDACIÓN APUNTA SIEMPRE A COMPRAR (contrato §5). Un mix que solo llega al
  // escalón intermedio NO es una recomendación: es lo que se probó, y vive en el
  // pop-up. Cuando el destino del mix no es COMPRAR, la card cae al estado SIN SALIDA
  // —el número real de lo que haría falta— y la ecuación no se dibuja.
  //
  // No se toca el motor: el mix se sigue calculando y el pop-up lo sigue mostrando.
  // Lo que cambia es qué muestra la CARD, que es lo que el lector lee primero.
  const soloEscalon = !!mix && mix.destino !== "COMPRAR";

  // SIN ECUACIÓN hay tres estados: COMPRAR —dos datos—, sin salida —el número real— y
  // el mix que solo llega al escalón, que se lee igual que sin salida.
  if (!mix || soloEscalon) {
    // LA FILA «RESULTADO» NO ES DEL MIX, ES DE LA ECUACIÓN. Sin mix, cuando hay filas,
    // esas filas SON salidas —palancas que cruzan solas, medidas por el motor contra
    // COMPRAR— y la transición es tan cierta como con mix. Faltaba por construcción: la
    // rama sin mix no la dibujaba nunca, ni siquiera cuando el dato la sostenía.
    //
    // NO va en los otros dos casos de esta misma rama:
    //   · COMPRAR — ya está en Comprar, no hay transición que mostrar;
    //   · sin salida / solo escalón — no se llega, que es justamente lo que dice.
    const mostrarResultado = !soloEscalon && veredicto !== "COMPRAR" && filas.length > 0;
    return (
      <div className="rec-eq">
        {contexto && <p className="rec-ctx">{contexto}</p>}
        {filas.map((f, i) => (
          <div className="rec-row" key={`${f.titulo}-${i}`}>
            {/* El rótulo corto es de las filas de COMPRAR: «Cuánto aguanta el veredicto»
                en una columna de 96 px se parte en tres líneas. */}
            <span className="rec-k">{f.rotuloCorto ?? f.titulo}</span>
            <span className="rec-v">
              <b>{f.cifra}</b>
              {f.objetivo && <em>{f.objetivo}</em>}
            </span>
          </div>
        ))}
        {mostrarResultado && (
          <div className="rec-row">
            <span className="rec-k">Resultado</span>
            <span className="rec-v rec-trans">
              <span className="rec-pill de">{corta(veredicto)}</span>
              <i className="rec-fl">→</i>
              <span className="rec-pill a">{corta("COMPRAR")}</span>
            </span>
          </div>
        )}
        {descarte && <p className="rec-desc">{descarte}</p>}
      </div>
    );
  }

  return (
    <div className="rec-eq">
      {contexto && <p className="rec-ctx">{contexto}</p>}
      {(mix.movimiento.pie || mix.movimiento.plazo) && (
        <div className="rec-row">
          <span className="rec-k">Cambias</span>
          {/* EL «+» VIAJA CON EL CHIP DE LA IZQUIERDA. Suelto entre dos chips, a 390 px
              el salto de línea cae justo antes y el signo queda solo arriba del segundo
              chip, como si sumara con la nada. Envuelto con el primero en un grupo que
              no rompe, el corte pasa DESPUÉS del signo. */}
          <span className="rec-v rec-chips">
            {mix.movimiento.pie && (
              <span className="rec-chip-g">
                <span className="rec-chip">
                  Pie <s>{mix.movimiento.pie.de}%</s> <b>{mix.movimiento.pie.a}%</b>
                </span>
                {mix.movimiento.plazo && <i className="rec-mas">+</i>}
              </span>
            )}
            {mix.movimiento.plazo && (
              <span className="rec-chip">
                Plazo <s>{mix.movimiento.plazo.de}</s> <b>{mix.movimiento.plazo.a} años</b>
              </span>
            )}
          </span>
        </div>
      )}
      <div className="rec-row">
        <span className="rec-k">Negocias</span>
        <span className="rec-v">
          {mix.descuento ? <b className="rec-dcto">{mix.descuento}</b> : <b className="rec-sin">{mix.sinDescuento}</b>}
          {/* EL TACHADO NO REPITE LA CIFRA GRANDE. `contraste.a` es, casi siempre, el
              mismo descuento que ya se lee arriba a 30 px: dibujar «−24,1% → −4,8%»
              debajo de un «−4,8%» enorme decía dos veces lo mismo (medido en el DOM).
              Lo que sí informa es el `de`: cuánto haría falta negociando SOLO el
              precio, que es el nombre que el motor le da al campo
              (`descuentoSoloPrecioPct`). Cuando los dos números difieren, la flecha
              vuelve porque entonces sí hay dos cosas que comparar. */}
          {mix.contraste && (
            <em className="rec-contra">
              <s>{mix.contraste.de}</s>{" "}
              {mix.contraste.a === mix.descuento ? "solo con el precio" : <>→ <b>{mix.contraste.a}</b></>}
            </em>
          )}
        </span>
      </div>
      <div className="rec-row">
        <span className="rec-k">Resultado</span>
        <span className="rec-v rec-trans">
          <span className="rec-pill de">{corta(veredicto)}</span>
          <i className="rec-fl">→</i>
          <span className="rec-pill a">{corta(mix.destino)}</span>
        </span>
      </div>
      {/* SIEMPRE, no «si hay»: ver la cabecera. */}
      {mix.costo && <p className="rec-cost">{mix.costo}</p>}
    </div>
  );
}
