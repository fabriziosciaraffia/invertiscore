"use client";

/**
 * Subject Card mediana — variante STR. Idéntica visualmente al MiniCard LTR
 * (Patrón 2 del design system) pero recibe el `punchline` ya digerido por
 * el orquestador, sin importar tipos LTR (AISection/FullAnalysisResult).
 *
 * Uso desde SubjectCardGridSTR.
 */
export interface MiniCardSTRPunchline {
  value: string;
  sub: string;
  /** "var(--franco-text)" (neutro) | "var(--signal-red)" (criticidad). */
  color: string;
}

export function MiniCardSTR({
  numero,
  label,
  pregunta,
  punchline,
  onClick,
}: {
  /** Numeración mono (skill líneas 254-258), e.g. "02 · RENTABILIDAD". */
  numero: string;
  label: string;
  pregunta: string;
  punchline: MiniCardSTRPunchline;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--franco-card)] border-[0.5px] border-[var(--franco-border)] hover:border-[var(--franco-border-hover)] rounded-[12px] p-[1.125rem] text-left transition-colors duration-200 min-h-[150px] md:min-h-[168px] flex flex-col w-full"
    >
      <p
        className="font-mono text-[10px] uppercase tracking-[1.5px] mb-2 font-medium m-0 text-[var(--franco-text-secondary)]"
      >
        {numero} · {label}
      </p>
      <h3 className="font-heading font-bold text-[18px] leading-[1.3] mb-2 text-[var(--franco-text)] m-0">
        {pregunta}
      </h3>
      <p
        className="font-mono text-[22px] font-bold m-0 mb-1 leading-[1.1]"
        style={{ color: punchline.color }}
      >
        {punchline.value}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)] mb-auto leading-[1.4] m-0">
        {punchline.sub}
      </p>
      <div className="border-t-[0.5px] border-[var(--franco-border)] mt-4 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-secondary)]">
          Leer análisis completo →
        </span>
      </div>
    </button>
  );
}
