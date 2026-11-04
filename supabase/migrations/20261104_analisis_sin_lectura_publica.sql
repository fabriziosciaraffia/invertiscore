-- 04-nov-2026 · AUDITORÍA DE PROMESAS, PARTE 1 (decisión de Fabrizio): `analisis` deja de leerse con la llave pública.
--
-- La política «Anyone can read analisis» (20260306_analisis_public_read.sql) se pensó para compartir un informe por su
-- enlace, pero con `USING (true)` y el SELECT de `anon` cualquiera con la llave pública del sitio —la que viaja en el
-- navegador— podía LISTAR la tabla entera: nombres, direcciones y cifras de todos los informes. /privacy y el FAQ
-- prometen lo contrario.
--
-- El enlace sigue funcionando: desde el mismo cambio, las páginas y rutas que muestran un informe ajeno o sin sesión
-- (el informe LTR y STR, su metadata, sus documentos y PDF, el comparativo, la zona y el compartido por token) leen la
-- fila con la llave de servicio en el servidor, por su id. Lo que se cierra es leer la tabla desde afuera.
--
-- La vista `analisis_dashboard` es `security_invoker`: hereda el RLS de `analisis`, así que con esto también deja de
-- devolver filas ajenas. Se le quita el SELECT a `anon` por la misma razón.
--
-- Se aplica DESPUÉS de que producción tenga el código que lee con la llave de servicio (si no, el informe compartido
-- se cae entre el deploy y la migración). Vuelta atrás, si hiciera falta:
--   create policy "Anyone can read analisis" on public.analisis for select using (true);
--   grant select on public.analisis, public.analisis_dashboard to anon;
-- Lo fija el tier DATOS-Y-PLATA (lectura anónima real: cero filas).

drop policy if exists "Anyone can read analisis" on public.analisis;

revoke select on public.analisis from anon;
revoke select on public.analisis_dashboard from anon;
