// ============================================================================
// GOLDEN · instrumentos por su nombre — catch-test (#11 · 07-sep-2026). 0 tokens.
// ============================================================================
// Fija qué wording nombra el instrumento y cuál solo nombra el género. Nació para
// A8·D1 en LTR; esa regla se retiró con `largoPlazo` en v21 (08-sep-2026) y el
// matcher quedó sirviendo al golden de STR, donde el campo existe y se renderiza.
// Los legítimos salen del parque y de los dumps LTR: «depósito a
// plazo», «depósito en UF al 5%», «depósito a plazo en UF», «depósito UF», «fondos
// mutuos», plural de depósito. Los ilegítimos son los que la regla protege.
//
// Corre dentro del QUICK del runner (tier "instrumentos") y standalone:
//   node --import tsx scripts/eval/golden/instrumentos-catch-test.ts
// ============================================================================
import { nombraInstrumento } from "./instrumentos";

const LEGITIMOS: string[] = [
  "La alternativa directa es poner tus $21 millones en un depósito a plazo al 5% anual.",
  "Frente a un depósito en UF al 5% anual que a 10 años te devuelve $30 millones.",
  "Un depósito a plazo en UF, sin vacancia y con liquidez, te deja $30 millones.",
  "Contra un depósito UF al 5%, el depto proyecta el doble al vender.",
  "Comparado con un fondo mutuo al 7%, el depto te deja más, pero con aporte mensual.",
  "Ni los depósitos a plazo ni los fondos mutuos exigen que pongas plata cada mes.",
];

const ILEGITIMOS: string[] = [
  "Frente a un depósito al 5% anual, el depto proyecta el doble al vender.",
  "Comparado con un instrumento de renta fija, la TIR del depto supera la tasa.",
  "Cualquier instrumento conservador te devuelve menos que tu parte al vender.",
];

/** Tier para el runner: cada wording mal clasificado es una falla dura. */
export function runInstrumentosTier(): { hard: number } {
  console.log("\n─── TIER INSTRUMENTOS (nombra el instrumento, no el género · instrumentos.ts, 0 tokens) ───");
  let hard = 0;
  for (const t of LEGITIMOS) if (!nombraInstrumento(t)) { hard += 1; console.log(`  ✗ legítimo rechazado: «${t}»`); }
  for (const t of ILEGITIMOS) if (nombraInstrumento(t)) { hard += 1; console.log(`  ✗ ilegítimo aceptado: «${t}»`); }
  if (!hard) console.log(`  ✓ VERDE — ${LEGITIMOS.length} legítimos aceptados · ${ILEGITIMOS.length} ilegítimos rechazados`);
  return { hard };
}

if (require.main === module) {
  process.exit(runInstrumentosTier().hard ? 1 : 0);
}
