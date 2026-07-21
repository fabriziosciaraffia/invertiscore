import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export const metadata = {
  title: "Página no encontrada",
};

// 404 con marca y tema. Server component: hereda el data-theme aplicado
// pre-paint en <html>, así que respeta el tema activo sin JS propio.
// Sólo tokens --franco-* (sin colores hardcodeados).
export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{ background: "var(--franco-bg)", color: "var(--franco-text)" }}
    >
      <FrancoLogo size="lg" href="/" showTagline />

      <div className="flex flex-col items-center gap-3">
        <p className="font-mono uppercase text-[12px] tracking-[0.2em] text-[var(--franco-text-muted)]">
          Error 404
        </p>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--franco-text)]">
          Esta página no existe
        </h1>
        <p className="font-body text-[15px] max-w-sm text-[var(--franco-text-secondary)]">
          El enlace que seguiste no lleva a ninguna parte. Volvé al inicio y
          seguimos.
        </p>
      </div>

      <Link
        href="/"
        className="font-body text-sm px-5 py-3 rounded-lg border border-[var(--franco-border)] bg-[var(--franco-card)] text-[var(--franco-text)] hover:bg-[var(--franco-elevated)] transition-colors"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
