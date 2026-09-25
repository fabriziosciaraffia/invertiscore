// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE HARÍA YO» — la card simplificada (24-sep-2026)
//
// Dibuja lo que `construirLoQueHariaYo` arma. Sin lógica propia: si acá hay un `if` que
// decide QUÉ decir, está en el archivo equivocado.
//
// CON EL POP-UP MOSTRANDO EL MAPA COMPLETO, LA CARD SE SIMPLIFICA (decisión de Fabrizio,
// 24-sep): en Ajustar, SOLO la recomendación de Franco con su dificultad y el acceso al pop-up
// («Ver todas las combinaciones», que dibuja el caller); en Comprar, SOLO el margen; en Buscar
// otra, la causa y la distancia a Comprar, sin botón ni pop-up (`CardBuscarOtra`). Lo que salió
// de acá —el «Resultado», el «Alternativamente», el paréntesis del precio solo— vive en el
// pop-up, o dejó de hacer falta.
//
// La recomendación es la MISMA que marca la celda «Franco» del pop-up y la que ancla «A qué
// precio cerrar»: la raíz del mix hacia Comprar (`recomendacionFranco`).
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import type { BloqueLoQueHariaYo } from "@/lib/lo-que-haria-yo";
import { bandaDeDescuento, ETIQUETA_BANDA } from "@/lib/banda-esfuerzo";
import { pctCard } from "@/lib/lo-que-haria-yo";

export function LoQueHariaYoBloque({
  bloque,
  veredicto,
  alternativa,
}: {
  bloque: BloqueLoQueHariaYo;
  veredicto?: string;
  /** LA ALTERNATIVA DE COMUNAS (§5), ya redactada por el motor. Solo en Ajustar sin salida. */
  alternativa?: string | null;
}) {
  const { mix, filas, contexto } = bloque;

  // ── COMPRAR: solo el margen ────────────────────────────────────────────────
  if (veredicto === "COMPRAR") {
    const margen = filas.find((f) => f.rotuloCorto === "Margen");
    if (!margen) return null;
    return (
      <div className="rec-eq">
        <div className="rec-row">
          <span className="rec-k">{margen.rotuloCorto}</span>
          <span className="rec-v rec-o">{margen.oracion ?? margen.cifra}</span>
        </div>
      </div>
    );
  }

  // ── AJUSTAR CON COMBINACIÓN: la recomendación de Franco ────────────────────
  if (mix && mix.destino === "COMPRAR") {
    return (
      <div className="rec-eq">
        <div className="rec-tuyo">
          <div className="rec-gt">Modificaciones que dependen de ti</div>
          {(mix.movimiento.pie || mix.movimiento.plazo) && (
            <div className="rec-chips">
              {mix.movimiento.pie && (
                <span className="rec-chip-g">
                  <span className="rec-chip">
                    Pie <s>{pctCard(mix.movimiento.pie.de)}%</s> <b>{pctCard(mix.movimiento.pie.a)}%</b>
                  </span>
                  {mix.movimiento.plazo && <i className="rec-mas">+</i>}
                </span>
              )}
              {mix.movimiento.plazo && (
                <span className="rec-chip">
                  Plazo <s>{mix.movimiento.plazo.de}</s> <b>{mix.movimiento.plazo.a} años</b>
                </span>
              )}
            </div>
          )}
          <div className="rec-pides">
            <span className="rec-fl">→</span>
            <div>
              <b>{mix.descuento ? `Negocias ${mix.descuento} dcto. en precio` : mix.sinDescuento}</b>
              {mix.bandaEsfuerzo && <span className="rec-banda">{ETIQUETA_BANDA[mix.bandaEsfuerzo]}</span>}
            </div>
          </div>
        </div>
        {/* EL COSTO DEL DÍA UNO, siempre con la combinación: sin esa línea miente por omisión. */}
        {mix.costo && <p className="rec-cost">{mix.costo}</p>}
      </div>
    );
  }

  // ── AJUSTAR SIN COMBINACIÓN QUE QUEPA: la palanca sola que la reemplaza ────
  const precio = filas.find((f) => f.nombre === "precio");
  if (precio) {
    const pct = Math.abs(parseFloat(precio.cifra.replace(/[^\d,.-]/g, "").replace(",", ".")));
    return (
      <div className="rec-eq">
        <div className="rec-tuyo">
          <div className="rec-pides">
            <span className="rec-fl">→</span>
            <div>
              <b>Negocias {precio.cifra} dcto. en precio</b>
              {Number.isFinite(pct) && pct > 0 && <span className="rec-banda">{ETIQUETA_BANDA[bandaDeDescuento(pct)]}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }
  const deMercado = filas.find((f) => f.quien === "mercado");
  if (deMercado) {
    return (
      <div className="rec-eq">
        <p className="rec-puente">
          Con {deMercado.nombre === "tarifa" ? "la tarifa por noche" : "el arriendo"} {deMercado.cifra.replace(/^\+/, "")} más{" "}
          {deMercado.nombre === "tarifa" ? "alta" : "alto"} llega a Comprar, pero eso depende del mercado.
        </p>
      </div>
    );
  }

  // ── SIN SALIDA: el número real y el puente ────────────────────────────────
  return (
    <div className="rec-eq">
      {contexto && <p className="rec-ctx">{contexto}</p>}
      <p className="rec-puente">
        Franco no encontró una combinación que lo haga convenir.
        <br />
        Prueba con otro departamento.
      </p>
      {alternativa && <p className="rec-donde">{alternativa}</p>}
    </div>
  );
}

/**
 * LA CARD DE BUSCAR OTRA (24-sep-2026): por qué no conviene y a qué distancia queda Comprar.
 * Sin botón y sin pop-up: no hay combinación que ofrecer. El texto lo arma
 * `buscar-otra-copy.ts`; acá solo se dibuja.
 */
export function CardBuscarOtra({ causa, distancia }: { causa: string; distancia: string | null }) {
  return (
    <div className="rec-eq">
      <p className="rec-v rec-o" style={{ fontSize: 15, lineHeight: 1.5 }}>
        {causa}
      </p>
      {distancia && <p className="rec-ctx" style={{ marginTop: 10, marginBottom: 0 }}>{distancia}</p>}
    </div>
  );
}
