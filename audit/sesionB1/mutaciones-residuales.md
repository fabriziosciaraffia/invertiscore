# Sesión B1 — Búsqueda de mutaciones residuales adicionales

**Patrón buscado:** `input.X = Y` (asignación directa al objeto input dentro de funciones puras de cálculo) en `src/`.

**Resultado:** sin coincidencias.

```bash
# Búsquedas ejecutadas
grep -rnE 'input\.[a-zA-Z]+ *= ' src/
grep -rnE '(input|inputData|input_data)\.[a-zA-Z]+ *=[^=]' src/
grep -rnE 'input\.\w+\s*[+\-*/]?=\s*[^=]' src/
```

Las únicas mutaciones de `input` que existían en `src/lib/` eran las cerradas en Sesión A (`input.provisionMantencion`) y las cerradas en Sesión B1 (`input.contribuciones`, `input.gastos`).

## Otros patrones de impureza ya cerrados

- `setUFValue` (módulo-level mutable `UF_CLP`): cerrado en Sesión A residual-2 (commit `4c343be`). Hoy `ufClp` se pasa explícitamente como parámetro.
- `MutableSimulación` (clon de `runFullAnalysis`): cerrado en Sesión A residual-2-fix (commit `58498e2`). Hoy delega a `calcProjections` parametrizable.

## Conclusión

Ningún hallazgo nuevo. El motor (`src/lib/analysis.ts`) y sus consumidores quedan funcionales puros respecto al `input` recibido.
