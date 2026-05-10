# Deprecación STR v1

**v2 default desde:** 2026-05-09 (Prompt B post-audit)
**Eliminación de v1 prevista:** 2026-05-23 (+14 días)

## Contexto

El módulo STR v1 fue construido antes de la consolidación de los skills `analysis-voice-franco` y `franco-design-system`. La auditoría `audit/str-voice-design-audit.md` documentó violaciones masivas de Capa 1 (ámbar `#FBBF24`, slate-blue `#B0BEC5` hardcoded), Capa 2 (`font-body font-bold/semibold` prohibido) y ausencia total de Patrón 4 (anatomía propia "INFORME PRO" con gradient rojo).

v2 (`results-client-v2.tsx` + componentes en `src/components/analysis/str/`) reemplaza la página completa con primitivas alineadas al sistema (HeroVerdictBlockSTR, SubjectCardGridSTR, AdvancedSectionSTR, AIInsightSTR).

## Archivos a eliminar

- `src/app/analisis/renta-corta/[id]/results-client.tsx` (1646 líneas, marcado `@deprecated`)

Tipos legacy embebidos que serán removidos junto al archivo:
- `interface AIAnalysisSTR` (schema v1 — `tuBolsillo / vsAlternativas / operacion / proyeccion / riesgos / veredicto`)
- `function AIAnalysisSTRSection` (la sección IA completa con typewriter + parser regex `RESUMEN/A FAVOR/EN CONTRA/RECOMENDACIÓN`)
- Helper `aiText`, `parseImportante`, `parseBullets`

## Cambios al eliminar v1

1. Borrar `src/app/analisis/renta-corta/[id]/results-client.tsx`.
2. Simplificar `src/app/analisis/renta-corta/[id]/page.tsx`:
   - Eliminar el branching del feature flag `STR_V2_ENABLED`.
   - Importar y renderizar `STRResultsClientV2` directamente.
   - Borrar el comentario de Ronda 4c y la const `STR_V2_ENABLED`.
3. Limpiar el bloque legacy v1 de `AIInsightSTR.tsx`:
   - Borrar `interface AIAnalysisSTRv1Shape`
   - Borrar `function RenderV1`, `SectionV1`, `RiesgosBlockV1`
   - Borrar `pickFieldClpUf` (solo se usa en RenderV1)
   - Simplificar el discriminator `shape` — solo "v2" / "loading" / "empty"
4. Renombrar `STR_V2_ENABLED` y referencias en docstrings.

## Variables de entorno a limpiar

- `NEXT_PUBLIC_STR_V2` — todo el branching desaparece, se puede remover de `.env.local` y del dashboard de Vercel.

## Validación pre-eliminación

- [ ] 0 análisis STR servidos con v1 en últimos 7 días (revisar logs / métricas)
- [ ] 0 errores nuevos desde activación v2 en producción
- [ ] QA visual mobile (375px) + desktop (1440px) completo
- [ ] AI Insight v2 sin Signal Red — confirmado contra Patrón 4
- [ ] Comparativa LTR ↔ STR: mismos primitives (HeroTopStrip, DatoCard, AppNav, AppFooter)
- [ ] Outputs IA STR cacheados con voz tuteo (Prompt A aplicado, caches invalidados)

## Backout plan (durante ventana de 14 días)

Si aparece un bug crítico en v2:
- Setear `NEXT_PUBLIC_STR_V2=false` en Vercel (preview o prod).
- El branching en `page.tsx` toma el valor y sirve v1 sin re-deploy del código.
- Reportar el bug, fixearlo en v2, volver a flipear el flag.
