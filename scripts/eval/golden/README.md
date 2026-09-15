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
| `timeout.ts` | techo de 5 min por llamada al generador / juez en FULL: el seed cae como FALLA-TIMEOUT y la tanda sigue (una tanda quedó colgada 8 h el 06-sep) | — |
| `runner.ts` | CLI orquestador | — |
| `accept.ts` | re-baseline (regenera baseline.json) | 0 |
| `str-v16-dump/` | corpus: las 12 salidas STR de la tanda FULL parcial del prompt v16 (6 seeds × 2), prosa persistida. Alimenta catch-tests de 0 tokens; no son cifras congeladas. | — |
| `guards-v16-dump-catch-test.ts` | [STR-ENGINEISM] + [HERO-CLAIM] sobre el corpus v16: caza toda oración con la familia y no dispara fuera de ella | 0 |

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

## Meta-validación: qué cubre y qué no

`catch-test.ts` muta invariantes y exige que el checker falle. **Cubre `checkClassA` y
`checkClassB` (`invariants.ts`) y nada más**: las otras 44 tiers del runner no tienen
meta-validación de ninguna clase. Hasta el 17-sep-2026 su cabecera decía lo contrario.

Por qué importa: en el arco del pop-up (13-17 sep) **cuatro catch-tests estuvieron verdes
sobre código roto**, y una auditoría adversaria confirmó **102 predicados más que no miden
lo que dicen — 94 en tiers que sí corren acá**. La regla y los seis modos de falla están en
`CLAUDE.md` § Testing.

### El tamaño del problema

| | |
|---|---|
| tiers cableados | 36 archivos · 44 tiers |
| bloques de invariante | **234** |
| llamadas de aserción | 1.183 |
| tiers que ninguna costura puede alcanzar | **0** |
| tiers que entran en una costura compartida | **35 de 36** |

Por tipo: 12 leen fuente con regex (**texto**), 11 llaman funciones del motor con fixtures
(**dato**), 13 hacen las dos cosas (**mixto**). Por esfuerzo: 6 triviales, 16 bajos, 11
medios, 3 altos — y de los tres altos, dos son volumen y no dificultad.

### Las dos costuras

1. **TEXTO** — `leer(ruta)` con un mapa de overrides. Hoy cada tier define su propia copia
   (21 comparten la función byte por byte) y llama a `readFileSync` directo. La mutación es
   inyectar un texto fuente modificado y exigir rojo. Probada sobre `popup-ajustes` mutando
   `esActual` en `PopupAjustes.tsx`: 0 fallas → 3.
2. **DATO/MOTOR** — reemplazo del módulo en `require.cache` antes de requerir el tier.
   Probada de punta a punta sobre `titular-final`.

⛔ **Dos trampas del arnés, las dos medidas.** Asignarle a un export para mutarlo
**se ignora en silencio**: tsx/esbuild los emite como getters sin setter, así que un
meta-runner escrito así da verde sin haber mutado nada — el punto ciego exacto que esto
viene a cerrar. Y varios tiers corren todo en top-level, así que no se los puede re-ejecutar
con otra entrada sin sacarlos de ahí primero.

### Etapas

- **Etapa 0 — que la frase no mienta.** Declarar el alcance real en `catch-test.ts`. Hecho.
- **Etapa 1 — la costura compartida + sanity.** Las dos costuras y una pasada que corre cada
  tier SIN mutar exigiendo `hard === 0`. Cubre las 44 de una sola vez y ordena el resto.
  Incluye sacar de top-level los tiers que no se pueden re-ejecutar.
- **Etapa 2 — el catálogo, tier por tier.** Una mutación declarada por bloque de invariante.
  Es el volumen: 234 mutaciones, y **no se derivan solas** — cada bloque pincha otra cosa.
  No hay bloqueo entre tiers, así que entra por lotes y se prioriza por lo que vigila.
- **Etapa 3 — identidad del caso.** Hoy un tier devuelve `{hard: number}` y el nombre del
  invariante roto solo existe en stdout. Una meta-validación honesta afirma «esta mutación
  mata ESTE invariante», y con un contador no se puede.

## Alcance

Nace LTR. STR se suma en su migración. La paridad exacta del KPI del render con el
body (findingDisplay) es tier **pixel** (futuro), fuera del recompute.
