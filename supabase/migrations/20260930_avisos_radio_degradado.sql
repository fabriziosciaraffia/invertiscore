-- La lectura del radio que falla aun después de reintentar queda registrada en la fila evaluada
-- (30-sep-2026). Un corte de red dejaba el radio como vacío y la sugerencia caía a la referencia de la
-- comuna en silencio (Sentry JAVASCRIPT-NEXTJS-W/-Q). `lecturas_radio_fallidas` suma las fallas de las dos
-- sugerencias (arriendo y venta); `radio_degradado` = alguna de las dos cayó fuera del radio POR la falla.
-- El cron evaluar-avisos las cuenta como falla parcial. Aditiva: default false/0 para las filas existentes.
alter table public.avisos_evaluados
  add column if not exists lecturas_radio_fallidas integer not null default 0,
  add column if not exists radio_degradado boolean not null default false;
