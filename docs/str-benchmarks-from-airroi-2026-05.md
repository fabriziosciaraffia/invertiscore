# Benchmarks STR Santiago — AirROI (mayo 2026)

Datos extraídos del experimento de calibración del 9 de mayo 2026.
Sample: 270 listings (90 por barrio) en Lastarria, Providencia y Las Condes via `/listings/search/market`.
Filtros aplicados: `ttm_revenue > 0` AND `ttm_days_reserved >= 30` → 149 listings utilizables (de 270).
Métricas: TTM (trailing twelve months) directamente desde AirROI `performance_metrics`.

**Fuente de raw data:** `scripts/output/calibracion-uplifts-20260510-005224.csv` (no comitear).

---

## 1. Stats globales (pooled, 3 barrios)

- **n filtrado:** 149
- **ADR (CLP/noche):** mediana $51.475 | promedio $65.540 | P25 $39.465 | P75 $76.936
- **Occupancy:** mediana 38.4% | promedio 39.4%
- **Revenue mensual:** mediana $575.603

---

## 2. Por barrio

| Barrio | n | ADR med | ADR p25-p75 | Occ med | Rev/mes med |
| --- | --- | --- | --- | --- | --- |
| Lastarria | 50 | $39.564 | $32.564–$44.294 | 29.4% | $313.402 |
| Providencia | 55 | $55.672 | $43.688–$68.652 | 46.3% | $827.356 |
| Las Condes | 44 | $81.338 | $62.640–$114.814 | 41.4% | $1.024.097 |

---

## 3. Por banda operacional (pro_management binario)

**Definición simple:** B1 = `professional_management=true`. B2 = `professional_management=false`. Sin filtrar por count de unidades en sample (que dio n=0 en B1 con threshold ≥5).

| Barrio | n B1 / B2 | B1 ADR med | B2 ADR med | B1 Occ med | B2 Occ med |
| --- | --- | --- | --- | --- | --- |
| Lastarria | 3 / 47 | $43.797 | $39.446 | 17.0% | 29.6% |
| Providencia | 3 / 52 | $92.530 | $53.626 | 47.1% | 45.1% |
| Las Condes | 7 / 37 | $88.185 | $81.163 | 52.9% | 41.1% |
| **Pooled** | **13 / 136** | **$77.514** | **$50.724** | **47.1%** | **37.2%** |

---

## 4. Por bedrooms (1D vs 2D vs 3D+)

Útil para validar si el motor STR replica la curva de ADR/bedroom observada.

| Bedrooms | n | ADR med | ADR/bed med | Occ med | Rev/mes med |
| --- | --- | --- | --- | --- | --- |
| 1D | 89 | $45.373 | $45.373 | 35.9% | $435.644 |
| 2D | 38 | $80.399 | $40.200 | 47.0% | $899.801 |
| 3D+ | 9 | $121.004 | $40.335 | 40.4% | $1.771.090 |

---

## 5. Targets de calibración v1 (deberían reproducirse en motor STR)

Para validar que el motor STR está bien calibrado, sus outputs en condiciones similares deberían quedar dentro de estos rangos:

| Test case | ADR esperado | Occ esperada | Rev mensual esperado |
| --- | --- | --- | --- |
| Lastarria, baseline (no-pro, 1-2D, depto típico) | $32.564–$44.294 | ~29.4% | ~$313.402 |
| Providencia, baseline (no-pro, 1-2D, depto típico) | $43.688–$68.652 | ~46.3% | ~$827.356 |
| Las Condes, baseline (no-pro, 1-2D, depto típico) | $62.640–$114.814 | ~41.4% | ~$1.024.097 |

**Caveat:** sample n_B1=13 across barrios. Cualquier conclusión sobre uplift `professional_management` es directional, no precisa.

---

## 6. Caveat — observado vs target estabilizado

Las medianas de occupancy reportadas arriba (Lastarria ~32%, Providencia ~44%, Las Condes ~42%, rango pooled 37–47%) son **TTM observadas en AirROI sobre TODOS los listings activos**, incluyendo:

- Listings recién publicados que aún están en ramp-up.
- Listings mal-fotografiados, mal-pricados o con reviews bajos.
- Listings que el host abandonó pero no dio de baja.
- Mix de operadores hobby y operadores profesionales sin segmentar.

Los **targets de ocupación estabilizada** del motor (55% baseline auto-gestión, 65% admin pro residencial / dedicado auto, 74% dedicado + admin pro) reflejan **"qué ocupación es alcanzable con buena ejecución" en mes 7+ post-listing**, no "el promedio del mercado".

Fuentes que justifican el shift:
- **Proforma Andes STR Alameda 107 (sept 2025):** 74% target estabilizado para edificio dedicado con admin pro full-service.
- **Airbtics público:** Andes STR opera ~10–15 puntos sobre el promedio Santiago.
- **Curva de ramp-up:** los primeros 5 meses operan al 50/60/70/80/90% del target — la mediana TTM está sesgada hacia abajo por listings inmaduros.

**Implicación práctica:** un listing nuevo con baseline (residencial, auto-gestión, básico) NO va a ocupar 55% en su primer mes — va a operar al 27.5% (50% del target). Llega al 55% recién en mes 6. La mediana de la cohorte refleja el promedio entre listings ramp-uppeando y listings estables; el target del motor es el plateau, no el promedio cohorte.

---

## 7. Notas sobre el motor STR

- El motor `calcShortTerm` (`src/lib/engines/short-term-engine.ts`) consume los percentiles de AirROI directamente como input. No se puede validar listing-por-listing sin gastar AirROI calls.
- Calibración v1 introduce constantes de uplift (factor edificio, factor habilitación, ocupación target) en lugar de usar `airbnbData.percentiles.occupancy.p50` directamente. Ver constantes `STR_OCUPACION_TARGET` y `STR_ADR_FACTOR` en short-term-engine.ts.
- Validación post-implementación recomendada: comparar el output del motor con `tipo_edificio=residencial_puro + admin_pro=false + habilitacion=basico` contra las medianas baseline de la tabla 5. Deberían coincidir en orden de magnitud.
