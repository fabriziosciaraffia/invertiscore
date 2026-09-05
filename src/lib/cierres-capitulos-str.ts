// ─────────────────────────────────────────────────────────────────────────────
// CIERRES DETERMINISTAS DE LOS CAPÍTULOS STR · I–VI (contrato mockup-str-CONGELADO.html,
// T0 · 04-sep-2026). Mismo estilo que `cierres-capitulos.ts` (LTR): cero prosa IA, cada
// cierre es una cadena de oraciones con ramas por condición y devuelve SEGMENTOS (texto +
// si lleva plumón) para que el render pinte el <mark>.
//
// Doctrina: el cierre no emite veredicto; cita los que el motor midió, en MAYÚSCULAS. Las
// cifras vienen del motor (metrics, simularStr, distancia_veredicto, comparativa,
// zonaSTR); acá no se recalcula nada. El VI reusa `cierreResultado` de LTR: la composición
// de tu parte, el multiplicador y la caja son los mismos conceptos.
// ─────────────────────────────────────────────────────────────────────────────
import type { Veredicto } from "./types";
import { brechaEnPalabras, type FmtCierre, type SegCierre } from "./cierres-capitulos";
import type { FronterasIngresoStr, MatrizTarifaOcupacion, MatrizPiePlazoStr } from "./analysis/simular-str";
import type { OcupacionVsComuna } from "./engines/str-universo-santiago";
import { DIST_STR_TOPE_ADR_PCT } from "./distancia-veredicto-str-hallazgo";

export { cierreResultado as cierreResultadoStr, type ArgsCierreResultado as ArgsCierreResultadoStr } from "./cierres-capitulos";

const trimUltimo = (segs: SegCierre[]) => {
  if (segs.length) segs[segs.length - 1].t = segs[segs.length - 1].t.trimEnd();
  return segs;
};
const fmtPctSigno = (n: number, pct1: (n: number) => string) => `${n >= 0 ? "+" : "−"}${pct1(Math.abs(n))}`;
/** Fracción en palabras, para comparar dos montos sin inventar un porcentaje. */
export function fraccionEnPalabras(parte: number, total: number): string | null {
  if (!(total > 0) || !(parte >= 0)) return null;
  const r = parte / total;
  if (r < 0.15) return "una fracción";
  if (r < 0.3) return "un cuarto";
  if (r < 0.4) return "un tercio";
  if (r < 0.6) return "la mitad";
  if (r < 0.72) return "dos tercios";
  if (r < 0.85) return "tres cuartos";
  if (r < 1.15) return "casi lo mismo";
  if (r < 1.7) return "una vez y media";
  if (r < 2.5) return "el doble";
  if (r < 3.5) return "el triple";
  return "varias veces";
}

// ═══════════ CIERRE I · Cuánto renta (cap rate + fronteras del ingreso + matriz) ═══════════

export interface ArgsCierreRentaStr {
  veredictoBase: Veredicto;
  /** Tarifa por noche del caso (CLP) y si es la mediana de la zona o un dato del usuario. */
  adr: number;
  adrEsDelUsuario: boolean;
  capPct: number;
  capRefPct: number;
  /** capPct − capRefPct, en puntos. */
  gapPts: number;
  /** Tarifa a la que rendirías como el umbral (CLP/noche). */
  adrRef: number;
  fronteras: FronterasIngresoStr | null;
  matriz: MatrizTarifaOcupacion | null;
}

