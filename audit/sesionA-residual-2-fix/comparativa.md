# Sesión A residual #2 — tabla comparativa post-fix

**Fecha:** 2026-05-05
**Fix:** eliminado el `UF_CLP` global mutable de `lib/analysis.ts`. Ahora cada función pública recibe `ufClp: number` explícito.

**Convergencia esperada:** Card 04 (snapshot server con UF=server) ≈ Sim @ 10A defaults (recompute con UF=server pasado al motor) → Δ ≤ 0,05 pp.

| Caso | Card 04 TIR (snapshot) | Sim TIR @ 10A (recompute con UF=server) | Δ |
|---|---|---|---|
| Caso real 0c269222 (Santiago, post-fix Sesión A) | 6,95% | 6,95% | +0.00 pp ✅ |
| Canónico 7710a017 Providencia | 11,20% | 11,20% | +0.00 pp ✅ |
| Sintético sobreprecio (precio +20% sobre canónico) | 3,07% | 3,07% | +0.00 pp ✅ |
| Sintético ventaja compra (precio −10% sobre canónico, +est $80K) | 14,44% | 14,44% | +0.00 pp ✅ |

**Resultado: 4/4 casos OK** ✅


## Override del usuario — caso 0c269222 con plusvalía 8% en sim

| Slider plusvalía | TIR @ 10A |
|---|---|
| 4% (default = motor) | 6,95% |
| 8% (override) | 15,09% |

Override coherente: ✅ sim sube TIR con plusvalía mayor.
