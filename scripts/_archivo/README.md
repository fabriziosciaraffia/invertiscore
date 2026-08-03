# scripts/_archivo — QA y sanity de ramas ya cerradas

Scripts que se escribieron para verificar una rama concreta, cumplieron su
función y quedaron sin consumidor. **No se borraron**: sirven como registro de
cómo se validó cada cosa en su momento, y a veces conviene resucitar uno.

## Por qué están acá

Ninguno lo invoca nadie: no aparecen en `package.json`, no los importa el runner
del golden, no hay CI que los corra y no los menciona `CLAUDE.md`. Además todos
referencian símbolos que el motor **ya no tiene** — por eso `tsc` fallaba sobre
ellos y por eso `tsconfig.scripts.json` excluye esta carpeta del gate de tipos.

## ⚠ Antes de reusar cualquiera de estos

**Están desactualizados y no compilan.** Cada uno lee APIs que cambiaron:

| Símbolo que usan | Qué pasó |
|---|---|
| `setUFValue` | ya no se exporta desde `src/lib/analysis` |
| `gananciaNeta` | renombrado a `equityCLP` (rename honesto, b931831) |
| `engineSignal` · `francoVerdict` | removidos del motor STR en el commit E.2 (2026-05-13); `FrancoScoreSTR` es la única fuente del veredicto |
| firmas de `runAnalysis` y de los builders de hallazgos | cambiaron de aridad |

Si vas a recuperar uno: leelo contra el motor actual primero, arreglá los
símbolos, y recién ahí sacalo de acá. Copiar y correr a ciegas te va a dar
resultados falsos o un error de importación.

## Cómo correrlos desde la ruta nueva

```bash
node --env-file=.env.local --import tsx scripts/_archivo/<script>.ts
```

Los que pegan a Supabase necesitan `.env.local` con `SUPABASE_SERVICE_ROLE_KEY`.
Ojo: dev y prod comparten base — revisá que el script no escriba antes de correrlo.

## Qué hay acá

| Script | Para qué se escribió |
|---|---|
| `qa-str-prompt-tuteo.ts` | QA de la migración de la voz STR a tuteo (may-2026) |
| `fase3.5-ltr-batch.ts` · `fase3.6-ltr-batch.ts` · `fase3.7-ltr-batch.ts` · `fase3.9-ltr-batch.ts` | corridas por lote de las fases 3.5-3.9 del análisis LTR |
| `fase3.8-ltr-diag.ts` | diagnóstico puntual de la fase 3.8 |
| `caprate-muestra.ts` | muestra del hallazgo de CAP rate contra el corpus |
| `test-financing-health.ts` | prueba del clasificador `financing-health` |
| `sanity-test-motor-str.ts` | sanity del motor STR recién nacido |
| `sanity-test-subsidio-str.ts` | sanity del subsidio Ley 21.748 en STR |

## Lo que NO está acá

`smoke-str-engine-4b.ts` sigue vivo en `scripts/` — se corre a mano cuando hay
dudas del motor STR y se mantiene verde.
