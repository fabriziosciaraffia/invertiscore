"use client";

import type { ReactNode } from "react";
import { avisoRedondeo, montoCelda, montoCuenta, unidadTabla, type Moneda } from "@/lib/planilla-calculo";

/**
 * «Cómo se calcula» — las piezas de la planilla (mockup aprobado el 23-sep-2026,
 * `docs/wireframes/rediseno-informe/planilla-como-se-calcula.html`). Render puro: cada
 * modalidad arma sus filas desde el motor y acá solo se pintan.
 *   · `TablaFlujo`: año · entra · gastos · cuota · flujo neto, y el total. Pesos exactos en
 *     escritorio; en teléfono (`compacto`) millones con un decimal y el redondeo avisado.
 *   · `Indicador`: nombre (con su ⓘ), fórmula en palabras, cuenta y, DEBAJO, el resultado.
 *   · `RemiteResultado`: lo que te queda al vender, con el enlace a «Tu resultado». La venta
 *     no se desglosa acá: vive en ese capítulo.
 * Color: gastos y cuota en tinta con su signo menos; rojo solo en el flujo negativo.
 */
export type FilaFlujo = {
  anio: number;
  /** Meses que opera el año de entrega, si es parcial: marca la fila con peso, no con color. */
  mesesEntrega?: number | null;
  entra: number;
  /** Todo lo que no es cuota, en positivo. */
  gastos: number;
  cuota: number;
  /** El flujo del motor, no la resta: si el redondeo descuadra, manda éste. */
  flujo: number;
};

export function TablaFlujo({ filas, moneda, valorUF, compacto }: { filas: FilaFlujo[]; moneda: Moneda; valorUF: number; compacto: boolean }) {
  const f = (n: number) => montoCelda(n, moneda, valorUF, compacto);
  const tot = filas.reduce((a, p) => ({ entra: a.entra + p.entra, gastos: a.gastos + p.gastos, cuota: a.cuota + p.cuota, flujo: a.flujo + p.flujo }), { entra: 0, gastos: 0, cuota: 0, flujo: 0 });
  return (
    <>
      <p className="pc-u">{unidadTabla(moneda, compacto)}</p>
      <table className="pc-flujo">
        <colgroup>
          <col className="c-anio" />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Año</th>
            <th>Entra</th>
            <th>Gastos</th>
            <th>Cuota</th>
            <th>Flujo neto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.anio} className={p.mesesEntrega ? "ent" : undefined}>
              <td>
                {p.anio}
                {p.mesesEntrega ? <small>entrega · {p.mesesEntrega} {p.mesesEntrega === 1 ? "mes" : "meses"}</small> : null}
              </td>
              <td>{f(p.entra)}</td>
              <td>{f(-p.gastos)}</td>
              <td>{f(-p.cuota)}</td>
              <td className={p.flujo < 0 ? "neg" : undefined}>{f(p.flujo)}</td>
            </tr>
          ))}
          <tr className="tot">
            <td>Total {filas.length} años</td>
            <td>{f(tot.entra)}</td>
            <td>{f(-tot.gastos)}</td>
            <td>{f(-tot.cuota)}</td>
            <td className={tot.flujo < 0 ? "neg" : undefined}>{f(tot.flujo)}</td>
          </tr>
        </tbody>
      </table>
      {compacto && <p className="pc-nota">{avisoRedondeo(moneda)}</p>}
    </>
  );
}

export function Indicador({ nombre, formula, cuenta, resultado, neg }: { nombre: ReactNode; formula: ReactNode; cuenta: ReactNode | ReactNode[]; resultado: ReactNode; neg?: boolean }) {
  const lineas = Array.isArray(cuenta) ? cuenta : [cuenta];
  return (
    <div className="pc-ind">
      <div className="pc-ind-n">{nombre}</div>
      <div className="pc-ind-f">{formula}</div>
      <div className="pc-ind-der">
        <div className="pc-ind-c">
          {lineas.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className={`pc-ind-r${neg ? " neg" : ""}`}>= {resultado}</div>
      </div>
    </div>
  );
}

export function RemiteResultado({ anios, equity, conSobreprecio, moneda, valorUF, onVerResultado }: { anios: number; equity: number; conSobreprecio: boolean; moneda: Moneda; valorUF: number; onVerResultado?: () => void }) {
  return (
    <div className="pc-remite">
      <div className="k">Si vendes el año {anios}, te queda</div>
      <div className="v">{montoCuenta(equity, moneda, valorUF)}</div>
      <div className="s">{conSobreprecio ? "valor − sobreprecio de hoy − deuda − comisión" : "valor − deuda − comisión"}. Es la cifra que usa la TIR.</div>
      {onVerResultado && (
        <button type="button" className="lnk" onClick={onVerResultado}>
          El desglose, en «Tu resultado a {anios} años» →
        </button>
      )}
    </div>
  );
}
