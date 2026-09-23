# Actas del re-baseline · la factibilidad STR mide la demanda de la zona (23-sep-2026)

Decisión de producto (Fabrizio): la dimensión «factibilidad» del score STR (25 de 100) deja de ser
0,30 ingreso del estimador ÷ un monto fijo por dormitorios + 0,20 tipología + 0,25 regulación
constante 100 + 0,25 atractores. Salen tres piezas:

- **la constante de regulación**: un resto del retiro V1 (11-sep), que le ponía un piso de 25 puntos
  a cualquier fila;
- **el ingreso del estimador**: el mismo p50 de AirROI que ya decide la rentabilidad, contra montos
  escritos a mano en abr-2026, sin fuente ni reajuste;
- **la tipología**: la tabla dormitorios × m² iba contra lo observado (correlación −0,13 con la
  ocupación realizada; con 10.866 listings del caché la ocupación casi no cambia por dormitorios).

Entra la **demanda de la zona**: la ocupación realizada p50 de los comparables de AirROI, por su
NIVEL —nunca la brecha contra la ocupación estimada, que es la operación y ya la explica
«Ocupación en renta corta»—, con la curva anclada en la mediana de Santiago (28,5 %, mismo filtro de
listings que el dato del caso): la mediana → 65, su mitad → 25, 1,6 veces → 90. Sin comparables, la
factibilidad cae a los atractores. Las filas que no guardaron el dato lo leen del caché de AirROI en
el recálculo; nada se escribe en la base.

Medido con el código final sobre el parque (257 filas, `scripts/of-parque-factibilidad-final.ts`): las 42
que no guardaron el dato lo leen del caché y ninguna cae al respaldo; la factibilidad pasa de p10 66 · p50
82 · p90 90 a p10 52 · p50 75 · p90 90, y cambian 8 veredictos, todos hacia abajo (6 COMPRAR → AJUSTA,
2 AJUSTA → BUSCAR): se va el piso de 25 puntos que ponía la constante. (La FASE 0 había dado 9 con un
ancla de 28,8 %; la del generador, con el filtro exacto del dato del caso, es 28,5 %.)

**El golden.** Las seeds STR congelaban `airbnbRaw` pero no la ocupación realizada: se congeló en
`str-seeds-frozen.json` (`ocupacionRealizadaComparables`), leída del caché con el mismo helper del
recálculo. GE-5, la seed «sin toda señal de ocupación» (occ-strip), la quita también: es la que
ejercita el respaldo por atractores. Solo mueve la línea base STR (`str-baseline.json`); LTR no se toca
(drift 0). Ningún veredicto cambia. Medido con `runner.ts --str` antes del accept.

## STR (`str-baseline.json`, 7 seeds)

| Seed | Veredicto | Score viejo → nuevo | Factibilidad vieja → nueva | Acta |
|---|---|---|---|---|
| GE-1 | COMPRAR | 73 → 70 | 89 → 79 | Santiago centro: los comparables se ocupan 38 % del año, sobre la mediana de Santiago pero lejos del 89 que daban la constante, la tipología 100 (1D chico) y los atractores 100. Sigue COMPRAR, ahora justo en el corte (70). |
| GE-2 | AJUSTA | 58 → 60 | 82 → 90 | Providencia: los comparables se ocupan 48 %, 1,7 veces la mediana; la curva satura en 90. La tipología (2D, 80) y el ingreso bajo (53) la subestimaban. |
| GE-4 | COMPRAR | 79 → 81 | 82 → 90 | Misma dirección que GE-2 (Providencia 47 %): mismo mecanismo, dos puntos más. |
| GE-5 | AJUSTA | 62 → 64 | 89 → 100 | La seed sin ninguna señal de ocupación: sin comparables cae al respaldo, y los atractores de Santiago centro dan 100. Es la seed que ejercita ese camino. |
| GE-6 | BUSCAR | 45 → 43 | 89 → 79 | Misma dirección que GE-1 (38 %): baja dos puntos y sigue BUSCAR por sus gates (cash on cash severo y break-even inviable). |
| GE-PC | AJUSTA · pie cero | 73 → 70 | 89 → 79 | Síntesis sobre GE-1: misma demanda, mismos tres puntos menos; el horizonte sigue capando el COMPRAR. |
| GE-PJ | AJUSTA · precio justo | 58 → 60 | 78 → 90 | Misma fila base que GE-2; la vieja era más baja porque el ingreso sin overrides daba 41. |

Las siete comparten dos direcciones (Santiago centro y Providencia), así que los atractores dan 100 en
todas: el golden no mide cuánto discriminan. Esa cobertura la dio el parque (FASE 0).
