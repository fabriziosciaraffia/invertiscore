// ─────────────────────────────────────────────────────────────────────────────
// AVISO DE ESCALA EN EL CAMPO — wizard v4
//
// El campo entendió el número; lo que falla es su magnitud. Se AVISA, no se
// bloquea: el bloqueo duro sigue siendo el modal del resumen y el 422 del
// servidor. Sin esto, alguien escribe una tasa de 45% en el Acto 2 y se entera
// tres pantallas después.
//
// EL MENSAJE NO SE ESCRIBE ACÁ. Se le pregunta al guard corriendo
// `evaluarPlausibilidad` con SOLO ese campo poblado —el resto en NaN, que es lo
// que activa su fail-open— y se toma la anomalía de ese campo. Así el aviso
// temprano dice EXACTAMENTE lo mismo que va a decir el modal si igual se intenta
// generar, y no hay umbral ni copy duplicado en ningún archivo de pantalla.
//
// Solo los campos con regla PROPIA. UF/m² y los dos yields son derivados de dos
// campos: un input suelto no puede evaluarlos y siguen viviendo en el modal, que
// sí los tiene todos.
//
// POR QUÉ ESTE ARCHIVO EXISTE
// ───────────────────────────
// Esto nació duplicado: una copia en `screenResumen.tsx` y otra en
// `screensActo1.tsx` (que hacía de módulo compartido de los actos). Eran
// idénticas salvo por dos constantes que solo el resumen necesitaba. El repo ya
// había pagado ese costo antes —ver el comentario de `fuenteArriendoLine` en
// `derive.ts`: "tenerla duplicada ya costó una vez"— así que las dos se mudaron
// acá antes de que divergieran.
//
// Las CONVERSIONES DE UNIDAD no viven acá: son de la pantalla, porque dependen
// de en qué unidad está escribiendo el usuario en ese momento (el precio en $ se
// divide por la UF; el pie sale crudo en "%" y derivado en UF/$). Este módulo
// recibe siempre el valor ya expresado en la unidad de la regla.
// ─────────────────────────────────────────────────────────────────────────────

import {
  evaluarPlausibilidad,
  type Anomalia,
  type PlausibilidadInput,
} from "@/lib/plausibilidad";

/** Nada poblado: cada regla necesita sus insumos finitos, y NaN las apaga. */
const SIN_INSUMOS: PlausibilidadInput = { precioUF: NaN, superficieM2: NaN, ufCLP: NaN };

function avisoEscala(
  campo: Anomalia["campo"],
  soloEste: (valor: number) => Partial<PlausibilidadInput>,
): (valor: number) => string | null {
  return (valor) => {
    const anomalias = evaluarPlausibilidad({ ...SIN_INSUMOS, ...soloEste(valor) });
    return anomalias.find((x) => x.campo === campo)?.mensaje ?? null;
  };
}

export const escalaPrecio = avisoEscala("precio", (v) => ({ precioUF: v }));
export const escalaSuperficie = avisoEscala("superficie", (v) => ({ superficieM2: v }));
export const escalaTasa = avisoEscala("tasa", (v) => ({ tasaAnualPct: v }));
export const escalaPie = avisoEscala("pie", (v) => ({ piePct: v }));
export const escalaArriendo = avisoEscala("arriendo", (v) => ({ arriendoMensualCLP: v }));
export const escalaVacancia = avisoEscala("vacancia", (v) => ({ vacanciaPct: v }));
export const escalaComision = avisoEscala("comisionAdmin", (v) => ({ comisionAdminPct: v }));
export const escalaOcupacion = avisoEscala("ocupacion", (v) => ({ str: { ocupacionPct: v } }));
export const escalaTarifa = avisoEscala("tarifaNoche", (v) => ({ str: { tarifaNocheCLP: v } }));
