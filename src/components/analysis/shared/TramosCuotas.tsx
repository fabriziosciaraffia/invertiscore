"use client";

// ─────────────────────────────────────────────────────────────────────────────
// «Lo que queda cada mes, desde hoy» con el pie en cuotas (02-oct-2026, Fabrizio): los tramos con su nombre
// —«Hasta la entrega» (cuotas sin arriendo), «Cuota del pie + dividendo» (los meses en que se juntan) y
// «Después»—, cada uno con lo que queda al mes y una barra desde el cero; lo que queda bajo el cero, en rojo.
// Se entiende sin leer nada más. El ancho de cada tramo sigue a sus meses («Después» pesa un año), con un
// mínimo para que el rótulo quepa a 390. Todo es HTML: nada de texto dentro de un SVG que se escale.
// Los tramos los arma `tramosCuotas` (obra-nueva.ts) con el dato del motor.
// ─────────────────────────────────────────────────────────────────────────────
import type { TramoCuotas } from "@/lib/obra-nueva";

export function TramosCuotas({ tramos, money }: { tramos: TramoCuotas[]; money: (n: number) => string }) {
  const vals = tramos.map((t) => t.valorCLP);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const rango = max - min || 1;
  // El cero queda donde corresponde: arriba si todo es negativo, abajo si todo es positivo.
  const cero = (max / rango) * 100;
  return (
    <div className="tc-wrap" data-obra-nueva="tramos-cuotas" role="img" aria-label={tramos.map((t) => `${t.nombre}: ${t.valorCLP < 0 ? "−" : "+"}${money(Math.abs(t.valorCLP))} al mes${t.meses ? `, ${t.meses} meses` : ""}`).join(". ")}>
      <div className="tc-fila">
        {tramos.map((t) => {
          const neg = t.valorCLP < 0;
          const alto = (Math.abs(t.valorCLP) / rango) * 100;
          return (
            <div key={t.id} className="tc-col" data-tramo={t.id} style={{ flexGrow: t.meses ?? 12 }}>
              <div className="tc-nom">{t.nombre}</div>
              <div className={`tc-val${neg ? " neg" : ""}`}>
                {neg ? "−" : "+"}{money(Math.abs(t.valorCLP))}<small>/mes</small>
              </div>
              <div className="tc-plot" aria-hidden="true">
                <div className="tc-cero" style={{ top: `${cero}%` }} />
                <div
                  className={`tc-bar${neg ? " neg" : ""}`}
                  style={neg ? { top: `${cero}%`, height: `${alto}%` } : { top: `${cero - alto}%`, height: `${alto}%` }}
                />
              </div>
              <div className="tc-meses">{t.meses ? (t.meses === 1 ? "1 mes" : `${t.meses} meses`) : "en adelante"}</div>
            </div>
          );
        })}
      </div>
      <div className="tc-eje" aria-hidden="true"><span>Hoy</span></div>
    </div>
  );
}