export function cierreRentaStr(a: ArgsCierreRentaStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const ref = `${f.pct1(a.capRefPct)}%`;
  const cobras = a.adrEsDelUsuario ? `Cobras ${f.money(a.adr)} por noche, un dato tuyo,` : "Cobras la mediana de la zona";
  // Oración A · dónde cae el cap rate (banda neutral ±0,2 como el hallazgo)
  if (a.gapPts <= -0.2) {
    segs.push({ t: `${cobras} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} bajo el umbral (${ref}): para rendir como una renta corta necesitarías cerca de ${f.money(a.adrRef)} por noche. ` });
  } else if (a.gapPts >= 0.2) {
    segs.push({ t: `${cobras} y rindes ${brechaEnPalabras(a.gapPts, f.pct1)} sobre el umbral (${ref}): incluso cobrando ${f.money(a.adrRef)} por noche rendirías como una renta corta, hay holgura. ` });
  } else {
    segs.push({ t: `${cobras} y rindes en línea con el umbral (${ref}): la tarifa de la zona es justo la que hace que este precio se justifique. ` });
  }
  // Oración B · hacia arriba (frontera del ingreso)
  const fr = a.fronteras;
  if (a.veredictoBase !== "COMPRAR") {
    if (fr?.arriba && fr.tarifa.arriba != null) {
      const d = (fr.arriba.factor - 1) * 100;
      if (d <= DIST_STR_TOPE_ADR_PCT) {
        segs.push(
          { t: "Hacia arriba la frontera está cerca: " },
          { t: `si sostienes ${f.money(fr.tarifa.arriba)} por noche, un ${fmtPctSigno(d, f.pct1)}% sobre lo que hoy cobras, el veredicto sube a ${fr.arriba.veredicto}`, mark: true },
          { t: ". Es una apuesta a rendir sobre lo que hoy cobra la zona, no un supuesto que tú controlas. " },
        );
      } else {
        // Fuera del tope de honestidad de la tarifa (§1.12.4): se dice el hecho, no se ofrece.
        segs.push({ t: `Hacia arriba no hay ajuste realista: recién cobrando ${f.money(fr.tarifa.arriba)} por noche, un ${fmtPctSigno(d, f.pct1)}% sobre lo que hoy cobra la zona, cruzaría a ${fr.arriba.veredicto}, y eso ya no es un ajuste sino otro mercado. ` });
      }
    } else if (fr) {
      segs.push({ t: "Hacia arriba no hay frontera a la vista: ni con el triple de ingreso cambia el veredicto. " });
    }
  }
  // Oración C · hacia abajo (colchón)
  if (fr) {
    if (fr.abajo && fr.tarifa.abajo != null) {
      const colchon = a.adr - fr.tarifa.abajo;
      const d = (1 - fr.abajo.factor) * 100;
      segs.push(
        { t: d < 5 ? "Hacia abajo el colchón es mínimo: " : d < 15 ? "Hacia abajo el colchón es corto: " : "Hacia abajo aguanta: " },
        { t: `${f.money(colchon)} por noche antes de caer a ${fr.abajo.veredicto}`, mark: a.veredictoBase === "COMPRAR" },
        { t: ". " },
      );
    } else {
      segs.push({ t: "Hacia abajo el veredicto es firme: ni con el ingreso a un tercio cambia. " });
    }
  }
  // Oración D · la matriz: cruza aunque el mes quede negativo (la celda existe o no)
  const negCruza = a.matriz?.celdas.find((c) => c.cruza && c.flujoMensual < 0);
  if (negCruza) {
    segs.push(
      { t: `En la matriz, ${f.money(negCruza.tarifaCLP)} por noche con ${Math.round(negCruza.ocupacion * 100)}% de ocupación ` },
      { t: `cruza a ${negCruza.veredicto} aunque el mes quede en ${f.money(negCruza.flujoMensual)}: el veredicto lo decide el Franco Score, no el signo del mes`, mark: true },
      { t: ". " },
    );
  } else if (a.matriz && a.matriz.celdas.length) {
    const cruzan = a.matriz.celdas.filter((c) => c.cruza).length;
    if (cruzan > 0) segs.push({ t: `En la matriz, ${cruzan} de las ${a.matriz.celdas.length} combinaciones de tarifa y ocupación cruzan, todas cobrando más o con más ocupación que hoy. ` });
  }
  return trimUltimo(segs);
}

// ═══════════ CIERRE II · Tu flujo mensual (bolsillo + caja + largo + gestión) ═══════════

export interface ArgsCierreFlujoStr {
  flujoMensual: number;
  /** Pérdida por estabilización inicial (primeros meses), CLP. */
  estabilizacionCLP: number;
  /** Flujo del mismo depto arrendado largo (después de la cuota). */
  flujoLargo: number | null;
  /** Flujo con el otro modo de gestión. */
  flujoOtroModo: number | null;
  modo: "auto" | "administrador";
}

