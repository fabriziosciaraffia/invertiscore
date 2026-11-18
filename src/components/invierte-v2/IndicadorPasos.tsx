// El indicador de pasos del flujo (quinta entrega, 18-nov-2026; láminas 1.2 y 2.1): una barra corta de dos tramos y «Paso N de 2 ·
// …», arriba del contenido, IGUAL en el contacto y en la firma, en el celular y en el PC. Sin "use client": no tiene estado.
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";

export function IndicadorPasos({ paso }: { paso: 1 | 2 }) {
  const P = FLUJO_COPY.pasos;
  const texto = paso === 1 ? P.contacto : P.firma;
  return (
    <div className="iv2-ind" data-inv2="indicador" data-paso={paso}>
      <div className="iv2-ind-barra" aria-hidden="true">
        {Array.from({ length: P.total }, (_, i) => <span key={i} data-hecho={i < paso ? "1" : undefined} />)}
      </div>
      <span className="iv2-ind-t">{texto}</span>
    </div>
  );
}
