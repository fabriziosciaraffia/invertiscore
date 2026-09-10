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

const TEXTO_CHIP: Record<QuienLaPone, string> = {
  vendedor: "lo pone el vendedor",
  mercado: "lo pone el mercado",
  tuyo: "lo pones tú",
};

export function LoQueHariaYoBloque({ bloque }: { bloque: BloqueLoQueHariaYo }) {
  const { rotulo, filas, mix, descarte } = bloque;
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
          {mix.costo && <div className="lqhy-mix-cost">{mix.costo}</div>}
        </div>
      )}

      {descarte && <p className="lqhy-desc">{descarte}</p>}
    </div>
  );
}
