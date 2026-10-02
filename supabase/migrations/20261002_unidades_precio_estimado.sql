-- Obra nueva sin precio por unidad (02-oct-2026).
--
-- La fuente retiró el GraphQL que traía el precio de cada unidad. La ficha nueva da el rango
-- «desde/hasta» del proyecto y los deptos disponibles con sus m². El pase de unidades guarda para
-- cada depto disponible un precio ESTIMADO (interpolado entre el «desde» y el «hasta» según sus m²)
-- en columnas propias: `precio` sigue siendo el real, con `scraped_at` como su fecha.
--
-- El estimado lo lee SOLO la mediana de venta nueva (comuna-stats.ts › precioVentaNueva), cuando el
-- precio real pasa los 90 días, y el informe dice «referencia estimada». Nunca evalúa una unidad.

alter table public.scraped_properties
  add column if not exists precio_estimado_uf numeric null,
  add column if not exists precio_estimado_at timestamptz null;

-- Las vistas de una corrida, en una llamada: activa, marca de vista, entrega y estimado por unidad.
-- Solo toca unidades de obra nueva (source_id con '#'). Un estimado ausente no borra el anterior:
-- ese envejece solo por su fecha.
create or replace function public.marcar_unidades_vistas(p_filas jsonb, p_marca text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare n integer;
begin
  update scraped_properties s set
    is_active = true,
    seen_pass_id = p_marca,
    fecha_entrega = coalesce(f.fecha_entrega, s.fecha_entrega),
    precio_estimado_uf = coalesce(f.estimado_uf, s.precio_estimado_uf),
    precio_estimado_at = case when f.estimado_uf is not null then now() else s.precio_estimado_at end
  from jsonb_to_recordset(p_filas) as f(id uuid, estimado_uf numeric, fecha_entrega text)
  where s.id = f.id and s.condicion = 'nuevo' and s.source_id like '%#%';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.marcar_unidades_vistas(jsonb, text) from public, anon, authenticated;
grant execute on function public.marcar_unidades_vistas(jsonb, text) to service_role;
