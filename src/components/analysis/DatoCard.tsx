import { InfoTooltip } from "@/components/ui/tooltip";
import type { DatoClave } from "@/lib/types";

/**
 * Tooltips por label. Co-locado con DatoCard porque sólo se consume acá. Si
 * un label nuevo aparece sin entry, el card se renderiza sin tooltip
 * (degradación graceful).
 */
const DATO_TOOLTIPS: Record<string, string> = {
  "Aporte mensual": "Lo que sale de tu bolsillo cada mes porque el arriendo no cubre los costos (dividendo + gastos + contribuciones + mantención).",
  "Te sobra mensual": "Excedente mensual: el arriendo cubre todos los costos y queda saldo a tu favor.",
  "Precio sugerido": "Precio recomendado por Franco para que la inversión tenga sentido financiero. Útil como punto de partida para negociar.",
  "Ventaja": "Diferencia favorable entre el precio que pagas y el valor de mercado del depto en la zona. Compras bajo mercado.",
  "Sobreprecio": "Diferencia desfavorable: estás pagando más que el valor de mercado en la zona.",
  "Precio alineado": "Tu precio de compra coincide con el valor de mercado de la zona (±2% de diferencia).",
};

/**
 * Card de un dato clave del Hero (KPI dominante). Featured (`color === "accent"`)
 * usa surface elevated + border 1.5px Signal Red — se siente elevada respecto
 * a las cards normales. Normal: bg card + border 0.5px transparent.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.1).
 */
export function DatoCard({ dato, currency }: { dato: DatoClave; currency: "CLP" | "UF" }) {
  const isAccent = dato.color === "accent";
  const valor = currency === "CLP" ? dato.valor_clp : dato.valor_uf;

  const colorClass = (
    {
      red: "text-signal-red",
      green: "text-[var(--franco-positive)]",
      neutral: "text-[var(--franco-text)]",
      accent: "text-[var(--franco-text)]",
    } as Record<string, string>
  )[dato.color] || "text-[var(--franco-text)]";

  const borderClass = isAccent
    ? "border-[1.5px] border-signal-red"
    : "border-[0.5px] border-transparent";
  const bgClass = isAccent
    ? "bg-[var(--franco-elevated)]"
    : "bg-[var(--franco-card)]";
  const labelClass = isAccent
    ? "text-signal-red font-medium"
    : "text-[var(--franco-text-secondary)]";

  const tooltip = DATO_TOOLTIPS[dato.label];

  return (
    <div className={`${bgClass} rounded-xl p-4 ${borderClass}`}>
      <p className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[1.5px] mb-1.5 ${labelClass}`}>
        <span>{dato.label}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </p>
      <p className={`font-mono text-[22px] font-semibold m-0 ${colorClass}`}>
        {valor}
      </p>
      {dato.subtexto && (
        dato.isLabel ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] mt-1 m-0">
            {dato.subtexto}
          </p>
        ) : (
          <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1 m-0">
            {dato.subtexto}
          </p>
        )
      )}
    </div>
  );
}
