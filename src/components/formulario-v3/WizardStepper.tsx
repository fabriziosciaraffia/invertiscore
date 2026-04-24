"use client";

const STEPS = [
  { num: 1, label: "Propiedad" },
  { num: 2, label: "Financiamiento" },
  { num: 3, label: "Análisis" },
] as const;

export function WizardStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {STEPS.map((s, i) => {
          const active = s.num === current;
          const done = s.num < current;
          return (
            <div key={s.num} className="flex items-center gap-3 flex-1 last:flex-none">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold shrink-0 ${
                    active
                      ? "bg-[#C8323C] text-white"
                      : done
                        ? "bg-[var(--franco-v-buy)] text-[var(--franco-bg)]"
                        : "bg-[var(--franco-card)] border border-[var(--franco-border)] text-[var(--franco-text-muted)]"
                  }`}
                >
                  {done ? "✓" : s.num}
                </span>
                <span
                  className={`font-body text-[12px] hidden sm:inline truncate ${
                    active
                      ? "text-[var(--franco-text)] font-semibold"
                      : "text-[var(--franco-text-muted)]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-[var(--franco-border)]" />
              )}
            </div>
          );
        })}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--franco-text-muted)] ml-3 shrink-0">
        Paso {current} de 3
      </span>
    </div>
  );
}