export function cierreFlujoStr(a: ArgsCierreFlujoStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const otro = a.modo === "auto" ? "con administrador" : "autogestionando";
  if (a.flujoMensual < 0) {
    segs.push(
      { t: `¿Tienes ${f.money(-a.flujoMensual)} disponibles cada mes sin comprometer otro gasto fijo, y ${f.money(a.estabilizacionCLP)} en caja para los primeros meses, cuando el aviso todavía no tiene reseñas y se ocupa menos?`, mark: true },
      { t: " " },
    );
    if (a.flujoLargo != null && a.flujoLargo < 0 && -a.flujoLargo > -a.flujoMensual) {
      const frac = fraccionEnPalabras(-a.flujoMensual, -a.flujoLargo);
      segs.push({ t: `No es una sangría: es ${frac ?? "menos de lo"} ${frac ? "de lo" : ""} que te pediría el mismo depto arrendado largo. `.replace("  ", " ") });
    } else if (a.flujoLargo != null && a.flujoLargo >= 0) {
      segs.push({ t: `Arrendado largo el mismo depto no te pediría plata: quedaría en ${f.money(a.flujoLargo)}. ` });
    }
    if (a.flujoOtroModo != null) {
      segs.push({ t: a.flujoOtroModo < a.flujoMensual ? `Pero es recurrente, y ${otro} sube a ${f.money(-a.flujoOtroModo)}.` : a.flujoOtroModo < 0 ? `Es recurrente; ${otro} baja a ${f.money(-a.flujoOtroModo)}.` : `Es recurrente; ${otro} el mes queda en ${f.money(a.flujoOtroModo)}.` });
    } else {
      segs.push({ t: "Es recurrente." });
    }
  } else {
    segs.push(
      { t: `Te quedan ${f.money(a.flujoMensual)} cada mes después de todo`, mark: true },
      { t: `, con la ocupación estimada. El primer año arranca con ${f.money(a.estabilizacionCLP)} de estabilización mientras el aviso gana reseñas. ` },
    );
    if (a.flujoOtroModo != null) segs.push({ t: a.flujoOtroModo < 0 ? `${otro[0].toUpperCase()}${otro.slice(1)} el mes pasa a ${f.money(a.flujoOtroModo)}.` : `${otro[0].toUpperCase()}${otro.slice(1)} quedan ${f.money(a.flujoOtroModo)}.` });
  }
  return trimUltimo(segs);
}

// ═══════════ CIERRE III · Cuántas noches necesitas (estimación + frontera + zona + año) ═══════════

export interface ArgsCierreNochesStr {
  veredictoBase: Veredicto;
  /** Noches al año con la ocupación del caso y con la de la frontera (null sin frontera). */
  noches: number;
  nochesArriba: number | null;
  ocupacionPct: number;
  ocupacionArribaPct: number | null;
  veredictoArriba: Veredicto | null;
  ocupacionEsDelUsuario: boolean;
  vsComuna: OcupacionVsComuna | null;
  comuna: string;
  mesesEnVerde: number;
  estabilizacionCLP: number;
}

export function cierreNochesStr(a: ArgsCierreNochesStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const origen = a.ocupacionEsDelUsuario ? "Tú supusiste" : "El mercado estima";
  if (a.veredictoBase !== "COMPRAR" && a.nochesArriba != null && a.ocupacionArribaPct != null) {
    const faltan = a.nochesArriba - a.noches;
    const pts = a.ocupacionArribaPct - a.ocupacionPct;
    segs.push(
      { t: `${origen} ${a.noches} noches al año para tu depto y el veredicto sube con ${a.nochesArriba}: ` },
      { t: faltan <= 30 ? `faltan ${faltan} noches al año, ${pts < 2 ? "menos de dos puntos" : `${f.pct1(pts)} puntos`} de ocupación, no un mercado distinto` : `faltan ${faltan} noches al año, ${f.pct1(pts)} puntos de ocupación: eso ya es otro mercado`, mark: true },
      { t: ". " },
    );
    if (!a.ocupacionEsDelUsuario) segs.push({ t: "Pero son noches por sobre la estimación, que ya es la de un depto estabilizado" });
    else segs.push({ t: "Y son noches por sobre tu propio supuesto, que el mercado no confirma" });
  } else if (a.veredictoBase !== "COMPRAR") {
    segs.push({ t: `${origen} ${a.noches} noches al año para tu depto y ninguna ocupación realista cambia el veredicto` });
  } else {
    segs.push({ t: `${origen} ${a.noches} noches al año para tu depto y el veredicto ya no necesita más` });
  }
  if (a.vsComuna && a.vsComuna !== "sin_datos") {
    segs.push({ t: a.vsComuna === "mas" ? `, y tu zona ocupa más que el resto de ${a.comuna}. ` : a.vsComuna === "menos" ? `, y tu zona ocupa menos que el resto de ${a.comuna}. ` : `, y tu zona no ocupa más que el resto de ${a.comuna}. ` });
  } else {
    segs.push({ t: ". " });
  }
  const meses = a.mesesEnVerde;
  segs.push({
    t: meses === 0
      ? `El año además es parejo hacia abajo, sin un solo mes en verde, y arranca con ${f.money(a.estabilizacionCLP)} de pérdida mientras el aviso gana reseñas.`
      : meses <= 3
      ? `El año además es parejo hacia abajo, con ${meses === 1 ? "un solo mes" : `${meses} meses`} en verde, y arranca con ${f.money(a.estabilizacionCLP)} de pérdida mientras el aviso gana reseñas.`
      : `El año reparte ${meses} meses en verde y arranca con ${f.money(a.estabilizacionCLP)} de pérdida mientras el aviso gana reseñas.`,
  });
  return trimUltimo(segs);
}

