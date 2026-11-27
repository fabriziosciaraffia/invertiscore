-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE · LA URGENCIA PUEDE QUEDAR VACÍA (27-nov-2026, cuarta vuelta de la asesoría, decisión de Fabrizio). Quien llega a Invierte
-- desde «Seguir con estos deptos» no contesta «¿Cuándo piensas comprar?» y la urgencia no se inventa: queda vacía (sin respuesta).
-- Solo se quita el NOT NULL de inv_personas.urgencia. La restricción de valores (inv_personas_urgencia_check: este_mes, uno_a_tres,
-- mas_adelante) se queda como está: un NULL la pasa, y cualquier otro valor sigue rechazado.
-- No toca invierte_inscripciones (la inscripción de «Pronto», otro flujo, donde la pregunta se sigue haciendo).
-- Quién lee la columna (verificado en el código el 27-nov-2026): el panel /admin/invierte-v2 (lista y ficha: dicen «Sin respuesta»),
-- la precarga del contacto (un vacío se precarga como sin elegir) y la bitácora y el evento del contacto (llevan null). Ninguna función
-- SQL ni vista la usa.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.inv_personas alter column urgencia drop not null;
