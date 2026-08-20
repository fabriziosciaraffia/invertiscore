// ============================================================================
// ZONA ↔ PROSA — catch-test (determinístico, 0 tokens)
// ============================================================================
// Fija la jerarquía de la mediana comunal que publica la sección de zona
// (resolverMedianaZona). El caso que motivó el fix: con el motor en
// `precioVsComuna.confiable = false` y SIN snapshot, la zona publicaba su propia
// mediana viva y quedaba como única voz comparando contra la comuna — algo que
// la prosa tiene prohibido por REGLA 0. Medido en el parque: 10 de 119.
//
//   node --import tsx scripts/eval/golden/zona-catch-test.ts
// ============================================================================

import { resolverMedianaZona } from "../../../src/lib/zone-insight-core";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

const LIVE = { tuDepto: 0, medianaComuna: 103.18, diffPct: 0 };

console.log("── el snapshot manda cuando existe ──");
{
  const r = resolverMedianaZona({ medSnap: { mediana: 93.1, n: 229, universo: "usado" }, pvcMotor: { confiable: true, desviacionPct: 1 }, precioM2Live: LIVE });
  check("usa la mediana del snapshot, no la viva", r.precioM2?.medianaComuna === 93.1, String(r.precioM2?.medianaComuna));
  check("el universo viaja con la cifra", r.universo === "usado");
}
{
  // snapshot presente con mediana null = "acá no hay mediana confiable"
  const r = resolverMedianaZona({ medSnap: { mediana: null, n: 0 }, pvcMotor: { confiable: false, desviacionPct: null }, precioM2Live: LIVE });
  check("snapshot con mediana null ⇒ la zona no compara", r.precioM2 === null);
}
{
  const r = resolverMedianaZona({ medSnap: { mediana: 93.1, n: 229 }, pvcMotor: null, precioM2Live: LIVE });
  check("snapshot sin universo ⇒ la zona no rotula el mercado", r.precioM2?.medianaComuna === 93.1 && r.universo === undefined);
}
{
  // La query viva puede venir vacía: el snapshot igual construye la comparación.
  const r = resolverMedianaZona({ medSnap: { mediana: 88.4, n: 151, universo: "nuevo" }, pvcMotor: { confiable: true }, precioM2Live: null });
  check("sin query viva, el snapshot construye precioM2", r.precioM2?.medianaComuna === 88.4 && r.precioM2?.tuDepto === 0);
}

console.log("── REGRESIÓN: sin snapshot, la zona acata al motor ──");
{
  // e42f9e9f / 8bda5e13 / 860f5607: motor con confiable:false y snapshot ausente.
  const r = resolverMedianaZona({ medSnap: null, pvcMotor: { confiable: false, desviacionPct: null }, precioM2Live: LIVE });
  check("motor no-confiable ⇒ la zona NO publica mediana", r.precioM2 === null, JSON.stringify(r.precioM2));
}
{
  const r = resolverMedianaZona({ medSnap: undefined, pvcMotor: { confiable: false, desviacionPct: null }, precioM2Live: LIVE });
  check("snapshot undefined (no solo null) también acata", r.precioM2 === null);
}
{
  const r = resolverMedianaZona({ medSnap: null, pvcMotor: { desviacionPct: null }, precioM2Live: LIVE });
  check("pvc sin flag `confiable` ⇒ se trata como NO confiable", r.precioM2 === null);
}
{
  const r = resolverMedianaZona({ medSnap: null, pvcMotor: { confiable: true, desviacionPct: 9.3 }, precioM2Live: LIVE });
  check("motor confiable sin snapshot ⇒ la query viva sirve", r.precioM2?.medianaComuna === 103.18);
}

console.log("── legacy: sin snapshot y sin opinión del motor ──");
{
  const r = resolverMedianaZona({ medSnap: null, pvcMotor: undefined, precioM2Live: LIVE });
  check("fallback histórico intacto", r.precioM2?.medianaComuna === 103.18);
}
{
  const r = resolverMedianaZona({ medSnap: null, pvcMotor: undefined, precioM2Live: null });
  check("sin nada, no hay comparación", r.precioM2 === null);
}

console.log(fallas === 0 ? "\n✓ VERDE — la zona nunca compara contra una comuna que el motor rechazó" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