// ═══════════ CIERRE IV · Cómo lo pagas (precio + crédito + matriz pie × plazo) ═══════════

export interface ArgsCierrePagasStr {
  veredictoBase: Veredicto;
  precioUF: number;
  /** Precio bajo el cual el veredicto sube (vía precio de distancia_veredicto o frontera), null si no cruza. */
  techoUF: number | null;
  veredictoObjetivo: Veredicto | null;
  /** Sobreprecio contra la mediana comunal: desviación % y n; null sin mediana confiable. */
  sobreprecio: { desviacionPct: number; n: number } | null;
  /** Tasa del caso frente a la de mercado, en puntos (negativo = mejor que el mercado). */
  spreadTasaPts: number | null;
  matriz: MatrizPiePlazoStr | null;
  /** Tarifa que también cruza (vía adr), null si no. */
  tarifaCruza: { objetivo: number; deltaPct: number } | null;
  /** "Donde el mes cierra" (T2): precio UF al que el flujo mensual queda en cero; null si no cierra. */
  mesCierraUF?: number | null;
}

export function cierrePagasStr(a: ArgsCierrePagasStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const uf = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;
  if (a.veredictoBase !== "COMPRAR") {
    if (a.techoUF != null && a.veredictoObjetivo) {
      const d = (a.techoUF / a.precioUF - 1) * 100;
      segs.push({ t: `Bajo ${uf(a.techoUF)} el veredicto sube a ${a.veredictoObjetivo}: un ${f.pct1(Math.abs(d))}% menos que tu precio, negociación y no otro departamento`, mark: true }, { t: ". " });
    } else {
      segs.push({ t: "Bajar el precio dentro de lo que un ajuste puede dar no cambia el veredicto: la palanca no está en la mesa del vendedor. " });
      // Cierre estructural: el porcentaje es prueba, el precio no se ofrece (no se cita en UF).
      if (a.mesCierraUF != null && a.mesCierraUF > 0 && a.precioUF > 0) {
        const dm = Math.round((1 - a.mesCierraUF / a.precioUF) * 100);
        segs.push({ t: `Cerrar el mes exige un ${dm}% menos: fuera de lo negociable. El problema es la estructura, no el precio. ` });
      } else {
        // Sin "donde el mes cierra" (ningún precio hasta −70% deja el flujo en cero): se dice.
        segs.push({ t: "Ningún precio dentro de lo negociable cierra el mes: el problema es la estructura, no el precio. " });
      }
    }
  }
  if (a.sobreprecio) {
    const s = a.sobreprecio;
    segs.push({ t: s.desviacionPct < -2
      ? `Ya entras ${f.pct1(Math.abs(s.desviacionPct))}% bajo la mediana de ${s.n} publicaciones de la comuna, así que el vendedor sabe que su precio es competitivo. `
      : s.desviacionPct > 2
      ? `Pagas ${f.pct1(s.desviacionPct)}% sobre la mediana de ${s.n} publicaciones de la comuna: ese es el argumento de la mesa, no el regateo. `
      : `El precio va en línea con la mediana de ${s.n} publicaciones de la comuna. ` });
  }
  if (a.matriz && a.matriz.celdas.length) {
    const verdes = a.matriz.celdas.filter((c) => c.flujoMensual >= 0).length;
    const cruzan = a.matriz.celdas.filter((c) => c.cruza);
    const tasa = a.spreadTasaPts == null ? "" : Math.abs(a.spreadTasaPts) <= 0.2 ? "la tasa está en línea con el mercado y " : a.spreadTasaPts > 0 ? `la tasa está ${f.pct1(a.spreadTasaPts)} puntos sobre el mercado y ` : `la tasa ya está bajo el mercado y `;
    if (cruzan.length === 0) {
      segs.push({ t: `Del crédito no esperes el cierre: ${tasa}${verdes === 0 ? "ninguna combinación de pie y plazo deja el mes en verde" : `${verdes === 1 ? "solo una combinación" : `${verdes} combinaciones`} de pie y plazo ${verdes === 1 ? "deja" : "dejan"} el mes en verde`}, y ninguna cambia el veredicto. ` });
    } else {
      const c = cruzan[0];
      segs.push({ t: `Del crédito: ${tasa}${cruzan.length === 1 ? `solo ${Math.round(c.piePct)}% de pie a ${c.plazoAnios} años` : `${cruzan.length} combinaciones de pie y plazo`} ${cruzan.length === 1 ? "llega" : "llegan"} a ${c.veredicto}${verdes ? `; ${verdes === 1 ? "una" : verdes} ${verdes === 1 ? "deja" : "dejan"} el mes en verde` : ""}. ` });
    }
  }
  if (a.tarifaCruza && a.veredictoBase !== "COMPRAR") {
    segs.push({ t: `Si el vendedor no cede, la otra vía es la tarifa: ${f.money(a.tarifaCruza.objetivo)} por noche sostenidos, y esa la pones tú, no el vendedor.` });
  }
  return trimUltimo(segs);
}

