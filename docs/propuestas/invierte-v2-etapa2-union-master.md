# Invierte con Franco, etapa 2 · plan de unión a master

Rama `claude/invierte-v2-etapa2`. Nada sube a master sin avisarle antes a Fabrizio los commits exactos que van (regla del 18-nov-2026).

## Lo que ya está aplicado en la base (por Fabrizio o por Claude)

- `invierte_v2_etapa2` y la entrega 2 (`_uf_diaria`, `_resto`).
- `invierte_v2_nombres_apellidos` (nombres y apellidos en la orden).
- `invierte_v2_alternativas_cercanas`: la función `invierte_alternativas` y la columna `inv_perfiles.donde`.
- `publicacion_detalle` (fotos, texto y dirección de cada publicación), vacía, con RLS y solo para el servidor.
- `lecturas_franco` (la tabla de «Lo que ve Franco»), aplicada por Claude el 20-nov-2026.

## Pendiente de aplicar ANTES de unir (y antes de que Fabrizio repita el recorrido en el preview)

- `supabase/migrations/20261125_lecturas_invierte_origenes.sql`: la bitácora del carril acepta los orígenes `firma` y `resultado` (las lecturas al firmar y al mostrarse el resultado, decisión de Fabrizio del 20-nov-2026). No toca filas. Sin él, esas lecturas se anotan como `abrir` (resguardo del código para que el tope de 60 por hora las cuente igual).

## El MISMO DÍA de la unión, después del push a master

1. **Aplicar `supabase/migrations/20261123_relleno_detalle_invierte.sql`** (el relleno de Decodo lee primero los deptos de Invierte sin fotos). Revisado por Claude contra la función vigente. **No antes**: en producción el relleno corre con el código de master, que hasta la unión no guarda las fotos, así que leería sin guardar nada y gastaría su cupo (decisión de Fabrizio, 19-nov-2026).
2. La línea de CLAUDE.md de la «Tercera excepción» (aprobada el 20-nov-2026: lecturas al firmar y al mostrarse el resultado) va en el mismo aviso de commits.
3. Mirar el deploy de producción hasta READY y correr el golden QUICK sobre master en un árbol limpio.
4. Al día siguiente: revisar que `publicacion_detalle` se llene (relleno + carril) y el costo de `lecturas_franco` (tope de 60 por hora).
