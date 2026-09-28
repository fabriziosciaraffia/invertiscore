// Sentry en el navegador, cargado CUANDO LA PÁGINA ESTÁ QUIETA (28-sep-2026, rendimiento de la
// landing): el SDK con su tracing iba en el primer paquete de JavaScript de todas las páginas
// (chunk compartido de ~100 kB gz) antes del titular. Ahora entra por `import()` tras `load` y el
// primer rato ocioso. Lo que falle antes de eso no se pierde: se guarda y se manda al inicializar.
import { cuandoLaPaginaEsteQuieta } from "./src/lib/pagina-quieta";

const pendientes: unknown[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => { pendientes.push(e.error ?? e.message); });
  window.addEventListener("unhandledrejection", (e) => { pendientes.push(e.reason); });

  cuandoLaPaginaEsteQuieta(() => {
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.init({
          dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          enabled: process.env.NODE_ENV === "production",
          tracesSampleRate: 0.1,
          ignoreErrors: [
            "ResizeObserver loop limit exceeded",
            "ResizeObserver loop completed with undelivered notifications",
            "Non-Error promise rejection captured",
            /Loading chunk \d+ failed/,
            /A listener indicated an asynchronous response/,
            // Scripts inyectados por in-app browsers de Meta (Instagram/Facebook)
            /Java object is gone/,
            /invoking postMessage/,
            /window\.webkit\.messageHandlers/,
            // Web Locks API de @supabase/auth-js — benigno (multi-pestaña o refresh concurrente)
            /Lock was stolen by another request/,
            /Lock broken by another request/,
          ],
          denyUrls: [
            /navigation_performance_logger/,
            /iabjs:\/\//,
          ],
          beforeSend(event) {
            if (typeof navigator !== "undefined" && /bot|crawler|spider/i.test(navigator.userAgent)) {
              return null;
            }
            return event;
          },
        });
        for (const err of pendientes.splice(0)) Sentry.captureException(err);
      })
      .catch(() => { /* sin Sentry la página sigue */ });
  });
}
