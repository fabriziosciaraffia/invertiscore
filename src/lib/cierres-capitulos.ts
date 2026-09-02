// ─────────────────────────────────────────────────────────────────────────────
// CIERRES FUSIONADOS DE LOS CAPÍTULOS I · IV · V (contrato CONGELADO 02-sep-2026,
// ramas aprobadas por Fabrizio el 02-sep con tres ajustes).
//
// Son DETERMINISTAS: cero prosa IA. Cada cierre es una cadena de oraciones y
// cada oración tiene sus ramas con condición; el cierre final es la concatenación
// de la rama que aplica. Devuelven SEGMENTOS (texto + si lleva plumón) para que el
// render pinte el <mark> sin que esta capa sepa de React.
//
// Doctrina: el cierre no emite veredicto (ajuste (b) de Fabrizio: la C3 del V
// deja el hecho y el lector concluye). Los veredictos citados van en MAYÚSCULAS
// como en el resto del informe.
// ─────────────────────────────────────────────────────────────────────────────

import type { Veredicto } from "@/lib/types";

export type SegCierre = { t: string; mark?: boolean };

/** Formateadores que aporta el caller (dueño de moneda y UF). */
export interface FmtCierre {
  money: (n: number) => string;
  compact: (n: number) => string;
  pct1: (n: number) => string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Margen de sensibilidad como lo muestra el informe: entero sin decimal (6%), coma si no (6,2%). */
const fmtMargin = (n: number, pct1: (n: number) => string) => (Number.isInteger(n) ? String(n) : pct1(n));
const fmtMult = (n: number) => `×${n.toFixed(2).replace(".", ",")}`;

/** "tres décimas" / "1,2 puntos" — la brecha del cap rate en palabras. */
export function brechaEnPalabras(gapPts: number, pct1: (n: number) => string): string {
  const abs = Math.abs(gapPts);
  if (abs < 1) {
    const dec = Math.max(1, Math.round(abs * 10));
    const palabras = ["", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    return dec === 1 ? "una décima" : `${palabras[dec] ?? dec} décimas`;
  }
  return `${pct1(abs)} puntos`;
}

// ═══════════ CIERRE I · Cuánto renta (cap rate + colchón del arriendo) ═══════════

export interface ArgsCierreRenta {
  arriendo: number;
  gapPts: number;
  capRefPct: number;
  /** Arriendo al que rendirías como el mercado: (capRef × precio + gastos) / 12. */
  arriendoRef: number;
  sens: { marginPct: number; firme: boolean; veredictoBase: Veredicto; veredictoNuevo: Veredicto | null; corteAdverso: number; corteFavorable: number } | null;
  /** Palanca más barata de distancia_veredicto (null = estructural, ausente o base COMPRAR). */
  arriba: { palanca: "arriendo" | "precio" | "plazo" | "pie" | "adr" | "gestion"; deltaPct: number; objetivo: number; veredictoObjetivo: Veredicto } | null;
  /** La vía del ARRIENDO con su estado (goal "cuatro palancas siempre"): con `noCruza`
   *  la rama C2 cita el tope que el motor exploró; ausente en filas viejas. */
  viaArriendo?: { estado: "cruza"; deltaPct: number } | { estado: "noCruza"; topeExplorado: number } | { estado: "noAplica" } | null;
}

export function cierreRenta(a: ArgsCierreRenta, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const ref = `${f.pct1(a.capRefPct)}%`;
  // Oración A · dónde cae el cap rate (banda neutral ±0,2 del hallazgo)
  if (a.gapPts <= -0.2) {
    segs.push({ t: `Hoy arriendas en ${f.money(a.arriendo)} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} bajo la referencia (${ref}); para rendir como el mercado necesitarías cerca de ${f.money(a.arriendoRef)} al mes. ` });
  } else if (a.gapPts >= 0.2) {
    segs.push({ t: `Hoy arriendas en ${f.money(a.arriendo)} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} sobre la referencia (${ref}): incluso arrendando en ${f.money(a.arriendoRef)} rendirías como el mercado, hay holgura. ` });
  } else {
    segs.push({ t: `Hoy arriendas en ${f.money(a.arriendo)} y rindes en línea con la referencia (${ref}): el arriendo declarado es justo el que el mercado paga por este precio. ` });
  }
  // Oración B · el colchón hacia abajo (marginPct a 1 decimal, como el drawer)
  if (a.sens) {
    const s = a.sens;
    const margin = round1(s.marginPct);
    const nuevo = s.veredictoNuevo ?? "";
    if (s.firme || !s.veredictoNuevo) {
      // Verificado en sensibilidad-hallazgo.ts: `firme` = no cambia ni a −50%.
      segs.push({ t: "Hacia abajo el veredicto es firme: ", mark: true }, { t: "ni con el arriendo a la mitad cambia. " });
    } else if (margin < s.corteAdverso) {
      segs.push(
        { t: "Y el colchón hacia abajo es acotado: " },
        { t: `si el arriendo real resultara apenas un ${fmtMargin(margin, f.pct1)}% más bajo, el veredicto pasa a ${nuevo}`, mark: true },
        { t: ". Antes de firmar, confirma ese arriendo contra publicaciones reales de la zona. " },
      );
    } else if (margin < s.corteFavorable) {
      segs.push(
        { t: "El colchón hacia abajo existe pero es corto: " },
        { t: `aguanta hasta un ${fmtMargin(margin, f.pct1)}% menos de arriendo antes de pasar a ${nuevo}`, mark: true },
        { t: ". Confírmalo contra publicaciones reales de la zona. " },
      );
    } else {
      segs.push(
        { t: "Hacia abajo aguanta: " },
        { t: `el arriendo tendría que caer un ${fmtMargin(margin, f.pct1)}% para pasar a ${nuevo}`, mark: true },
        { t: ", más de lo que se ve entre publicaciones de una misma zona. " },
      );
    }
  }
  // Oración C · hacia arriba (solo si la base no es COMPRAR y hay palanca)
  if (a.arriba && a.sens?.veredictoBase !== "COMPRAR") {
    const p = a.arriba;
    const obj = p.veredictoObjetivo;
    if (p.palanca === "arriendo" && p.objetivo > 0) {
      const pct = Math.abs(p.deltaPct);
      segs.push({ t: `Hacia arriba, subir a ${obj} por el arriendo pediría un +${f.pct1(pct)}%: ${pct <= 30 ? "posible solo si el mercado lo valida" : "fuera de lo que un ajuste puede dar"}.` });
    } else if (p.palanca === "precio") {
      // Goal "cuatro palancas siempre": la cifra del arriendo es la que emite el motor
      // (el tope explorado de la vía `noCruza`); nada de bisección en render. Sin
      // `vias` (filas viejas) la frase queda sin cifra, como antes.
      const va = a.viaArriendo;
      segs.push({
        t:
          va && va.estado === "noCruza"
            ? `Hacia arriba no hay palanca en el arriendo: subir a ${obj} pediría más de un +${va.topeExplorado}%, fuera de lo que un ajuste puede dar; la del precio sí existe (capítulo III).`
            : "Hacia arriba no hay palanca en el arriendo; la del precio sí existe (capítulo III).",
      });
    } else if (p.palanca === "plazo" || p.palanca === "pie") {
      segs.push({ t: "Hacia arriba la palanca no es el arriendo sino cómo lo pagas (capítulo III)." });
    }
  }
  segs[segs.length - 1].t = segs[segs.length - 1].t.trimEnd();
  return segs;
}

// ═══════════ CIERRE IV · Cuánto crece (comuna + proyección + en verde) ═══════════

export interface ArgsCierrePlusvalia {
  comuna: string;
  anualizadaPct: number;
  refPct: number;
  gapPts: number;
  tieneData: boolean;
  /** Proyección estándar Franco, en % ("3"). */
  proyPct: string;
  preEntrega: { gananciaCLP: number; gananciaPct: number; aniosEspera: number } | null;
}

export function cierrePlusvalia(a: ArgsCierrePlusvalia, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const anual = `${f.pct1(a.anualizadaPct)}%`;
  const ref = `${f.pct1(a.refPct)}%`;
  // Oración A · la comuna contra la referencia — y su B, que cierra la frase
  if (!a.tieneData) {
    segs.push(
      { t: `${a.comuna} no tiene serie propia y Franco usa el promedio del Gran Santiago (${anual} real al año): el histórico acá no dice nada de esta comuna en particular, ` },
      // Ajuste (a) de Fabrizio: A0 lleva su propia B.
      { t: `y la proyección de Franco usa ese mismo ${a.proyPct}%: no hay historia de esta comuna que la respalde ni la contradiga.`, mark: true },
    );
  } else if (a.anualizadaPct < 0) {
    segs.push(
      { t: `${a.comuna} perdió valor real en la década (${anual} al año), ` },
      { t: `y Franco proyecta ${a.proyPct}% igual: todo lo que sigue en este informe supone que la comuna revierte una década en la que perdió valor real.`, mark: true },
    );
  } else if (a.gapPts <= -0.3) {
    segs.push(
      { t: `${a.comuna} subió menos que la referencia (${anual} real al año contra ${ref}), ` },
      { t: `y Franco proyecta ${a.proyPct}% igual: todo lo que sigue en este informe supone que la comuna hace en la próxima década lo que no hizo en la anterior.`, mark: true },
    );
  } else if (a.gapPts >= 0.3) {
    segs.push(
      { t: `${a.comuna} subió más que la referencia (${anual} real al año contra ${ref}), ` },
      { t: `pero Franco proyecta ${a.proyPct}% parejo, no ese ritmo`, mark: true },
      { t: ": si la comuna repite su década este informe se queda corto, y si no la repite, no estás contando con algo que no ocurrió." },
    );
  } else {
    segs.push(
      { t: `${a.comuna} subió al ritmo de la referencia (${anual} real al año), y la proyección de Franco la da por hecha: ` },
      { t: `el histórico no es garantía, y todo lo que sigue en este informe descansa en ese ${a.proyPct}%`, mark: true },
      { t: "." },
    );
  }
  // Oración C · el tramo en verde (umbral 10%, decisión (2) de Fabrizio)
  if (a.preEntrega && a.preEntrega.aniosEspera > 0 && a.preEntrega.gananciaCLP > 0) {
    const pe = a.preEntrega;
    const anios = pe.aniosEspera === 1 ? "un año" : `${pe.aniosEspera} años`;
    if (pe.gananciaPct < 10) {
      segs.push({ t: ` El tramo en verde es real pero chico, ${f.compact(pe.gananciaCLP)} en ${anios}, y solo se cobra si la comuna cumple.` });
    } else {
      segs.push({ t: ` El tramo en verde pesa: ${f.compact(pe.gananciaCLP)} en ${anios} antes de pagar la primera cuota, y solo se cobra si la comuna cumple.` });
    }
  }
  return segs;
}

// ═══════════ CIERRE V · Tu resultado a 10 años (composición + mult + caja) ═══════════

export interface ArgsCierreResultado {
  comuna: string;
  patrimonioCLP: number;
  aportadoCLP: number;
  pieCLP: number;
  amortizacionCLP: number;
  multiplicador: number;
  sinCapitalPropio: boolean;
  flujoAcumulado: number;
  /** Suma absoluta de los años con flujo negativo (lo que puso el bolsillo). */
  bolsilloCLP: number;
  tirPct: number | null;
  /** Depósito a plazo del costo de oportunidad (misma plata inicial). */
  depositoCLP: number;
  proyPct: string;
}

export function cierreResultado(a: ArgsCierreResultado, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const plusvaliaNeta = a.patrimonioCLP - a.pieCLP - a.amortizacionCLP;
  const pctPie = a.patrimonioCLP > 0 ? (a.pieCLP / a.patrimonioCLP) * 100 : 100;
  const sinPlusCLP = a.pieCLP + a.amortizacionCLP;
  // Oración A · de dónde sale tu parte
  if (a.sinCapitalPropio) {
    segs.push({ t: `Sin pie, todo lo que es tuyo al año 10 lo puso el arriendo amortizando deuda (${f.compact(a.amortizacionCLP)}) y la plusvalía (${f.compact(plusvaliaNeta)}). ` });
  } else if (plusvaliaNeta < 0) {
    segs.push({ t: "Tu parte es menos que el pie más lo que amortizó el arriendo: la plusvalía proyectada no alcanza a cubrir la comisión de venta. " });
  } else if (pctPie < 50) {
    segs.push({ t: `Más de la mitad de tu parte no salió de tu bolsillo: la puso el arriendo pagando deuda (${f.compact(a.amortizacionCLP)}) y la plusvalía (${f.compact(plusvaliaNeta)}). ` });
  } else {
    segs.push({ t: `La mayor parte de tu parte es tu propio pie que vuelve: el arriendo amortizó ${f.compact(a.amortizacionCLP)} y la plusvalía suma ${f.compact(plusvaliaNeta)}. ` });
  }
  // Oración B · la caja (signo del flujo acumulado a 10 años)
  const tir = a.tirPct != null ? `el ${f.pct1(a.tirPct)}%` : "el resultado";
  if (a.flujoAcumulado < 0) {
    segs.push(
      { t: "Pero " },
      { t: "uno de los tres motores del retorno resta en vez de sumar", mark: true },
      { t: `, la caja te pide ${f.compact(a.bolsilloCLP)} en diez años, y ${tir} ya lo trae descontado. ` },
    );
  } else {
    segs.push({ t: `Y los tres motores suman: la caja deja ${f.compact(a.flujoAcumulado)} en diez años, ya contados en ${tir}. ` });
  }
  // Oración C · firme contra proyectado (por multiplicador; remate contra el depósito)
  const remate =
    sinPlusCLP <= a.depositoCLP
      ? "el negocio se parece más al depósito que al depto"
      : `sigues sobre el depósito, con ${f.compact(sinPlusCLP)} contra ${f.compact(a.depositoCLP)}`;
  const mult = fmtMult(a.multiplicador);
  if (a.sinCapitalPropio) {
    segs.push({ t: `Sin pie no hay multiplicador que leer: lo que cuenta es que la plusvalía sea real; sin el ${a.proyPct}% en ${a.comuna} te quedas con ${f.compact(sinPlusCLP)}.` });
  } else if (a.multiplicador >= 2) {
    segs.push({ t: `La amortización es firme; la plusvalía, proyección: si ${a.comuna} no rinde el ${a.proyPct}%, ${remate}.` });
  } else if (a.multiplicador >= 1) {
    segs.push({ t: `Terminas sobre lo puesto (${mult}) pero sin holgura: la amortización es firme y la plusvalía es proyección; sin ese ${a.proyPct}% en ${a.comuna}, ${remate}.` });
  } else {
    // Ajuste (b) de Fabrizio: queda el hecho, sin la frase-veredicto.
    segs.push({ t: `Terminas con menos de lo que pusiste (${mult}) incluso con la plusvalía proyectada; sin ella te quedan ${f.compact(sinPlusCLP)} de ${f.compact(a.aportadoCLP)}.` });
  }
  return segs;
}
