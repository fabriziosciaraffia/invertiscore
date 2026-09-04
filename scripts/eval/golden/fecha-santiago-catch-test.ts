// ============================================================================
// GOLDEN · fecha en hora de Chile — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Un `created_at` de madrugada se pintaba con dos días distintos: el server (Vercel, UTC) y el
// navegador (Chile) no compartían zona horaria y React lo reportaba como error de hidratación
// (#418 / #423 / #425) en /analisis/renta-corta/[id]. 57 de 246 filas STR caían en la ventana.
// El helper fija America/Santiago; este fixture compara contra UTC y contra Santiago explícito.
//   node --env-file=.env.local --import tsx scripts/eval/golden/fecha-santiago-catch-test.ts
// ============================================================================
import { fechaCortaCL, TZ_CHILE } from "../../../src/lib/fecha-cl";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

// 02:30 UTC del 15-ago = 22:30 del 14-ago en Chile (invierno, UTC−4).
const MADRUGADA = "2026-08-15T02:30:00.000Z";
// 03:30 UTC del 20-dic = 00:30 del 20-dic en Chile (verano, UTC−3): mismo día en las dos zonas.
const VERANO_MISMO_DIA = "2026-12-20T03:30:00.000Z";
// 02:30 UTC del 20-dic = 23:30 del 19-dic en Chile (verano).
const VERANO_DISTINTO = "2026-12-20T02:30:00.000Z";

const fmt = (iso: string, tz: string, month: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month, year: "numeric", timeZone: tz });

for (const [nombre, iso, distinto] of [
  ["madrugada de invierno", MADRUGADA, true],
  ["verano · mismo día", VERANO_MISMO_DIA, false],
  ["verano · día distinto", VERANO_DISTINTO, true],
] as const) {
  const got = fechaCortaCL(iso);
  const santiago = fmt(iso, TZ_CHILE);
  const utc = fmt(iso, "UTC");
  if (got !== santiago) F(`${nombre}: el helper dio «${got}», Santiago explícito da «${santiago}»`);
  if (distinto && utc === santiago) F(`${nombre}: el caso debía distinguir UTC de Santiago y no lo hace (${utc})`);
  if (distinto && got === utc) F(`${nombre}: el helper pinta el día UTC «${utc}» — es el bug de hidratación`);
  if (!distinto && got !== utc) F(`${nombre}: mismo día en las dos zonas, pero el helper dio «${got}» y UTC «${utc}»`);
}
if (!/\b14\b/.test(fechaCortaCL(MADRUGADA))) F(`madrugada: esperaba el día 14 (Chile) y dio «${fechaCortaCL(MADRUGADA)}»`);
if (fechaCortaCL(MADRUGADA, { month: "long" }) !== fmt(MADRUGADA, TZ_CHILE, "long")) F("month long: no coincide con Santiago explícito");
if (fechaCortaCL(new Date(MADRUGADA)) !== fechaCortaCL(MADRUGADA)) F("Date y string deben dar lo mismo");
if (fechaCortaCL(null) !== "" || fechaCortaCL(undefined) !== "" || fechaCortaCL("") !== "") F("sin fecha debe dar vacío");
if (fechaCortaCL("no-es-fecha") !== "") F("fecha inválida debe dar vacío");

console.log("\nfecha en hora de Chile · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
