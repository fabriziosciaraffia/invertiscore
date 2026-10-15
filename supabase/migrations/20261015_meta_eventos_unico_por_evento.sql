-- meta_eventos: la marca de «una vez» es por evento + id (15-oct-2026). El primer cobro de un plan manda Purchase y
-- Subscribe con el mismo id (`sub-<id>`). Idempotente: la tabla nueva ya nace así (20261015_medicion_campana.sql).
alter table public.meta_eventos drop constraint if exists meta_eventos_event_id_prueba_key;
do $$ begin
  alter table public.meta_eventos add constraint meta_eventos_evento_event_id_prueba_key unique (evento, event_id, prueba);
exception when duplicate_object then null; end $$;
