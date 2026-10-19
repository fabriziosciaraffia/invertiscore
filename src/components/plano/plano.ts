// ─────────────────────────────────────────────────────────────────────────────
// LAS PANTALLAS PLANAS (19-oct-2026, decisión de Fabrizio): la compra, la vuelta de Flow, entrar y el código, en el
// diseño actual de /pricing y /cuenta — sin tarjeta ni sombra, Inter en todo, serif solo en el título, campos de 48 px y
// botones de píldora en tinta, tokens --franco-*. Las clases viven acá para que todas esas pantallas se vean iguales.
// Lo fija el tier COMPRA.
// ─────────────────────────────────────────────────────────────────────────────

export const UI_PLANO = "var(--font-ui), Inter, 'Helvetica Neue', Arial, sans-serif";

export const PLANO = {
  /** La columna de la pantalla, angosta y arriba (en el teléfono, sin centrar en vertical). */
  main: "mx-auto w-full max-w-[440px] flex-1 px-4 pb-16 pt-8 sm:pt-14",
  titulo: "m-0 font-heading text-[28px] font-bold leading-[1.12] tracking-[-0.015em] text-[var(--franco-text)] sm:text-[32px]",
  bajada: "mt-2 text-[15px] leading-[1.5] text-[var(--franco-text-secondary)]",
  /** Lo que sigue al encabezado, separado por una línea fina (como las secciones de /cuenta). */
  seccion: "mt-6 border-t border-[var(--franco-border)] pt-6",
  label: "mb-1.5 block text-[14px] font-semibold text-[var(--franco-text)]",
  // 16 px en el campo: menos, y el iPhone acerca la página al tocarlo.
  campo: "h-12 w-full rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 text-[16px] text-[var(--franco-text)] placeholder:text-[var(--franco-text-muted)] focus:border-[var(--franco-text)] focus:outline-none read-only:bg-transparent read-only:text-[var(--franco-text-secondary)]",
  principal: "flex h-12 w-full items-center justify-center rounded-full bg-[var(--franco-text)] px-6 text-[15px] font-semibold text-[var(--franco-bg)] no-underline transition-opacity hover:opacity-90 disabled:opacity-60",
  secundario: "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-[var(--franco-border)] bg-transparent px-6 text-[15px] font-semibold text-[var(--franco-text)] no-underline transition-colors hover:border-[var(--franco-text)] disabled:opacity-60",
  enlace: "font-semibold text-[var(--franco-text)] underline underline-offset-2",
  nota: "text-[13px] leading-[1.5] text-[var(--franco-text-secondary)]",
  error: "text-[14px] leading-[1.45] text-[var(--signal-red)]",
  /** La «G» (components/entrar/IconoGoogle, sin tamaño propio). */
  iconoGoogle: "inline-flex h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4",
} as const;
