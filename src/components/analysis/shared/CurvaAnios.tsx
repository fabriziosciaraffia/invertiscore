"use client";

/**
 * "Lo que queda cada mes, año por año" — serie ANUAL con signo.
 *
 * Primitiva nueva (16-sep-2026). Ninguna de las que había servía: `CurvaAnual` es de doce
 * MESES, `CurvaPatrimonio` tiene eje de años pero dibuja un área de patrimonio que nunca
 * cruza el cero, y `Bars` toma `pct` de 0 a 100 y no admite negativos. Acá hacen falta las
 * tres cosas juntas: eje de años, línea de cero y color por signo — porque la serie CRUZA
 * el cero en 40 de 252 filas del parque (15,9%).
 *
 * ⛔ EL TEXTO NO VA DENTRO DEL SVG, Y NO ES PREFERENCIA. La primera versión lo puso adentro
 * con un viewBox de 620 y escalado uniforme. Medido en el navegador a 390: el contenedor del
 * capítulo da 305px, o sea escala 0,492, y las etiquetas de 9,5px RENDERIZABAN A 4,7px.
 * Ilegible. Y no se arregla agrandando la fuente: con un viewBox fijo el mismo número que
 * deja el texto legible a 305px lo deja gigante a 640px. Un viewBox no puede servir las dos
 * anchuras con texto de tamaño constante — por eso `CurvaAnual` y `spark` usan
 * `preserveAspectRatio="none"`, que a cambio ESTIRA su texto (ver la memoria
 * `svg-viewbox-escala-el-texto`).
 *
 * Acá el SVG dibuja SOLO geometría —línea de cero, trazo y puntos— y por eso puede usar
 * `preserveAspectRatio="none"` sin costo. Todo el texto es HTML posicionado en porcentajes
 * sobre el mismo sistema de coordenadas, así que mantiene su tamaño a cualquier ancho, es
 * seleccionable y lo lee un lector de pantalla.
 *
 * Las otras dos decisiones:
 *
 * · EL CERO SIEMPRE ESTÁ EN EL DOMINIO (`min(…vals, 0)` / `max(…vals, 0)`). Sin eso una serie
 *   enteramente negativa dibujaría su línea de cero fuera del área y el color por signo
 *   perdería contra qué se lee.
 *
 * · SE ROTULAN TRES VALORES, NO DIEZ: el primero, el último y el primer cambio de signo. El
 *   resto se lee por la forma; diez números sobre una línea se pisan a 390.
 *
 * La geometría sale de una función, no del ojo: en el mockup la primera versión puso la línea
 * de cero «donde se veía bien» (y=118) cuando la serie real la pone en y=109,5, y esos 8px
 * hacían que el año 2 pareciera el doble de arriba del cero de lo que estaba.
 */

/**
 * El dominio vertical de la curva. EL CERO ENTRA SIEMPRE: es contra lo que se lee el color
 * por signo. Acotarlo al rango de los datos —que es lo que haría cualquiera «optimizando»—
 * deja la línea de cero fuera del área en toda serie de un solo signo, y ahí el color deja
 * de significar algo. Exportado para que el gate lo lea en vez de recalcularlo.
 */
export function dominioCurvaAnios(vals: number[]): { min: number; max: number } {
  return { min: Math.min(...vals, 0), max: Math.max(...vals, 0) };
}

export interface PuntoAnio {
  anio: number;
  /** Flujo mensual PROMEDIO de ese año, ya derivado (ver el acta del capítulo II). */
  v: number;
}

