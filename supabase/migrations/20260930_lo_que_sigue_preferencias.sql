-- «Lo que sigue», segunda entrega (30-sep-2026).
--
-- 1 · Lo que la persona elige en «Estás dentro»: los chips editados (tipología, comuna, modalidad) y
--     «¿Cuándo piensas comprar?». Van en columnas propias y no pisan lo inferido del análisis
--     (`tipologia`, `comuna`, `modalidad` siguen siendo lo que el informe dijo). Opcionales.
alter table public.perfiles_inversion
  add column if not exists pref_tipologia text null,
  add column if not exists pref_comuna text null,
  add column if not exists pref_modalidad text null check (pref_modalidad is null or pref_modalidad in ('ltr', 'str')),
  add column if not exists horizonte_compra text null check (horizonte_compra is null or horizonte_compra in ('ya', 'meses', 'mirando')),
  add column if not exists pref_actualizado_at timestamptz null;

-- 2 · El recordatorio del pack sale UNA vez: el cron reclama la fila (de NULL a fecha, con la
--     condición en el WHERE) antes de enviar. Mismo patrón que `recovery_email_sent_at`.
alter table public.payments
  add column if not exists recordatorio_pack_enviado_at timestamptz null;
