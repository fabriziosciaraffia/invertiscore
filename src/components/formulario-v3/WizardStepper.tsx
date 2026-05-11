"use client";

const STEPS = [
  { num: 1, label: "Propiedad" },
  { num: 2, label: "Financiamiento" },
  { num: 3, label: "Operacional" },
  { num: 4, label: "Ajuste fino" },
] as const;

export function WizardStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {STEPS.map((s, i) => {
          const active = s.num === current;
          const done = s.num < current;
          // Done state: Ink secundario (no verde --franco-v-buy).
          //  Sistema es binario Capa 1: solo Ink + Signal Red, sin verde.
          const badgeClass = active
            ? "bg-signal-red text-white"
            : done
              ? "bg-[var(--franco-text-secondary)] text-[var(--franco-bg)]"
              : "border border-[var(--franco-text-secondary)] text-[var(--franco-text-secondary)]";
          const labelClass = active
            ? "text-signal-red font-medium"
            : "text-[var(--franco-text-secondary)]";
          return (
            <div key={s.num} className="flex items-center gap-3 flex-1 last:flex-none">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold shrink-0 ${badgeClass}`}
                >
                  {done ? "✓" : s.num}
                </span>
                <span className={`font-body text-[12px] hidden sm:inline truncate ${labelClass}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 min-w-[16px] bg-[var(--franco-border)]"
                  style={{ height: "0.5px" }}
                />
              )}
            </div>
          );
        })}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] ml-3 shrink-0">
        Paso {current} de {STEPS.length}
      </span>
    </div>
  );
}
