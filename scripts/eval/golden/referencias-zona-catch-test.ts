// ============================================================================
// REFERENCIAS DE ZONA — catch-test (determinístico, 0 tokens)
// ============================================================================
// Fija el contrato del bloque de ámbitos: las dos referencias de valor (radio y
// comuna) siempre llegan al prompt DECLARADAS, y cuando apuntan a lados opuestos
// el encuadre conjunto viene pre-escrito. Caso testigo: 05462488 ("entras barato
// −7%" vs "107% sobre el valor de zona" en la misma prosa).
//
// Incluye el guard de NO descalibración: este bloque narra, no calcula, así que
// la pata `vm` de la detección precio-justo (esCasoPrecioJusto) tiene que seguir
// dando lo mismo con y sin él.
//
//   node --import tsx scripts/eval/golden/referencias-zona-catch-test.ts
// ============================================================================

import { construirReferenciasZona } from "../../../src/lib/referencias-zona";
import { esCasoPrecioJusto } from "../../../src/lib/distancia-veredicto-hallazgo";

let fallas = 0;
const check = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallas++;
};

const BASE = {
  precioPedidoUF: 2000,
  superficieM2: 50,
  vmFrancoUF: 2000,
  tieneDiferenciaValida: true,
  radioMetros: 800,
  sampleSizeVenta: 9,
  medianaComunaUfM2: 40,
  desviacionPct: 0,
  medianaConfiable: true,
  nComuna: 229,
  universo: "usado" as const,
  sujetoUfM2: 40,
};

console.log("── ámbitos declarados ──");
{
  const r = construirReferenciasZona(BASE);
  check("nombra el ámbito RADIO con su distancia y n", /ámbito: RADIO/.test(r.bloque) && /800 m/.test(r.bloque) && /n=9/.test(r.bloque));
  check("nombra el ámbito COMUNA con universo y n", /ámbito: COMUNA COMPLETA/.test(r.bloque) && /USADOS/.test(r.bloque) && /n=229/.test(r.bloque));
  check("prohíbe 'la zona' a secas", /nunca "bajo el valor de la zona" a secas/.test(r.bloque));
  check("asigna qué manda para cada pregunta", /manda la MEDIANA DE LA COMUNA/.test(r.bloque) && /manda el VALOR ESTIMADO DEL ACTIVO/.test(r.bloque));
}

console.log("── el testigo: signos opuestos ──");
{
  // Precio 2000 sobre un vm de 1000 (radio) = +100%; mediana comunal por encima
  // del sujeto = −7% (entras barato). Las dos lecturas, lados opuestos.
  const r = construirReferenciasZona({ ...BASE, vmFrancoUF: 1000, medianaComunaUfM2: 43, desviacionPct: -7 });
  check("detecta signos opuestos", r.signosOpuestos === true);
  check("entrega el encuadre conjunto pre-escrito", /APUNTAN A LADOS OPUESTOS/.test(r.bloque) && /en la MISMA frase/.test(r.bloque));
  check("el encuadre nombra los dos ámbitos", /bajo la mediana/.test(r.bloque) && /tu propia cuadra/.test(r.bloque));
}
{
  const r = construirReferenciasZona({ ...BASE, vmFrancoUF: 1800, desviacionPct: 8 });
  check("mismo signo ⇒ sin encuadre de conflicto", r.signosOpuestos === false && !/LADOS OPUESTOS/.test(r.bloque));
}

console.log("── sin mediana confiable: la prosa calla ──");
{
  const r = construirReferenciasZona({ ...BASE, medianaConfiable: false, medianaComunaUfM2: null, desviacionPct: null });
  check("declara SIN DATO CONFIABLE", /SIN DATO CONFIABLE/.test(r.bloque));
  check("prohíbe las tres formas de afirmarlo", /ni "sobre la mediana"/.test(r.bloque) && /ni "bajo la mediana"/.test(r.bloque) && /ni "en línea con la comuna"/.test(r.bloque));
  check("no puede haber conflicto sin la segunda referencia", r.signosOpuestos === false);
}
{
  // vm = precio (fallback sin comparables) ⇒ no es referencia y no se declara.
  const r = construirReferenciasZona({ ...BASE, tieneDiferenciaValida: false });
  check("vm inválido no se presenta como valor del activo", !/ámbito: RADIO/.test(r.bloque));
}

console.log("── NO descalibra la pata vm de precio-justo ──");
{
  // La detección es del motor y no toca este bloque: mismos insumos, mismo flag.
  const insumos = {
    desviacionPct: 0, precioUF: 2000, vmFrancoUF: 2040, ufClp: 39000,
    arriendoCLP: 420000, arriendoRefCLP: 420000, arriendoEsEstimacionFranco: false,
    veredicto: "AJUSTA SUPUESTOS" as const,
  };
  const antes = esCasoPrecioJusto(insumos);
  construirReferenciasZona({ ...BASE, vmFrancoUF: 2040 });
  const despues = esCasoPrecioJusto(insumos);
  check("esCasoPrecioJusto es estable (el bloque narra, no calcula)", antes === despues && antes === true, `${antes}/${despues}`);
  // Y el caso que la pata vm existe para rechazar: referencias en pugna.
  const enPugna = esCasoPrecioJusto({ ...insumos, vmFrancoUF: 3400 });
  check("vm divergente sigue rechazando precio-justo", enPugna === false);
}

console.log(fallas === 0 ? "\n✓ VERDE — las dos referencias llegan con ámbito y el conflicto viene encuadrado" : `\n✗ ${fallas} falla(s)`);
process.exit(fallas === 0 ? 0 : 1);
