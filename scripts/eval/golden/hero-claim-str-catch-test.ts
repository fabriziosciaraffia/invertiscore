// ============================================================================
// GOLDEN · [HERO-CLAIM] STR — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Testigos de la tanda v13: GE-1 "multiplica el flujo por más de 35 veces" (sin comparador
// nombrado ⇒ sin licencia), GE-3 "casi cuatro veces el margen del corto en su mejor
// escenario" (flujo largo 152.894 contra el upside del corto 163.836 = 0,93×), GE-6 "operar
// al doble de lo que la zona mediana produce" con break-even 153% (1,53×). Y lo que NO
// dispara: múltiplos con licencia y prosa sin múltiplos.
//   node --env-file=.env.local --import tsx scripts/eval/golden/hero-claim-str-catch-test.ts
//
// 06-sep-2026 (goal guards STR (b), testigo GE-1 v16): "triplica el neto del largo" y "casi
// tres veces más en NOI neto" con NOI corto/NOI largo 2,98× tienen licencia ("neto" es NOI;
// el sujeto pegado DESPUÉS del múltiplo gana al de veinte palabras antes; "casi N veces
// más" se mide como "casi N veces"); "casi duplica / casi dobla / dobla" con tarifa/p50
// 1,58× disparan.
// ============================================================================
import { violacionesHeroClaimStr, type RazonesHeroClaimStr } from "../../../src/lib/str-guards";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

// Razones de GE-3 (BUSCAR, Providencia): flujo largo 152.894; corto base 34.922, upside 163.836.
const ge3: RazonesHeroClaimStr = {
  flujoBase: 34_922, flujoUpside: 163_836, dividendoM: 900_000, flujoLargo: 152_894,
  noiCorto: 934_922, noiLargo: 1_052_894, ingresoBrutoM: 1_400_000, arriendoLargoM: 1_150_000,
  adrFinal: 60_000, adrRef: 58_000, occFinal: 0.48, occRef: 0.48, occBanda: 0.58, occTarget: 0.74,
  capPct: 3.1, breakEvenPct: 0.96, sujetoUfM2: 79.3, medianaUfM2: 81.7, medianaConfiable: true,
};
// Razones de GE-6 (BUSCAR, Santiago): break-even 153% del mercado.
const ge6: RazonesHeroClaimStr = { ...ge3, breakEvenPct: 1.53, capPct: 2.4, flujoBase: -285_504, flujoUpside: -171_860 };
// Razones de GE-1 (COMPRAR, Santiago Centro): NOI corto 629.372 / NOI largo 210.936 = 2,98×; tarifa
// $75.000 / estimación $47.496 = 1,58×; flujo base 14.747 contra flujo largo 368.000 (0,04×).
const ge1: RazonesHeroClaimStr = {
  ...ge3, flujoBase: 14_747, flujoUpside: 520_000, flujoLargo: 368_000, noiCorto: 629_372, noiLargo: 210_936,
  ingresoBrutoM: 1_200_000, arriendoLargoM: 408_000, adrFinal: 75_000, adrRef: 47_496, occFinal: 0.66, occRef: 0.66, occBanda: 0.60,
  capPct: 4.75, breakEvenPct: 0.98,
};

