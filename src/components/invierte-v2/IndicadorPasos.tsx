// El indicador de pasos del flujo (quinta entrega, 18-nov-2026; láminas 1.2 y 2.1): una barra corta de dos tramos y «Paso N de 2 ·
// …», arriba del contenido, IGUAL en el contacto y en la firma, en el celular y en el PC. Sin "use client": no tiene estado.
import { FLUJO_COPY } from "@/lib/invierte-v2/flujo";
import { PERFIL_COPY } from "@/lib/invierte-v2/perfil";

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

/** El mismo indicador en los dos pasos del perfil de inversión (etapa 2, láminas 3.1): «Paso N de 2 · …». */
export function IndicadorPasosPerfil({ paso }: { paso: 1 | 2 }) {
  const texto = paso === 1 ? PERFIL_COPY.paso1 : PERFIL_COPY.paso2;
  return (
    <div className="iv2-ind" data-inv2="indicador" data-paso={paso}>
      <div className="iv2-ind-barra" aria-hidden="true">
        {[0, 1].map((i) => <span key={i} data-hecho={i < paso ? "1" : undefined} />)}
      </div>
      <span className="iv2-ind-t">{texto}</span>
    </div>
  );
}
