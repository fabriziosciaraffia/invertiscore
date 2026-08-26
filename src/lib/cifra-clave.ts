// ─────────────────────────────────────────────────────────────────────────────
// cifraClave — la cifra de la portada del informe (FASE 2 rediseño Dictamen).
//
// Contrato (fase2-contrato-titular-v2, §0 + §2, cerrado 25-ago-2026): el titular
// IA NO lleva montos en moneda; la cifra visceral vive en `cifraClave` y la
// emite el MOTOR por regla determinística — la IA no la elige, no la calcula y
// NO escribe su caption: el caption sale del catálogo cerrado de Fabrizio
// (strings verbatim abajo). Caso sin caption → el render no muestra caption;
// nunca un fallback genérico.
//
// DERIVACIÓN EN RUNTIME, no persistida: función pura sobre results ya
// existentes, así los informes cacheados la obtienen gratis al abrirse (cero
// backfill). Consumidores: el user prompt (contexto para que el titular no
// contradiga la cifra, FASE 2) y la portada nueva (FASE 3).
//
// Árbol de selección (del contrato; las dos decisiones de borde son de
// implementación y quedan a revisión en el PARÁ 2 con outputs a la vista):
//   · COMPRAR con flujo mensual > 0            → excedente mensual.
//   · AJUSTA con flujo mensual < 0             → aporte de bolsillo; si la
//     palanca más barata es el pie, el caption apunta a la corrección
//     (`ajusta_palanca_pie`); si no, el caption genérico de flujo negativo.
//   · AJUSTA con flujo ≥ 0 y palanca = precio  → % de descuento requerido
//     (SIN signo — contrato §2.bis). Leemos "flujo ~neutro" del contrato como
//     "no negativo": cero umbrales mágicos inventados.
//   · Cualquier veredicto con flujo < 0        → aporte de bolsillo (visceral).
//   · STR: mismas reglas sobre el escenario BASE; además AJUSTA con palanca de
//     gestión hacia auto → AHORRO mensual de la comisión (nunca "ganancia" —
//     el flujo puede seguir negativo).
//   · Nada aplica → null (sin cifra; mejor ausencia que cifra equivocada).
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto, PalancaDistancia } from "./types";

export type CifraClaveCaso =
  | "flujo_negativo_ltr"
  | "flujo_negativo_str"
  | "comprar_excedente"
  | "ajusta_palanca_pie"
  | "ajusta_palanca_precio"
  | "ajusta_str_autogestion";

export type CifraClave =
  | {
      tipo: "monto";
      caso: Exclude<CifraClaveCaso, "ajusta_palanca_precio">;
      /** CLP/mes, SIEMPRE positivo — el sentido lo declara `signo`. */
      valorClp: number;
      /** Mismo monto en UF (crudo; el render formatea y respeta el toggle). */
      valorUf: number;
      /** -1 = plata que sale de tu bolsillo · +1 = plata que queda/ahorras. */
      signo: -1 | 1;
    }
  | {
      tipo: "pct";
      caso: "ajusta_palanca_precio";
      /** % de descuento requerido, SIN signo (contrato §2.bis). */
      valorPct: number;
    };

/**
 * Catálogo CERRADO por Fabrizio (§2.bis, sesión 25-ago-2026) — strings
 * verbatim, la IA no escribe captions. Reglas: ≤10 palabras, minúscula
 * inicial, sin punto final, sin dígitos, tuteo chileno neutro.
 */
export const CIFRA_CLAVE_CAPTIONS: Record<CifraClaveCaso, string> = {
  flujo_negativo_ltr: "que salen de tu bolsillo todos los meses",
  flujo_negativo_str: "que salen de tu bolsillo mensualmente operándolo en renta corta",
  comprar_excedente: "que te quedan disponibles por mes, pagado todo",
  ajusta_palanca_pie: "al mes de tu bolsillo — se corrige con más pie",
  ajusta_palanca_precio: "de descuento y el negocio funciona",
  ajusta_str_autogestion: "de ahorro al mes si lo administras tú directamente",
};

