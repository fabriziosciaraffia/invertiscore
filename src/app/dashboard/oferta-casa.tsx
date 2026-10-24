// ─────────────────────────────────────────────────────────────────────────────
// LA OFERTA ROJA DE UNA FILA (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html): «Solo para cuentas nuevas ·
// vence mañana 11:17 · 3 análisis por $14.990 · Aprovechar», debajo del saludo, mientras el ticket de la cuenta nueva
// esté vivo —con o sin saldo (lib/casa/reglas.ts › ofertaEnCasa)—. Es el único rojo de la casa. «Aprovechar» compra el
// pack al precio del ticket y vuelve al dashboard.
// ─────────────────────────────────────────────────────────────────────────────
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { cuandoVenceCorto, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import { urlCompra } from "@/lib/compra/compra";
import { CASA } from "./casa-copy";

/** Adónde compra la oferta del dashboard: el pack del ticket, de vuelta al dashboard. */
export const hrefOfertaCasa = () => urlCompra({ product: PRODUCTO_PACK, volver: "/dashboard" });

export function OfertaCasa({ cuentaCreadaAt, ahora = new Date() }: { cuentaCreadaAt: string; ahora?: Date }) {
  return (
    <section className="ca-oferta" data-casa="oferta" data-vence={cuandoVenceCorto(cuentaCreadaAt, ahora)}>
      <div className="ca-oferta-txt">
        <span className="ca-oferta-k">{CASA.oferta.kicker(cuandoVenceCorto(cuentaCreadaAt, ahora))}</span>
        <span className="ca-oferta-t">{CASA.oferta.titulo}</span>
      </div>
      <EnlaceCarga href={hrefOfertaCasa()} className="ca-oferta-btn" data-casa="aprovechar">{CASA.oferta.boton}</EnlaceCarga>
    </section>
  );
}
