"use client";

import type { AlternativaComunas } from "@/lib/alternativa-comunas";

/**
 * EL PORQUÉ DE LA ALTERNATIVA DE COMUNAS (contrato §5), en el pop-up.
 *
 * La línea de la card nombra dos comunas y NADA MÁS: un número al lado del nombre
 * invita a compararlo con el depto que el lector ya descartó, y esa no es la
 * pregunta. Acá sí van las cifras, porque acá el lector vino a ver qué se probó.
 *
 * Se muestran TODAS las que cruzan, no solo las dos nombradas: la línea recomienda,
 * la tabla rinde cuentas. Y cada fila declara con cuántos avisos se midió — sin el
 * n, «en Macul convendría» es una afirmación sin respaldo a la vista.
 */
export function DetalleAlternativaComunas({
  alternativa,
  currency,
  valorUF,
}: {
  alternativa: AlternativaComunas | null;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  if (!alternativa || alternativa.todas.length === 0) return null;

  const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
  const precio = (uf: number) => (currency === "UF" ? `UF ${miles(uf)}` : `$${miles(uf * valorUF)}`);

  return (
    <div className="alt-com">
      <p className="alt-com-t">Dónde sí convendría</p>
      <p className="alt-com-l">
        El mismo departamento —tu pie, tu tasa y tu plazo— corrido en las otras comunas,
        con lo que cuesta y lo que renta en cada una. Solo aparecen las que no cuestan
        más de lo que ibas a pagar acá.
      </p>
      <table className="alt-com-tabla">
        <thead>
          <tr>
            <th>Comuna</th>
            <th>Costaría</th>
            <th>Rentaría</th>
            <th>Veredicto</th>
          </tr>
        </thead>
        <tbody>
          {alternativa.todas.map((c) => (
            <tr key={c.comuna}>
              <td>
                {c.comuna}
                <small>
                  {c.nVenta} ventas · {c.nArriendo} arriendos
                </small>
              </td>
              <td>{precio(c.precioUF)}</td>
              <td>${miles(c.arriendoCLP)}</td>
              <td>{c.veredicto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
