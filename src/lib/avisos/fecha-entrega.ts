// ─────────────────────────────────────────────────────────────────────────────
// La fecha de entrega de la obra nueva (30-sep-2026), como la da la fuente por proyecto:
// «Inmediata», «Disponible», «2° Semestre 2026», «2do Semestre 2027», «4to Trimestre 2028», «Marzo 2027»
// o vacía. Se guarda cruda en scraped_properties.fecha_entrega y se lee con esto: inmediata, o el mes y el
// año en que se entrega (el ÚLTIMO mes del semestre o trimestre: el lado conservador). Una fecha que ya
// pasó se lee como inmediata. Puro: lo prueba el tier AVISOS.
// ─────────────────────────────────────────────────────────────────────────────

export interface Entrega {
  inmediata: boolean;
  anio: number | null;
  mes: number | null;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** null = la fuente no dice (el aviso se trata como el wizard trata a quien no contesta: entrega inmediata). */
export function parsearFechaEntrega(texto: string | null | undefined, hoy: Date = new Date()): Entrega | null {
  const t = (texto ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  if (/inmediat|disponible/.test(t)) return { inmediata: true, anio: null, mes: null };
  const anioM = t.match(/(20\d{2})/);
  if (!anioM) return null;
  const anio = Number(anioM[1]);
  let mes: number | null = null;
  const sem = t.match(/([12])\s*(?:°|º|er|ro|do)?\s*semestre/);
  const tri = t.match(/([1-4])\s*(?:°|º|er|ro|do|to)?\s*trimestre/);
  if (sem) mes = Number(sem[1]) === 1 ? 6 : 12;
  else if (tri) mes = Number(tri[1]) * 3;
  else {
    const i = MESES.findIndex((m) => t.includes(m));
    mes = i >= 0 ? i + 1 : 12;
  }
  const yaPaso = anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes <= hoy.getMonth() + 1);
  return yaPaso ? { inmediata: true, anio, mes } : { inmediata: false, anio, mes };
}
