"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{
        backgroundColor: "#0F0F0F",
        color: "#FAFAF8",
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
          <p style={{ color: "#71717A", marginBottom: "20px" }}>
            El error fue registrado automáticamente. Intenta de nuevo.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#C8323C",
              color: "#FAFAF8",
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
