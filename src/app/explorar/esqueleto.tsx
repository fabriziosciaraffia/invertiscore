// ─────────────────────────────────────────────────────────────────────────────
// EL ESQUELETO DE EXPLORAR (28-oct-2026, medido en producción): lo que el servidor manda APENAS valida la sesión, mientras
// lee la cuenta (perfil, saldo, guardados, informes, el plan) y el número. Es la misma pantalla —la fila de arriba con
// «Filtros» y «¿Cómo se calcula?», el mapa quieto y la barra de abajo— sin nada que tocar
// todavía. Sin él, el HTML del mapa quieto (el LCP del teléfono) esperaba esos datos: 1,3 s de «load delay» y una mediana de
// 2,53 s en Lighthouse (cinco corridas con sesión). El mapa quieto NO va acá: es una capa única de la página (page.tsx), que el
// esqueleto y el cliente dejan ver. Desde el 30-oct-2026, sin la tarjeta del número (recorrido real de Fabrizio).
// Desde el 03-nov-2026 (la pasada real), las dos barras de hoy con las clases del cliente: arriba «Filtros», «Ver solo [✓ Comprar]»
// apagado y el botón de «¿Cómo se calcula?» (texto en el PC, redondo en el teléfono); abajo la misma barra en los dos tamaños, sin
// la píldora negra del PC. Lo fija el tier EXPLORAR-PASADA §8.
// ─────────────────────────────────────────────────────────────────────────────
import { ChipVeredicto, ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import { COMO_SE_CALCULA, PORTAL_COPY } from "@/lib/explorar/portal";
import { NEGOCIAR_COPY } from "@/lib/explorar/capa-negociar";
import "./explorar.css";

export function EsqueletoExplorar() {
  return (
    <div className="ex" data-explorar="esqueleto" aria-busy="true">
      <ChipVeredictoTokens />
      <div className="ex-barra" aria-hidden="true">
        <span className="ex-boton"><span>☰</span> {PORTAL_COPY.filtros}</span>
        <span className="ex-chip-neg">
          <span className="ex-chip-neg-t">{NEGOCIAR_COPY.soloComprar} <ChipVeredicto v="COMPRAR" /></span>
          <span className="ex-sw" />
        </span>
        <span className="ex-como">
          <span className="ex-como-glifo">ⓘ</span>
          <span className="ex-como-i">i</span>
          <span className="ex-como-t ex-como-t-pc">{COMO_SE_CALCULA.enlace}</span>
        </span>
      </div>
      <div className="ex-cuerpo">
        <div className="ex-mapa-wrap" data-mapa="cargando">
          <div className="ex-hoja" aria-hidden="true">
            <span className="ex-asa" />
            <span className="ex-hoja-cuentas"><span className="ex-hoja-t">{PORTAL_COPY.calculando}</span></span>
            <span className="ex-hoja-ver">{PORTAL_COPY.verLista}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
