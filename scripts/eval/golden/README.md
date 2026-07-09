# Golden Set LTR — eval de regresión

Fase 2.0 obligatoria del sistema. 7 casos canónicos (GS-*) + 3 borde (BE-*)
seedados como filas inmutables `GOLDEN::` (UF congelada 38800). Tres capas:
recompute determinístico → generación fresca AUTO → checklist semántico (juez).

Diseño aprobado: `of-golden-design.md` (raíz, untracked).

## Piezas

| archivo | qué hace | tokens |
|---|---|---|
| `seeds.ts` | inputs congelados + mediana + ejes + UUID fijo. **Inmutable.** | — |
| `baseline.json` | esperados clase (a) congelados. Re-baseline solo con OK de Fabrizio. | — |
| `extract.ts` | gather+dedup+orden (espejo de PiramideHallazgos) + parsing de cifras | — |
| `invariants.ts` | clase (a) vs baseline + clase (b) estructural (B1-B6) | — |
| `seed-db.ts` | upsert idempotente de las 10 filas a Supabase (§1) | — |
| `recompute.ts` | tier QUICK: carga fila persistida, recompute UF-congelada, clase a+b+B8 | 0 |
| `generate.ts` | tier FULL AUTO: `generateAiAnalysis(persist:false)` ×K, checks AUTO | sí |
| `semantic.ts` | tier FULL semántico: juez Opus (reusa `../judge.ts`) | sí |
| `catch-test.ts` | meta-validación: rompe invariantes y verifica que el runner CAZA | 0 |
| `runner.ts` | CLI orquestador | — |
| `accept.ts` | re-baseline (regenera baseline.json) | 0 |

## Uso

```bash
# QUICK (default) — recompute determinístico, 0 tokens, segundos
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --quick

# FULL — QUICK + generación fresca AUTO + semántico (cuesta tokens)
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --full --k=2

# FULL sin el juez Opus (solo AUTO, más barato)
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --full --no-semantic

# Meta-test: ¿el runner caza bugs?
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --catch-test

# (Bootstrap / mantenimiento)
node --env-file=.env.local --import tsx scripts/eval/golden/seed-db.ts   # persiste filas
node --env-file=.env.local --import tsx scripts/eval/golden/accept.ts    # re-baseline (con OK de Fabrizio)
```

Exit 0 solo si no hay fallas duras. Drift de cifra clase (a) → warning (candidato
a re-baseline, no bloquea). Flags semánticos → reporte, no bloquean.

### AUTO (generación fresca): duro vs soft

- **Duros (bloquean)** — contratos ESTRUCTURALES que deben cumplirse en cada
  generación: `A1` apertura == fraseCanonica del #1 por decisividad (≠ corona de
  pirámide, que es adverso-first); `A2` fabricación de zona sobrevivió reintentos
  (`_catchRootAFlag`, solo GS-5); `A5` §9 presente en cajaAccionable; `A6`
  presupuesto Plan C (≤85 palabras); `A7·D2` no niega VM cuando VM es sólido;
  `A8·D1` largoPlazo compara con instrumentos.
- **Soft (reportan TASA, no bloquean)** — detectores de FRASEO estocásticos, igual
  que el producto los trata (detección no-bloqueante): `~engine-ism` (~1/6 runs),
  `~zona-drift` (el detector propio se confunde con el arriendo-en-UF),
  `~planc-stripped` (los strippers auto-corrigen). Una REGRESIÓN de código dispara
  la tasa (ej. 5/6) y se ve; una ocurrencia aislada no vuelve rojo el gate.

## Política (cuándo corre)

- **QUICK obligatorio** en todo goal que toque motor / builders / render de hallazgos.
- **FULL obligatorio** si el diff toca generación / prompts / builders-que-alimentan-generación.
  Opcional a pedido en el resto.
- Cuando un cambio **legítimo** del motor mueve un esperado clase (a): el runner
  imprime el drift `viejo→nuevo`; **Fabrizio aprueba**; `accept.ts` re-baselinea en
  un commit dedicado. Falla clase (b) → siempre regresión hasta prueba en contra.

## Invariantes clase (b) — nunca deben romperse

- **B1** cifra del body (fraseCanonica) refleja el `valor` del motor dentro de la precisión de display.
- **B2** dirección del hallazgo coherente con su valor y su corte.
- **B4** dedup por id (titular gana) + corona == #1 adverso por decisividad.
- **B5** N de la pirámide ∈ [5,9].
- **B6** omisiones donde corresponde (sensibilidad si BUSCAR; patrimonio si totalAportado≤0; sobreprecio si mediana confiable).
- **B8** veredicto persistido == recompute.

## Alcance

Nace LTR. STR se suma en su migración. La paridad exacta del KPI del render con el
body (findingDisplay) es tier **pixel** (futuro), fuera del recompute.
