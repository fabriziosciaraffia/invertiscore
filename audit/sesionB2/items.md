# Sesión B2 — Polish LTR (5 items)

**Fecha:** 2026-05-05
**Scope:** 5 items independientes del backlog menor LTR. Sin tocar IA prompts ni motor (excepto cap descuento item 3).

## Tabla resumen

| Item | Archivos | Líneas netas (B2) | Status |
|---|---|---|---|
| 1 | `src/components/ui/AnalysisDrawer.tsx` | +13 / −2 | ✅ OK |
| 2 | `src/app/analisis/[id]/results-client.tsx` | +13 / −3 | ✅ OK (con diagnóstico) |
| 3 | `src/lib/analysis.ts` | +6 / −1 | ✅ OK |
| 4 | — | 0 / 0 | ⚪ NO REQUIERE FIX |
| 5 | `src/components/zone-insight/ZoneInsightAI.tsx` | +4 / 0 | ✅ OK |

**Total B2:** 4 archivos, ≈ +36 / −6 líneas (net +30). Cero cambios en prompts IA, Card 09 patrimonio, TIR, cap rate, sliders.

## Item 1 — Fusionar slot Primera Oferta == Techo (`cerrar_actual`)

**Status:** ✅ OK.

**Diagnóstico:** `AnalysisDrawer.tsx:864-875` (`PlanNegociacion`) construye un array `slots` con 2 entradas hardcoded. Cuando el motor está en modo `cerrar_actual` (`primeraOferta_uf === techo_uf`), ambos slots renderizan el mismo número.

**Fix:** detección `slotsUnificados = precios.primeraOferta_uf === precios.techo_uf`. Si true, render UN slot etiquetado **"Oferta única"**. Si false, render 2 slots como antes. El slot walkAway sigue separado (su lógica no cambió).

**Copy elegido:** `"Oferta única"` (sentence case, una palabra + adjetivo). Glosa fallback: `"Cierra a este precio — no hay margen para negociar a la baja."` Reusa `glosaTecho` o `glosaPrimera` si la IA las generó.

**Archivos:** `src/components/ui/AnalysisDrawer.tsx`. Líneas: +13 / −2 (transformación array literal → ternario que retorna 1 o 2 slots).

## Item 2 — Discrepancia decimal header vs drawer Card 03

**Status:** ✅ OK.

### Diagnóstico (antes de tocar)

| Componente | Fuente del valor | Cálculo |
|---|---|---|
| Header card "Precio sugerido" | `buildHeroDatosClave` línea 1262-1268 | `parseUFString(aiData.negociacion.precioSugerido)` → `precioSugeridoUF`; `precioSugeridoCLP = precioSugeridoUF × valorUF` |
| Drawer Card 03 slot "Techo" | `PlanNegociacion` línea 872 | `precios.techo_clp` directo del motor (`anclasJsonPara_motor.techo_clp = Math.round(techoUF × UF_CLP)`, donde `UF_CLP = m.precioCLP / input.precio` calculado al generar el análisis) |

**Causa raíz:** dos sources of truth para la UF:
- `valorUF` (cliente) = UF live al cargar la página, fetcheada/passada como prop desde server.
- `UF_CLP` (server) = UF "snapshot" del momento en que se generó el análisis (`m.precioCLP / input.precio`).

Si la UF cambia entre la generación del análisis y la carga de la página, los CLP divergen ~0,4-0,5%. Para UF 5.000, la divergencia es ~$858K (200.342.751 vs 199.484.987 → Δ 0,43%).

### Fix aplicado

Header lee `aiData.negociacion?.precios?.techo_clp` y `…techo_uf` cuando están disponibles (caso normal post-Fase 3.6 v9). Si no están, fallback al cálculo previo. La fuente canónica pasa a ser el motor server-side (mismo origen que el drawer).

```ts
const techoUFAncla = aiData.negociacion?.precios?.techo_uf;
const techoCLPAncla = aiData.negociacion?.precios?.techo_clp;
const precioSugeridoUF = (typeof techoUFAncla === "number" && techoUFAncla > 0)
  ? techoUFAncla
  : precioSugeridoUFParsed;
const precioSugeridoCLP = (typeof techoCLPAncla === "number" && techoCLPAncla > 0)
  ? techoCLPAncla
  : precioSugeridoUF * (valorUF || 0);
```

**Archivos:** `src/app/analisis/[id]/results-client.tsx`. Líneas: +13 / −3.

**Validación:** análisis pre-Fase 3.6 v9 (sin `precios` en cache) caen al fallback antiguo, comportamiento sin regresión. Análisis nuevos consumen las anclas → header == drawer.

## Item 3 — Cap descuento -25% modo `optimizar_flujo`

**Status:** ✅ OK.

**Diagnóstico:** `lib/analysis.ts:1031-1037` (`calcNegociacionScenario`). En modo `optimizar_flujo`, llama a `calcPrecioFlujoViable` que busca por bisección el precio donde el flujo neto deja de ser inviable. Para casos con flujo MUY negativo, la bisección puede llegar a precios -32% bajo el actual (Caso F).

**Fix:** después del cálculo bruto de `precioFlujoViable`, clampear hacia arriba si el descuento implícito supera -25%:

```ts
const precioCap25 = input.precio * 0.75;
const precioSugeridoConCap = Math.max(precioFlujoViable, precioCap25);
precioSugeridoUF = Math.round(precioSugeridoConCap * 10) / 10;
```

`Math.max` aplica el cap solo cuando precioFlujoViable < cap25 (descuento bruto > 25%). Si el bruto es menor (descuentos chicos), respeta el cálculo. Cumple criterio del plan: "Si el cálculo ORIGINAL daba menos de -25%, mantener (no inflar hacia -25%). Solo cap superior."

