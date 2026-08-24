// ============================================================================
// MEDIACIÓN DE CARDS — catch-test (determinístico, 0 tokens)
// ============================================================================
// Dos capas de §1.12.8:
//   (B) encuadre — el favorable que dice decidir llega con su cláusula cuando el
//       veredicto está degradado;
//   (A) el hallazgo del gate — cuando un gate decide y NINGUNA card es adversa,
//       la causa del veredicto entra a la pirámide con decisividad MEDIDA.
//
//   node --import tsx scripts/eval/golden/mediacion-cards-catch-test.ts
// ============================================================================

import { aplicarEncuadreVeredicto, CLAUSULA_NO_DECIDE, tieneEncuadre } from "../../../src/lib/encuadre-veredicto";
import { buildHallazgoGateVeredicto, veredictoDeBanda } from "../../../src/lib/gate-veredicto-hallazgo";
import { ordenarHallazgosUnico } from "../../../src/lib/orden-hallazgos";
import type { Hallazgo } from "../../../src/lib/types";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

const hz = (over: Record<string, unknown> = {}) => ({
  id: "cap_rate", tipo: "cap_rate", titular: "T", fraseCanonica: "El metro rinde de sobra.",
  direccion: "favorable", decisividad: 1, procedencia: { base: "x", confianza: "alta" },
  valor: {}, ...over,
}) as unknown as Hallazgo;

console.log("── (B) encuadre por veredicto ──");
{
  const [h] = aplicarEncuadreVeredicto([hz()], "BUSCAR OTRA");
  check("favorable decisivo bajo BUSCAR OTRA recibe cláusula", h.fraseCanonica.includes(CLAUSULA_NO_DECIDE["BUSCAR OTRA"]));
  check("conserva el texto original", h.fraseCanonica.startsWith("El metro rinde de sobra."));
}
{
  const [h] = aplicarEncuadreVeredicto([hz()], "AJUSTA SUPUESTOS");
  check("AJUSTA usa su propia cláusula", h.fraseCanonica.includes(CLAUSULA_NO_DECIDE["AJUSTA SUPUESTOS"]));
}
{
  const orig = hz();
  const [h] = aplicarEncuadreVeredicto([orig], "COMPRAR");
  check("COMPRAR es no-op (misma referencia)", h === orig);
}
{
  const [h] = aplicarEncuadreVeredicto([hz({ decisividad: 0 })], "BUSCAR OTRA");
  check("favorable SIN decisividad no se toca", !tieneEncuadre(h.fraseCanonica));
}
{
  const [h] = aplicarEncuadreVeredicto([hz({ direccion: "adverso" })], "BUSCAR OTRA");
  check("adverso no se toca", !tieneEncuadre(h.fraseCanonica));
}
{
  const [h] = aplicarEncuadreVeredicto([hz({ direccion: "neutral" })], "BUSCAR OTRA");
  check("neutral no se toca", !tieneEncuadre(h.fraseCanonica));
}
{
  const una = aplicarEncuadreVeredicto([hz()], "BUSCAR OTRA");
  const dos = aplicarEncuadreVeredicto(una, "BUSCAR OTRA");
  check("idempotente (no duplica la cláusula)", dos[0].fraseCanonica === una[0].fraseCanonica);
}
{
  const [h] = aplicarEncuadreVeredicto([hz()], "VEREDICTO RARO");
  check("veredicto desconocido es no-op", !tieneEncuadre(h.fraseCanonica));
}

console.log("── (A) hallazgo del gate ──");
const base = { motivos: ["g1_regulacion"], glosas: { g1_regulacion: "Edificio no permite Airbnb — operación inviable" }, score: 78, veredictoFinal: "BUSCAR OTRA" };
{
  const g = buildHallazgoGateVeredicto({ ...base, hayAdverso: false })!;
  check("emite con gate + cero adversas", !!g && g.direccion === "adverso");
  check("decisividad medida = 1 (el gate mueve la banda)", g.decisividad === 1, `banda=${veredictoDeBanda(78)}`);
  check("la frase nombra el hecho y el flip", g.fraseCanonica.includes("Edificio no permite Airbnb") && g.fraseCanonica.includes("COMPRAR"));
}
{
  check("con una card adversa NO emite (el orden ya media)", buildHallazgoGateVeredicto({ ...base, hayAdverso: true }) === null);
}
{
  check("sin gate activo NO emite", buildHallazgoGateVeredicto({ ...base, motivos: [], hayAdverso: false }) === null);
}
{
  // El gate no mueve la banda: el veredicto ya salía de ahí ⇒ nada que mediar.
  check("sin flip de banda NO emite", buildHallazgoGateVeredicto({ ...base, score: 20, hayAdverso: false }) === null);
}
{
  check("motivo sin glosa NO emite", buildHallazgoGateVeredicto({ ...base, glosas: {}, hayAdverso: false }) === null);
}

console.log("── integración: el testigo deja de estar coronado por un favorable ──");
{
  const piramide = [
    hz({ id: "rentabilidad_str", tipo: "rentabilidad_str", decisividad: 1 }),
    hz({ id: "ventaja_vs_ltr", tipo: "ventaja_vs_ltr", decisividad: 1 }),
    hz({ id: "patrimonio", tipo: "patrimonio", decisividad: 0 }),
  ];
  const antes = ordenarHallazgosUnico(piramide);
  check("antes: el 01 es favorable", antes[0].direccion === "favorable");
  const g = buildHallazgoGateVeredicto({ ...base, hayAdverso: piramide.some((h) => h.direccion === "adverso") })!;
  const despues = ordenarHallazgosUnico(aplicarEncuadreVeredicto([...piramide, g], "BUSCAR OTRA"));
  check("después: el 01 es la causa del veredicto", despues[0].id === "gate_veredicto" && despues[0].direccion === "adverso");
  check("los favorables decisivos quedan subordinados", despues.filter((h) => tieneEncuadre(h.fraseCanonica ?? "")).length === 2);
  check("el de decisividad 0 sigue intacto", !tieneEncuadre(despues.find((h) => h.id === "patrimonio")!.fraseCanonica));
}

console.log(fallas === 0 ? "\n✓ VERDE — la pirámide acompaña al veredicto" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
