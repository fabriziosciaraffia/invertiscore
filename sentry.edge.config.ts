import * as Sentry from "@sentry/nextjs";
// La asesoría (27-nov-2026): la renta, el pie, las deudas y el aporte no viajan en un error (sentry-limpieza.ts).
import { limpiarEventoSentry } from "./src/lib/asesoria/sentry-limpieza";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  beforeSend: (event) => limpiarEventoSentry(event),
});
