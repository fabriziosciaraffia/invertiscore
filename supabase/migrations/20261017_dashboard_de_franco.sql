-- ═════════════════════════════════════════════════════════════════════════════
-- EL ARCHIVO DISTINGUE EL ORIGEN (17-oct-2026, decisión de Fabrizio)
--
-- El dashboard marca «Franco» los informes que salieron de un aviso —la selección semanal, el aviso inmediato o la guía
-- del pack: los que llevan `input_data.origenAviso.avisoId`— y filtra «De Franco» / «Míos» con sus conteos. Para que el
-- filtro y los conteos los haga Postgres (y no una lista de ids en la URL), la vista suma UNA columna, `de_franco`, al
-- FINAL: `create or replace view` solo admite columnas nuevas después de las existentes, y así todo lo que hoy lee la
-- vista (`select *`, la RPC dashboard_stats) sigue igual.
--
-- La definición es la del catálogo al 17-oct-2026 (pg_get_viewdef), sin otro cambio. Se mantiene
-- `security_invoker = true`: la vista respeta la RLS de quien la consulta. Los grants no se tocan (el objeto es el mismo).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace view public.analisis_dashboard
with (security_invoker = true)
as
select id,
    user_id,
    nombre,
    direccion,
    comuna,
    tipo_analisis,
    ambas_group_id,
    ambas_role,
    dormitorios,
    banos,
    superficie,
    precio,
    score,
    created_at,
    is_premium,
    pending_payment,
    score_efectivo,
    flujo,
    cap_rate,
    multiplicador,
    veredicto,
    veredicto_norm,
    es_unidad,
    bool_or(veredicto_norm = 'COMPRAR'::text) over w as u_comprar,
    bool_or(veredicto_norm = 'AJUSTA SUPUESTOS'::text) over w as u_ajusta,
    bool_or(veredicto_norm = 'BUSCAR OTRA'::text) over w as u_buscar,
    de_franco
   from ( select a.id,
            a.user_id,
            a.nombre,
            a.direccion,
            a.comuna,
            a.tipo_analisis,
            a.ambas_group_id,
            a.ambas_role,
            a.dormitorios,
            a.banos,
            a.superficie,
            a.precio,
            a.score,
            a.created_at,
            a.is_premium,
            a.pending_payment,
                case
                    when a.tipo_analisis = 'short-term'::text then coalesce(franco_jsonb_num((a.results -> 'francoScore'::text) -> 'score'::text)::integer, a.score)
                    else a.score
                end as score_efectivo,
                case
                    when a.tipo_analisis = 'short-term'::text then coalesce(franco_jsonb_num(((a.results -> 'escenarios'::text) -> 'base'::text) -> 'flujoCajaMensual'::text), 0::numeric)
                    when jsonb_typeof(a.results -> 'metrics'::text) = 'object'::text then coalesce(franco_jsonb_num((a.results -> 'metrics'::text) -> 'flujoNetoMensual'::text), 0::numeric)
                    else a.arriendo - a.gastos - a.contribuciones
                end as flujo,
                case
                    when a.tipo_analisis = 'short-term'::text then franco_jsonb_num(((a.results -> 'escenarios'::text) -> 'base'::text) -> 'capRate'::text) * 100::numeric
                    else franco_jsonb_num((a.results -> 'metrics'::text) -> 'capRate'::text)
                end as cap_rate,
            franco_jsonb_num((a.results -> 'exitScenario'::text) -> 'multiplicadorCapital'::text) as multiplicador,
                case
                    when a.tipo_analisis = 'short-term'::text then coalesce((a.results -> 'francoScore'::text) ->> 'veredicto'::text, a.results ->> 'veredicto'::text)
                    else coalesce(a.results ->> 'veredicto'::text, a.results ->> 'francoVerdict'::text, a.results ->> 'engineSignal'::text)
                end as veredicto,
                case
                    when a.tipo_analisis = 'short-term'::text then coalesce(franco_normalize_verdict(coalesce((a.results -> 'francoScore'::text) ->> 'veredicto'::text, a.results ->> 'veredicto'::text)), 'BUSCAR OTRA'::text)
                    else coalesce(franco_normalize_verdict(coalesce(a.results ->> 'veredicto'::text, a.results ->> 'francoVerdict'::text, a.results ->> 'engineSignal'::text)),
                    case
                        when a.score >= 70 then 'COMPRAR'::text
                        when a.score >= 45 then 'AJUSTA SUPUESTOS'::text
                        else 'BUSCAR OTRA'::text
                    end)
                end as veredicto_norm,
            a.ambas_group_id is null or a.ambas_role = 'ltr'::text as es_unidad,
            -- De Franco: salió de un aviso (origenDeInforme en src/lib/guia/seleccion-casa.ts pide lo mismo: avisoId string).
            coalesce(jsonb_typeof((a.input_data -> 'origenAviso'::text) -> 'avisoId'::text) = 'string'::text, false) as de_franco
           from analisis a) f
  window w as (partition by user_id, (coalesce(ambas_group_id, id)));
