// El chip sobre el mapa del wizard (09-oct-2026): mientras carga, un indicador giratorio a la izquierda de
// «Buscando comparables cerca…»; si el pedido falla o pasa de 10 s, «No pudimos cargar los comparables.» con
// «Reintentar»; con los comparables, el conteo (`children`). La etiqueta del mapa no recibe clics
// (pointer-events-none): el botón los habilita para sí. Tier CHIP-COMPARABLES.
import type { ReactNode } from "react";
import { CHIP_COMPARABLES, type EstadoChipComparables } from "./pedirSugerencias";

export function ChipComparables({ estado, onReintentar, children }: {
  estado: EstadoChipComparables;
  onReintentar: () => void;
  children?: ReactNode;
}) {
  if (estado === "buscando") {
    return (
      <span className="wz-chip-fila"><span className="wz-girando" aria-hidden="true" />{CHIP_COMPARABLES.buscando}</span>
    );
  }
  if (estado === "error") {
    return (
      <span className="wz-chip-fila">
        {CHIP_COMPARABLES.error}{" "}
        <button type="button" className="wz-reintentar pointer-events-auto" onClick={onReintentar}>{CHIP_COMPARABLES.reintentar}</button>
      </span>
    );
  }
  return <>{children}</>;
}
