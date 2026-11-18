// Mientras se abren los detalles de un depto (etapa 2, 18-nov-2026, pedido de Fabrizio): la ruta de la guía arma el informe y
// tarda bastante más que un par de segundos (≈ 10 s), así que la pantalla lo dice con una capa encima, no solo con el texto del
// enlace. Se queda hasta que el informe carga (la navegación la reemplaza); si falla, quien la muestra la saca.
export function CargandoDetalles() {
  return (
    <div className="iv2-cargando-capa" data-inv2="cargando-detalles">
      <div className="iv2-cargando-caja" role="status" aria-live="polite">
        <p className="iv2-cargando-titulo">Abriendo los detalles del depto</p>
        <p className="iv2-cargando-texto">Franco los está preparando. Toma unos segundos.</p>
        <div className="iv2-cargando-barra" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
