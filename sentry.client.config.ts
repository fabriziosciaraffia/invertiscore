import * as Sentry from "@sentry/nextjs";

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
