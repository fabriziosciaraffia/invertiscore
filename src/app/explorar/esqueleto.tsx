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
// DESDE EL 25-NOV-2026 (el mapa con todos los deptos, lámina 5): arriba el selector con «Usados» y «Filtros»; sobre el mapa, la tarjeta
// del contador calculando, con sus tres chips y «Ver lista». Ya no hay «Ver solo ✓ Comprar», ni la ⓘ en la barra, ni barra de abajo.
// DESDE EL 26-NOV-2026 (lámina 5d): «¿Cómo se calcula?» volvió a la barra y «Ver lista» flota abajo al centro, fuera de la tarjeta.
// ─────────────────────────────────────────────────────────────────────────────
import { ChipVeredictoTokens } from "@/components/analysis/shared/ChipVeredicto";
import { COMO_SE_CALCULA, PORTAL_COPY } from "@/lib/explorar/portal";
import { PROYECTOS_VISIBLE, SELECTOR_COPY } from "@/lib/explorar/mapa-todos";
import { Contador } from "./contador";
import "./explorar.css";

export function EsqueletoExplorar() {
  return (
    <div className="ex" data-explorar="esqueleto" aria-busy="true">
      <ChipVeredictoTokens />
      <div className="ex-barra" aria-hidden="true">
        <span className="ex-selector" data-una-opcion={PROYECTOS_VISIBLE ? undefined : "1"}><span className="ex-selector-op" data-on="1">{SELECTOR_COPY.usados}</span></span>
        <span className="ex-boton">{PORTAL_COPY.filtros}</span>
        <span className="ex-como2"><span className="ex-como2-t">{COMO_SE_CALCULA.enlace}</span></span>
      </div>
      <div className="ex-cuerpo">
        <div className="ex-mapa-wrap" data-mapa="cargando">
          <Contador conteo={null} ocultar={[]} calculando={PORTAL_COPY.calculando} />
          <span className="ex-ver-lista">{PORTAL_COPY.verLista}</span>
        </div>
      </div>
    </div>
  );
}
