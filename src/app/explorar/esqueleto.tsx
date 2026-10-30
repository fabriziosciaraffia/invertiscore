// ─────────────────────────────────────────────────────────────────────────────
// EL ESQUELETO DE EXPLORAR (28-oct-2026, medido en producción): lo que el servidor manda APENAS valida la sesión, mientras
// lee la cuenta (perfil, saldo, guardados, informes, el plan) y el número. Es la misma pantalla —la fila de arriba con
// «Filtros» y «¿Cómo se calcula?», el mapa quieto y la barra de abajo (en el PC, la píldora «Ver lista»)— sin nada que tocar
// todavía. Sin él, el HTML del mapa quieto (el LCP del teléfono) esperaba esos datos: 1,3 s de «load delay» y una mediana de
// 2,53 s en Lighthouse (cinco corridas con sesión). El mapa quieto NO va acá: es una capa única de la página (page.tsx), que el
// esqueleto y el cliente dejan ver. Desde el 30-oct-2026, sin la tarjeta del número (recorrido real de Fabrizio).
// ─────────────────────────────────────────────────────────────────────────────
import { COMO_SE_CALCULA, PORTAL_COPY } from "@/lib/explorar/portal";
import "./explorar.css";

export function EsqueletoExplorar() {
  return (
    <div className="ex" data-explorar="esqueleto" aria-busy="true">
      <div className="ex-barra" aria-hidden="true">
        <span className="ex-boton"><span>☰</span> {PORTAL_COPY.filtros}</span>
        <span className="ex-como"><span className="ex-como-i">ⓘ</span> {COMO_SE_CALCULA.enlace}</span>
      </div>
      <div className="ex-cuerpo">
        <div className="ex-mapa-wrap" data-mapa="cargando">
          <div className="ex-hoja" aria-hidden="true">
            <span className="ex-asa" />
            <span className="ex-hoja-fila"><span className="ex-hoja-t">{PORTAL_COPY.calculando}</span><span className="ex-hoja-ver">{PORTAL_COPY.verLista}</span></span>
          </div>
          <span className="ex-pildora-lista" aria-hidden="true">{PORTAL_COPY.verLista} · {PORTAL_COPY.calculando}</span>
        </div>
      </div>
    </div>
  );
}
