-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE CON FRANCO · DOS ORÍGENES NUEVOS EN LA BITÁCORA DEL CARRIL (20-nov-2026, decisión de Fabrizio). PARA QUE LO APLIQUE
-- CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- Las fotos y «Lo que ve Franco» tienen que estar en el resultado, que es donde se decide. Por eso el carril de Invierte lee la
-- publicación también:
--   · 'firma': apenas se firma la orden, la del depto elegido (en segundo plano, sin demorar la firma);
--   · 'resultado': al mostrarse el resultado, la de cada depto que todavía no la tiene leída (la pide la tarjeta de «Lo que ve
--     Franco», que se completa sola).
-- Con el mismo tope de 60 por hora, la misma memoria de 24 horas por depto y el mismo fusible. La regla vigente
-- (lecturas_invierte_origen_check) solo acepta 'elegir', 'abrir' y 'noche': sin este cambio, la anotación de esas lecturas falla y
-- el tope por hora no las cuenta. No toca filas.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lecturas_invierte drop constraint if exists lecturas_invierte_origen_check;
alter table public.lecturas_invierte
  add constraint lecturas_invierte_origen_check check (origen in ('elegir', 'abrir', 'noche', 'firma', 'resultado'));
