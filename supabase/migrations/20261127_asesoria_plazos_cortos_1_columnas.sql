-- ─────────────────────────────────────────────────────────────────────────────
-- LA ASESORÍA · EL PLAZO SEGÚN LA EDAD · PARTE 1 DE 2: LAS COLUMNAS (27-nov-2026). PARA QUE LO APLIQUE CLAUDE; no lo aplica el agente.
--
-- MEDIDO el 27-nov-2026 con la sonda del motor: de 200 Comprar usados a 30 años (pie 20 %) siguen siendo Comprar 138 a 25 años,
-- 68 a 20 y 23 a 15 (Claude lo comprobó a 25 en la base completa: 3.429 de 4.814, 71 %). El flujo ajustado por la cuota no
-- alcanza: hace falta el veredicto de cada plazo.
--
-- avisos_evaluados suma el mismo aviso con pie 20 % a 20 y a 15 años (veredicto, puntaje y flujo), como las columnas _25. Las
-- escribe el cron al evaluar (fila-evaluada.ts) y el relleno de una vez (scripts/rellenar-plazos-cortos.ts) con
-- rellenar_plazos_cortos, que escribe SOLO esas 6 columnas y no pisa una fila que el cron reevaluó entretanto (compara evaluado_at).
-- La tabla no tiene triggers (verificado en pg_trigger el 27-nov-2026). Va ANTES del relleno y antes de mergear: el cron ya las escribe.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.avisos_evaluados
  add column if not exists veredicto_20_20 text,
  add column if not exists score_20_20 integer,
  add column if not exists flujo_20_20 integer,
  add column if not exists veredicto_20_15 text,
  add column if not exists score_20_15 integer,
  add column if not exists flujo_20_15 integer;

create or replace function public.rellenar_plazos_cortos(filas jsonb)
returns integer
language sql
set search_path = public, pg_temp
as $$
  with f as (
    select * from jsonb_to_recordset(filas) as x(
      aviso_id uuid, evaluado_at timestamptz,
      veredicto_20_20 text, score_20_20 integer, flujo_20_20 integer,
      veredicto_20_15 text, score_20_15 integer, flujo_20_15 integer
    )
  ), u as (
    update avisos_evaluados ae set
      veredicto_20_20 = f.veredicto_20_20, score_20_20 = f.score_20_20, flujo_20_20 = f.flujo_20_20,
      veredicto_20_15 = f.veredicto_20_15, score_20_15 = f.score_20_15, flujo_20_15 = f.flujo_20_15
    from f
    where ae.aviso_id = f.aviso_id and ae.evaluado_at = f.evaluado_at
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function public.rellenar_plazos_cortos(jsonb) from public, anon, authenticated;