const casos: { nombre: string; texto: string; r: RazonesHeroClaimStr; dispara: boolean; contiene?: string }[] = [
  // GE-1: "multiplica el flujo por más de 35 veces … el upside" es flujo upside ÷ flujo base.
  // Con base $14.747 y upside $520.000 la razón es 35,3× y la afirmación tiene licencia; con
  // upside $300.000 (20×) no la tiene. El guard mide, no supone.
  { nombre: "GE-1 · 35 veces con licencia (35,3×)", r: { ...ge3, flujoBase: 14_747, flujoUpside: 520_000 }, dispara: false,
    texto: "**La brecha hacia el 74% de gestión estabilizada multiplica el flujo por más de 35 veces: ahí está el upside.**" },
  { nombre: "GE-1 · 35 veces sin licencia (20×)", r: { ...ge3, flujoBase: 14_747, flujoUpside: 300_000 }, dispara: true, contiene: "flujo upside/flujo base = 20.34",
    texto: "**La brecha hacia el 74% de gestión estabilizada multiplica el flujo por más de 35 veces: ahí está el upside.**" },
  { nombre: "35 veces sin comparador", r: ge3, dispara: true, contiene: "sin nombrar contra qué",
    texto: "Con gestión seria el flujo se multiplica por más de 35 veces." },
  { nombre: "GE-3 · casi cuatro veces contra el upside del corto", r: ge3, dispara: true, contiene: "flujo largo/flujo corto (upside)",
    texto: "Eso te deja $152.894 de flujo libre sobre el dividendo, casi cuatro veces el margen del corto en su mejor escenario." },
  { nombre: "GE-6 · al doble con break-even 1,53×", r: ge6, dispara: true, contiene: "break-even/ingreso de mercado = 1.53",
    texto: "El break-even exige ingresos brutos altos: es operar al doble de lo que la zona mediana produce." },
  { nombre: "GE-6 · al doble sin sujeto claro", r: ge6, dispara: true,
    texto: "Es operar al doble de lo que la zona mediana produce." },
  { nombre: "con licencia · casi cuatro veces contra el corto BASE (4,38×)", r: ge3, dispara: false,
    texto: "Eso te deja $152.894 de flujo libre sobre el dividendo, casi cuatro veces el flujo del corto hoy." },
  { nombre: "con licencia · la mitad de la banda", r: { ...ge3, occFinal: 0.29 }, dispara: false,
    texto: "La ocupación observada es la mitad de la banda típica de la comuna." },
  { nombre: "sin múltiplos · lead de GE-2", r: ge3, dispara: false,
    texto: "La zona observa 47% de ocupación —bajo la banda típica de la comuna— y con ese piso el depto no se paga solo bajo ningún esquema pasivo." },
  { nombre: "cifra en vez de múltiplo", r: ge3, dispara: false,
    texto: "Autogestionando te ahorras $141.552 al mes y el flujo mensual queda positivo." },
  // ── GE-1 v16 (goal guards STR (b)) ──
  { nombre: "GE-1 · titular: triplica el neto del largo (NOI 2,98×, licencia)", r: ge1, dispara: false,
    texto: "Arriéndalo por día: **el mercado corto ya triplica el neto del largo**." },
  { nombre: "GE-1 · casi tres veces más en NOI neto (sujeto pegado después, licencia)", r: ge1, dispara: false,
    texto: "Operando por día te quedan $14.747 al mes, pagado todo, con la ocupación que el mercado estima para este depto: el corto le saca al largo casi tres veces más en NOI neto, lo que es la razón más fuerte para optar por Airbnb aquí." },
  { nombre: "GE-1 · triplica el neto con NOI 2,4× (sin licencia)", r: { ...ge1, noiCorto: 506_000 }, dispara: true, contiene: "NOI corto/NOI largo = 2.40",
    texto: "Arriéndalo por día: el mercado corto ya triplica el neto del largo." },
  { nombre: "GE-1 · casi duplica la estimación (tarifa 1,58×)", r: ge1, dispara: true, contiene: "tarifa/p50 de la zona = 1.58",
    texto: "Pusiste una tarifa que casi duplica la estimación de mercado de $47.496 para este depto." },
  { nombre: "GE-1 · casi dobla la estimación (tarifa 1,58×)", r: ge1, dispara: true, contiene: "tarifa/p50 de la zona = 1.58",
    texto: "el corto descansa en una tarifa por noche que el usuario definió a mano y que casi dobla la estimación de mercado." },
  { nombre: "GE-1 · dobla la del mercado (tarifa 1,58×)", r: ge1, dispara: true, contiene: "tarifa/p50 de la zona = 1.58",
    texto: "Conviene arrendarlo por día: la tarifa que pusiste dobla la del mercado." },
  { nombre: "casi dobla con 1,85× (licencia)", r: { ...ge1, adrFinal: 87_900 }, dispara: false,
    texto: "la tarifa que pusiste casi dobla la estimación de mercado." },
  { nombre: "sin dato en un par y con dato en otro: gana el que tiene dato", r: { ...ge1, flujoLargo: null }, dispara: false,
    texto: "Te quedan $14.747 al mes y el corto le saca al largo casi tres veces más en NOI neto." },
];

for (const c of casos) {
  const v = violacionesHeroClaimStr(c.texto, c.r);
  if (c.dispara && v.length === 0) F(`${c.nombre}: debía disparar y no disparó`);
  if (!c.dispara && v.length > 0) F(`${c.nombre}: no debía disparar y dio ${v.join(" | ")}`);
  if (c.dispara && c.contiene && !v.some((x) => x.includes(c.contiene!))) F(`${c.nombre}: esperaba «${c.contiene}» en ${v.join(" | ")}`);
}

console.log("\n[HERO-CLAIM] STR · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
