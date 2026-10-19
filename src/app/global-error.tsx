"use client";

import { useEffect } from "react";

// «Intentar de nuevo» RECARGA la página (19-oct-2026, Sentry JAVASCRIPT-NEXTJS-9): en Next 14.2 el reinicio que Next le
// pasa a global-error vuelve a montar el router con su caché inicial ya en null y revienta en un `.get`, así que el botón
// nunca sacaba de esta pantalla. Recargar sí (es lo que la persona terminó haciendo a mano). Tier GLOBAL-ERROR.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Sentry entra por `import()` (se carga con la página quieta): acá se pide, no se asume.
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <html>
      <body style={{
        backgroundColor: "var(--franco-bg)",
        color: "var(--franco-text)",
        fontFamily: "IBM Plex Sans, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
        textAlign: "center",
      }}>
        <div>
          <h2 style={{
            fontFamily: "Source Serif 4, Georgia, serif",
            fontSize: "24px",
            marginBottom: "12px",
          }}>
            Algo salió mal
          </h2>
          <p style={{ color: "var(--franco-text-muted)", marginBottom: "20px" }}>
            El error fue registrado automáticamente. Intenta de nuevo.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#C8323C",
              color: "var(--franco-text)",
              border: "none",
              padding: "10px 24px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
