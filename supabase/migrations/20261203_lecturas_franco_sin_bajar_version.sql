-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE VE FRANCO: UNA VERSIÓN MENOR NO PISA A UNA MAYOR (24-nov-2026; pedido de Fabrizio). PARA QUE LO APLIQUE FABRIZIO; no lo aplica el
-- agente. Solo agrega una función y un trigger: no cambia filas.
--
-- Producción (master, VERSION_LECTURA 13) y el preview de la rama (14) comparten la base. Sin esto, producción ve una lectura v14 como
-- vieja, la marca «generando» con versión 13, llama al modelo (se paga) y la pisa; el preview la vuelve a escribir en 14 (se paga otra vez).
-- Con el trigger, la marca de producción falla antes de llamar al modelo (lecturaDe › `if (marca.error) return { estado: "error" }`),
-- así que no se paga, y la lectura v14 queda intacta. Mientras tanto, producción no muestra «Lo que ve Franco» de esos deptos (lee solo la
-- 13); con el merge, todo queda en 14. Una versión nueva más alta sigue escribiendo como siempre.
--
-- Verificado el 24-nov-2026 con una tabla temporal y la misma función en pg_temp: el upsert de la 13 sobre la 14 falla con
-- «la versión 13 no pisa la 14» y la fila queda «lista v14»; una actualización sin bajar la versión pasa. No es una función con parámetros
-- que filtre tablas grandes (regla del 02-nov-2026): es un trigger fila a fila.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.lecturas_franco_sin_bajar_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.version is not null and old.version is not null and new.version < old.version then
    raise exception 'lecturas_franco: la versión % no pisa la %', new.version, old.version using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.lecturas_franco_sin_bajar_version() from public, anon, authenticated;

drop trigger if exists lecturas_franco_sin_bajar_version on public.lecturas_franco;
create trigger lecturas_franco_sin_bajar_version
  before update of version on public.lecturas_franco
  for each row execute function public.lecturas_franco_sin_bajar_version();
