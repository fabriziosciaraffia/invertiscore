-- search_path fijo en las 9 funciones que el advisor de seguridad marca como «role mutable search_path»
-- (30-sep-2026). Todas son SECURITY INVOKER y solo usan objetos de public (analisis, las funciones de
-- PostGIS, now()), así que fijarlo en public no cambia qué hacen: impide que un search_path de sesión
-- les haga resolver otro objeto con el mismo nombre. pg_temp al final, como recomienda Postgres.
alter function public.franco_jsonb_num(j jsonb) set search_path = public, pg_temp;
alter function public.franco_normalize_verdict(raw text) set search_path = public, pg_temp;
alter function public.marcar_informe_visible(p_analysis_id uuid) set search_path = public, pg_temp;
alter function public.properties_within_radius(center_lat double precision, center_lng double precision, radius_meters integer, prop_type text, prop_dorms integer, prop_comuna text, prop_condicion text) set search_path = public, pg_temp;
alter function public.registrar_pipeline_timing(p_analysis_id uuid, p_submit jsonb, p_generacion jsonb) set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.sync_edificios_str_geog() set search_path = public, pg_temp;
alter function public.update_location() set search_path = public, pg_temp;
alter function public.update_updated_at_edificios_str() set search_path = public, pg_temp;