export function CurvaAnios({
  puntos,
  fmt,
  ariaLabel,
}: {
  puntos: PuntoAnio[];
  /** Formateador de monto del capítulo (respeta el toggle CLP/UF). */
  fmt: (n: number) => string;
  ariaLabel?: string;
}) {
  if (puntos.length < 2) return null;

  // Sistema de coordenadas del TRAZO. El texto vive fuera y se posiciona en % sobre esto.
  const W = 100;
  const H = 100;
  // El trazo NO usa los 100: deja 20 arriba y 22 abajo para que los rotulos de valor quepan
  // sin pisar nada. Con yBot=92 el rotulo del punto mas bajo caia sobre el eje de anios
  // (cazado en el navegador, a 390, con `santiagoStrUnaFila`).
  const yTop = 20;
  const yBot = 78;

  const { min, max } = dominioCurvaAnios(puntos.map((p) => p.v));
  const span = max - min || 1;
  const y = (v: number) => yBot - ((v - min) / span) * (yBot - yTop);
  const x = (i: number) => (i * W) / (puntos.length - 1);
  const yCero = y(0);

  const signo0 = puntos[0].v >= 0;
  const iCruce = puntos.findIndex((p, i) => i > 0 && p.v >= 0 !== signo0);
  const iUlt = puntos.length - 1;
  const iMed = Math.floor(iUlt / 2);
  const rotulados = [0, iCruce, iUlt].filter((i, k, a) => i >= 0 && a.indexOf(i) === k);

  const aria =
    ariaLabel ??
    `Flujo mensual promedio por año: año ${puntos[0].anio} ${fmt(puntos[0].v)}, ` +
      `año ${puntos[iUlt].anio} ${fmt(puntos[iUlt].v)}`;

  /** Alinea el rótulo para que ni el primero ni el último se salgan del ancho. */
  const anclaje = (i: number) =>
    i === 0 ? { left: "0%", transform: "none" } : i === iUlt ? { left: "100%", transform: "translateX(-100%)" } : { left: `${x(i)}%`, transform: "translateX(-50%)" };

  return (
    <div className="ca-wrap">
      <div className="ca-plot">
        <svg
          className="ca-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={aria}
        >
          <line
            x1="0"
            y1={yCero.toFixed(2)}
            x2={W}
            y2={yCero.toFixed(2)}
            stroke="var(--doc-tx3)"
            strokeWidth="0.4"
            strokeDasharray="1.6 1.6"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="none"
            stroke="var(--doc-tx2, var(--doc-tx))"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            points={puntos.map((p, i) => `${x(i).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ")}
          />
        </svg>

        {/* Los puntos van en HTML: un círculo escalado por `preserveAspectRatio="none"` saldría
            ovalado. Acá son cuadrados con border-radius, redondos a cualquier ancho. */}
        {puntos.map((p, i) => (
          <span
            key={`p${p.anio}`}
            className={`ca-pt${i === 0 || i === iUlt ? " ext" : ""}${p.v < 0 ? " neg" : " pos"}`}
            style={{ left: `${x(i)}%`, top: `${y(p.v)}%` }}
          />
        ))}

        {/* Rótulos de valor: encima del punto si es positivo, debajo si es negativo. */}
        {rotulados.map((i) => (
          <span
            key={`v${puntos[i].anio}`}
            className="ca-val"
            style={{
              ...anclaje(i),
              top: `${y(puntos[i].v)}%`,
              marginTop: puntos[i].v < 0 ? 7 : -19,
            }}
          >
            {fmt(puntos[i].v)}
          </span>
        ))}

        <span className="ca-cero-lbl" style={{ top: `${yCero}%` }}>
          $0
        </span>
      </div>

      {/* Eje de años AL PIE, no colgado de la línea de cero: con una serie toda negativa el
          cero sube al borde de arriba y los años quedarían flotando sobre el gráfico. */}
      <div className="ca-eje">
        {[0, iMed, iUlt]
          .filter((i, k, a) => a.indexOf(i) === k)
          .map((i) => (
            <span key={`a${puntos[i].anio}`} style={anclaje(i)}>
              {i === 0 ? `año ${puntos[i].anio}` : String(puntos[i].anio)}
            </span>
          ))}
      </div>
    </div>
  );
}
