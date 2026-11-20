-- ─────────────────────────────────────────────────────────────────────────────
-- «LO QUE VE FRANCO» · EL REGISTRO DE LO QUE EL SANEADO BORRA (20-nov-2026, decisión de Fabrizio). PARA QUE LO APLIQUE CLAUDE A
-- PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- Cada vez que el saneado borra una línea de una lectura (una cifra de plata o una comparación de precio; o que faltan fotos, si
-- la lectura no las recibió todas), queda en la fila: [{ "campo": "alerta" | "larga" | "corta", "texto": "...", "regla":
-- "precio_uf" | "pesos" | "precio_m2" | "comparacion" | "porcentaje" | "faltan_fotos" }]. Vacío ([]) si no borró nada; NULL en las
-- lecturas de antes de este cambio. Uso interno: la tabla sigue con RLS sin políticas. No toca filas.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lecturas_franco add column if not exists descartes jsonb;
