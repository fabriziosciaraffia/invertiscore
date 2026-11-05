// ─────────────────────────────────────────────────────────────────────────────
// EL CHIP DEL INFORME PROPIO (05-nov-2026, lib/informe-propio.ts): lo que dice la tarjeta de un depto ya analizado en
// Explorar (tarjeta y lista), la selección del dashboard y la primera selección. El chip de la casa (ChipVeredicto) con el
// veredicto y el puntaje de SU informe, «tu informe del 13-oct» y, si la noche hoy da distinto, la línea chica «hoy la noche
// da 82». Nunca el veredicto de la noche como si fuera el suyo. Lo fija el tier TARJETA-ANALIZADA.
// ─────────────────────────────────────────────────────────────────────────────
import { ChipVeredicto } from "@/components/analysis/shared/ChipVeredicto";
import { INFORME_PROPIO_COPY, chipInforme, lineaNoche, type ResumenInforme, type VeredictoNoche } from "@/lib/informe-propio";
import { esVeredicto } from "@/lib/veredicto-etiqueta";

export function ChipInformePropio({ resumen, noche, enColumna = true }: {
  resumen: ResumenInforme;
  /** Lo que da hoy la noche de ese depto: solo para la línea chica, si es distinto. */
  noche?: VeredictoNoche | null;
  /** La línea de la noche debajo (tarjetas) o al lado (filas de lista). */
  enColumna?: boolean;
}) {
  const n = lineaNoche(resumen, noche);
  const v = resumen.veredicto;
  return (
    <span className={`inline-flex min-w-0 ${enColumna ? "flex-col gap-0.5" : "flex-wrap items-baseline gap-x-2"}`} data-informe-propio="chip" aria-label={chipInforme(resumen)}>
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {v && esVeredicto(v) ? (
          <>
            <ChipVeredicto v={v} puntaje={resumen.score} />
            <span className="text-[12px] text-[var(--franco-text-secondary)]" data-informe-propio="fecha">{INFORME_PROPIO_COPY.fecha(resumen)}</span>
          </>
        ) : (
          <span className="text-[12px] font-semibold text-[var(--franco-text)]" data-informe-propio="fecha">{INFORME_PROPIO_COPY.sinVeredicto(resumen)}</span>
        )}
      </span>
      {n && <span className="text-[11px] text-[var(--franco-text-secondary)]" data-informe-propio="noche">{n}</span>}
    </span>
  );
}