// ═══════════ CIERRE V · Cómo lo gestionas (ventaja sobre el largo + qué se lleva la gestión) ═══════════

export interface ArgsCierreGestionStr {
  modo: "auto" | "administrador";
  /** Sobre-renta del corto sobre el largo (ingreso neto), en el modo del caso y en el otro. */
  sobreRenta: number;
  sobreRentaOtroModo: number;
  flujoMensual: number;
  flujoOtroModo: number;
  /** Ingreso neto del largo, para decir "no le gana" cuando la sobre-renta es negativa. */
  ltrIngresoNeto: number;
}

export function cierreGestionStr(a: ArgsCierreGestionStr, f: FmtCierre): SegCierre[] {
  const segs: SegCierre[] = [];
  const auto = a.modo === "auto";
  const sobreAuto = auto ? a.sobreRenta : a.sobreRentaOtroModo;
  const sobreAdmin = auto ? a.sobreRentaOtroModo : a.sobreRenta;
  const flujoAuto = auto ? a.flujoMensual : a.flujoOtroModo;
  const flujoAdmin = auto ? a.flujoOtroModo : a.flujoMensual;
  if (sobreAuto > 0) {
    segs.push({ t: `Autogestionado, el corto deja ${f.money(sobreAuto)} más al mes que arrendar largo; ` });
    if (sobreAdmin > 0) {
      const frac = fraccionEnPalabras(sobreAuto - sobreAdmin, sobreAuto);
      segs.push({ t: `con administrador la ventaja baja a ${f.money(sobreAdmin)} y el mes pasa de ${f.money(flujoAuto)} a ${f.money(flujoAdmin)}. ` }, { t: `La ventaja existe y es tuya mientras pongas las horas${frac ? `: el administrador se lleva ${frac} de ella` : ""}`, mark: true }, { t: ". " });
    } else {
      segs.push({ t: `con administrador desaparece: el largo deja ${f.money(-sobreAdmin)} más y el mes pasa de ${f.money(flujoAuto)} a ${f.money(flujoAdmin)}. ` }, { t: "La ventaja existe solo si pones las horas tú", mark: true }, { t: ". " });
    }
    segs.push({ t: flujoAdmin < 0 ? `Si no vas a poner las horas, la pregunta ya no es corto o largo: es si ${f.money(-flujoAdmin)} al mes caben en tu bolsillo.` : `Si no vas a poner las horas, con administrador el mes igual queda en ${f.money(flujoAdmin)}.` });
  } else {
    segs.push({ t: `Ni autogestionado el corto le gana al largo: deja ${f.money(-sobreAuto)} menos al mes que arrendar el mismo depto` , mark: true }, { t: `, con un ingreso neto largo de ${f.money(a.ltrIngresoNeto)}. Con administrador la brecha es de ${f.money(-sobreAdmin)}. Las horas de gestión no compran una ventaja acá.` });
  }
  return trimUltimo(segs);
}
