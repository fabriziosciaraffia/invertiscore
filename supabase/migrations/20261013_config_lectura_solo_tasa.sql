-- La tabla `config` deja de leerse entera con la anon key (13-oct-2026).
--
-- La política «Public read config» era `using (true)` para todos los roles: cualquiera con la anon key —que va en
-- el código del navegador— leía la tabla entera directo de Supabase, incluido estado interno
-- (`backfill_toctoc_checkpoint`). Desde el 13-oct-2026 `/api/config` sirve solo la lista cerrada de
-- `src/lib/config-publica.ts`; esta migración cierra el mismo agujero en la base: con anon o authenticated se ve
-- solo `tasa_hipotecaria`, la única clave que se lee con la clave de la sesión (`getConfig`, detrás de
-- `/api/config`). Todos los lectores de las claves internas usan el service role, que no pasa por RLS
-- (verificado el 13-oct-2026: código, scripts, y ninguna función, vista ni regla de la base lee `config`).
--
-- Y los permisos: anon y authenticated tenían TODOS sobre la tabla (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
-- TRIGGER, MAINTAIN). Las escrituras las frenaba la política del service role, pero TRUNCATE no pasa por RLS. Usan
-- solo SELECT: se les quita todo y se les devuelve SELECT, en la misma transacción.
--
-- Si `config-publica.ts` agrega una clave a la lista, va con una migración que la agregue acá (lo exige el tier
-- CONFIG-PUBLICA §5).

alter policy "Public read config" on public.config using (key = 'tasa_hipotecaria');

revoke all on table public.config from anon, authenticated;
grant select on table public.config to anon, authenticated;
