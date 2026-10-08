// La marca del final de los capítulos (08-oct-2026): va justo después de «Detalle de la inversión»,
// cuyo último capítulo es «Tu resultado a 10 años». Cuando entra en pantalla, el ticket del pack
// cuenta 8 segundos (`disparo-ticket.ts`), y desde ahí hacia abajo es la zona de la pestaña.
export function FinCapitulos() {
  return <div data-lqs="fin-capitulos" aria-hidden="true" style={{ height: 1 }} />;
}
