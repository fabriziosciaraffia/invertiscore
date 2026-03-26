"use client";

import { InfoTooltip } from "@/components/ui/tooltip";

const tooltips: Record<string, string> = {
  "Rentabilidad Bruta": "Rentabilidad anual bruta: arriendo anual dividido por el precio. No descuenta ningún gasto. Es el número que te muestra el corredor.",
  "Flujo Mensual": "Flujo de caja mensual neto descontando dividendo, gastos comunes, contribuciones, mantención y vacancia.",
  "UF/m²": "Precio por metro cuadrado en UF. Permite comparar el valor relativo con otras propiedades de la zona.",
  "Franco Score": "Puntaje de 1-100 que evalúa 4 dimensiones: Rentabilidad (30%), Flujo de Caja (25%), Plusvalía (25%), Eficiencia de compra (20%)",
};

export function MetricTooltips() {
  return null; // Tooltips are used inline
}

export function MetricLabel({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1">
      {label}
      {tooltips[label] && <InfoTooltip content={tooltips[label]} />}
    </span>
  );
}
