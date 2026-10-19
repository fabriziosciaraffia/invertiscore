"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla de error del informe (19-oct-2026; error.tsx de /analisis/[id] y de /analisis/renta-corta/[id]). Un error
// al dibujar el informe —por ejemplo, la conexión del teléfono que se corta a mitad de la navegación (Sentry
// JAVASCRIPT-NEXTJS-1B)— se queda acá, dentro de la app, en vez de subir a global-error y tapar la página entera.
// «Recargar» recarga: con la respuesta del servidor rota, el reinicio de Next vuelve a dibujar lo mismo (y el de
// global-error revienta: JAVASCRIPT-NEXTJS-9). El error se sigue mandando a Sentry, que ya no lo ve por global-error.
// Tier GLOBAL-ERROR §4.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";

export function ErrorInforme({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{ background: "var(--franco-bg)", color: "var(--franco-text)" }}
      data-error-informe
    >
      <FrancoLogo size="lg" href="/" />
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--franco-text)]">No pudimos mostrar este informe</h1>
        <p className="font-body text-[15px] max-w-sm text-[var(--franco-text-secondary)]">
          Puede que se haya cortado la conexión mientras cargaba. El informe está guardado: recarga la página para verlo.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-12 items-center rounded-full px-7 font-body text-[16px] font-semibold text-white"
          style={{ background: "var(--signal-red)" }}
        >
          Recargar
        </button>
        <Link href="/dashboard" className="font-body text-sm text-[var(--franco-text-secondary)] underline underline-offset-4">
          Ir a mis análisis
        </Link>
      </div>
    </main>
  );
}