const monto = (
  caso: Exclude<CifraClaveCaso, "ajusta_palanca_precio">,
  clp: number,
  ufValue: number,
  signo: -1 | 1,
): CifraClave => ({
  tipo: "monto",
  caso,
  valorClp: Math.round(Math.abs(clp)),
  valorUf: Math.abs(clp) / ufValue,
  signo,
});

function palancaBarata(distancia: HallazgoDistanciaVeredicto | null | undefined): PalancaDistancia | null {
  return distancia?.valor?.palancaMasBarata ?? null;
}

/** LTR — deriva la cifra de portada desde datos que results ya tiene. */
export function derivarCifraClaveLtr(p: {
  veredicto: string;
  /** metrics.flujoNetoMensual (CLP signed). */
  flujoNetoMensual: number;
  distancia: HallazgoDistanciaVeredicto | null | undefined;
  ufValue: number;
}): CifraClave | null {
  const flujo = p.flujoNetoMensual;
  if (!Number.isFinite(flujo) || p.ufValue <= 0) return null;

  if (p.veredicto === "COMPRAR" && flujo > 0) return monto("comprar_excedente", flujo, p.ufValue, 1);

  if (p.veredicto === "AJUSTA SUPUESTOS") {
    const palanca = palancaBarata(p.distancia);
    if (flujo < 0) {
      return palanca?.palanca === "pie"
        ? monto("ajusta_palanca_pie", flujo, p.ufValue, -1)
        : monto("flujo_negativo_ltr", flujo, p.ufValue, -1);
    }
    if (palanca?.palanca === "precio" && Number.isFinite(palanca.deltaPct)) {
      const pct = Math.round(Math.abs(palanca.deltaPct as number));
      if (pct > 0) return { tipo: "pct", caso: "ajusta_palanca_precio", valorPct: pct };
    }
    return null;
  }

  if (flujo < 0) return monto("flujo_negativo_ltr", flujo, p.ufValue, -1);
  return null;
}

/** STR — mismas reglas sobre el escenario base (contrato §2). */
export function derivarCifraClaveStr(p: {
  veredicto: string;
  /** escenarios.base.flujoCajaMensual (CLP signed). */
  flujoBaseMensual: number;
  /** Ahorro mensual de pasar a auto-gestión (comisión del admin sobre el bruto
   *  base, CLP). null cuando el modo ya es auto o el dato no se puede armar. */
  ahorroAutogestionClpMes: number | null;
  distancia: HallazgoDistanciaVeredicto | null | undefined;
  ufValue: number;
}): CifraClave | null {
  const flujo = p.flujoBaseMensual;
  if (!Number.isFinite(flujo) || p.ufValue <= 0) return null;

  if (p.veredicto === "COMPRAR" && flujo > 0) return monto("comprar_excedente", flujo, p.ufValue, 1);

  if (p.veredicto === "AJUSTA SUPUESTOS") {
    const palanca = palancaBarata(p.distancia);
    // La palanca de gestión manda sobre el caption genérico: es la única que el
    // usuario resuelve solo (espejo de la doctrina del pie en LTR). El valor es
    // AHORRO (comisión que dejas de pagar) — el flujo puede seguir negativo.
    if (
      palanca?.palanca === "gestion" &&
      palanca.modoGestionObjetivo === "auto" &&
      p.ahorroAutogestionClpMes != null &&
      p.ahorroAutogestionClpMes > 0
    ) {
      return monto("ajusta_str_autogestion", p.ahorroAutogestionClpMes, p.ufValue, 1);
    }
    if (flujo < 0) return monto("flujo_negativo_str", flujo, p.ufValue, -1);
    return null;
  }

  if (flujo < 0) return monto("flujo_negativo_str", flujo, p.ufValue, -1);
  return null;
}

/** Caption del catálogo para una cifra ya derivada (null-safe para el render). */
export function captionDeCifraClave(cifra: CifraClave | null | undefined): string | null {
  return cifra ? CIFRA_CLAVE_CAPTIONS[cifra.caso] ?? null : null;
}