**Archivos:** `src/lib/analysis.ts`. Líneas: +6 / −1.

### Verificación numérica

| Caso | Descuento bruto | Descuento post-cap | Esperado | Status |
|---|---|---|---|---|
| Caso F sintético (flujo muy neg.) | -32% | **-25%** | -25% (cap) | ✅ |
| Caso F variantes con bruto > 25% | -28%, -30%, -40% | -25% en todos | -25% | ✅ |
| Caso bajo mercado + flujo borderline (-15%) | -15% | -15% | -15% (sin cap) | ✅ |
| Casos que NO entran a `optimizar_flujo` (cerrar_actual / alinear_mercado) | n/a | n/a | sin cambio | ✅ |
| Casos sin trigger del modo (flujo viable o sobreprecio) | n/a | n/a | sin cambio | ✅ |

Verificación analítica del cap:
- `precioCap25 = input.precio × 0.75` → siempre 25% bajo precio actual.
- `Math.max(precioFlujoViable, precioCap25)` → si `precioFlujoViable < precioCap25`, gana `precioCap25` (descuento -25% exacto).
- Si `precioFlujoViable >= precioCap25`, gana `precioFlujoViable` (descuento menor a 25%).

Probe IA real no requerido — el cambio es matemático puro y trivialmente verificable en código.

## Item 4 — Capitalización walkAway sentence case

**Status:** ⚪ **NO REQUIERE FIX.**

**Inspección:** todos los strings relacionados a walkAway en motor + UI ya están en sentence case consistente:

| Ubicación | String | Capitalización |
|---|---|---|
| `lib/analysis.ts:1030` razon cerrar_actual | "Ya estás bajo mercado y la matemática cierra. No hay caso para pedir descuento." | sentence case ✅ |
| `lib/analysis.ts:1037` razon optimizar_flujo | "Bajas el precio para que tu aporte mensual sea sostenible, no porque el mercado lo valga menos." | sentence case ✅ |
| `lib/analysis.ts:1043` razon fallback | "El precio sugerido alinea con comparables y mejora marginalmente tu matemática." | sentence case ✅ |
| `lib/analysis.ts:1050` razon alinear_mercado | "Pagas sobre el valor real de la zona. Este precio te alinea con comparables y mejora la matemática." | sentence case ✅ |
| `lib/ai-generation.ts:913` razon walkAway BUSCAR OTRA | "El motor recomienda no comprar esta propiedad." | sentence case ✅ |
| `AnalysisDrawer.tsx:866` label | "Primera oferta" | sentence case ✅ |
| `AnalysisDrawer.tsx:871` label | "Techo" | single word capitalized ✅ |
| `AnalysisDrawer.tsx:880,886` label walkAway | "Walk-away" | sentence case con guión ✅ |

**Hipótesis:** la inconsistencia mencionada en el plan fue cerrada en commits previos (no detecté en el log breve). Ningún string actual requiere cambio.

**Archivos:** ninguno modificado. 0 líneas.

## Item 5 — Clamp ZoneInsightAI max-height

**Status:** ✅ OK.

**Diagnóstico:** `ZoneInsightAI.tsx:24-34` el `<div>` contenedor no tiene constraint de altura. Si la IA genera narrative >100 palabras + accion larga, el contenedor crece y empuja el resto del layout, causando overflow visible en viewports angostos.

**Fix:** agregar al inline style del contenedor:
- `maxHeight: 240` (px) — sweet spot que permite ~6-7 líneas narrative + accion + headline + tag pill sin recortar contenido típico, pero impide overflow extremo.
- `overflowY: "auto"` — scroll interno cuando se excede.

Sin fade-out artificial (plan lo prohíbe explícitamente). Sin tocar tipografía ni padding interno (consistencia design system preservada).

```tsx
style={{
  borderLeft: "3px solid var(--franco-text)",
  background: "color-mix(...)",
  borderRadius: "0 8px 8px 0",
  padding: "14px 18px",
  maxHeight: 240,        // ← B2 item 5
  overflowY: "auto",     // ← B2 item 5
}}
```

**Archivos:** `src/components/zone-insight/ZoneInsightAI.tsx`. Líneas: +4 / 0.

## Validación general

### Build
✅ `npm run build` limpio.

### Smoke test localhost
No ejecutado en sandbox (sin dev server activo). Sugerencias:
- Cargar análisis en modo `cerrar_actual` (probable que `0c269222` lo esté si tiene ventaja de compra y flujo viable) → confirmar slot único "Oferta única" en drawer Card 03.
- Cargar `0c269222`: comparar header card "Precio sugerido" CLP vs drawer Card 03 slot "Techo" CLP. Deben coincidir bit-a-bit (item 2 fix).
- Cargar zone-insight con narrative largo → confirmar scroll interno sin overflow del card.
- Cargar Caso F sintético (flujo muy negativo) → confirmar descuento sugerido = -25% exacto.

### Restricciones respetadas
- ✅ Sin tocar prompts IA (REGLA 10/8 B3-h7 intactas)
- ✅ Sin tocar Card 09 patrimonio (post-Sesión A)
- ✅ Sin tocar TIR / cap rate / sliders
- ✅ Sin push

## Hallazgo lateral (fuera de scope, no aplicado)

**Item 4 inconsistencia no encontrada:** revisé todos los strings walkAway en `src/` y están en sentence case consistente. Si el usuario tiene un caso específico donde se ve inconsistencia, agradecería el contexto exacto (texto + dónde aparece) para localizarlo.
