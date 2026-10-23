// ─────────────────────────────────────────────────────────────────────────────
// CUÁNDO SE RENUEVA LA SELECCIÓN (22-oct-2026, decisión de Fabrizio): «Se renueva el lunes 27», en «Tu selección de esta
// semana» del dashboard y en el correo. La selección se arma el domingo y sale el lunes (vercel.json › semanal-enviar,
// 12:00 UTC = 09:00 de Chile): el próximo lunes, contado en la hora de Chile; un lunes dice el siguiente. Puro.
// ─────────────────────────────────────────────────────────────────────────────

const ZONA = "America/Santiago";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function partesEnChile(d: Date, zona: string): { diaSemana: number; dia: number } {
  const p = new Intl.DateTimeFormat("es-CL", { timeZone: zona, weekday: "long", day: "numeric" }).formatToParts(d);
  const nombre = p.find((x) => x.type === "weekday")?.value.toLowerCase() ?? "";
  return { diaSemana: Math.max(0, DIAS.indexOf(nombre)), dia: Number(p.find((x) => x.type === "day")?.value ?? "0") };
}

/** El próximo lunes después de `ahora`, en la hora de Chile (un lunes devuelve el siguiente). */
export function proximoLunes(ahora: Date = new Date(), zona = ZONA): Date {
  const { diaSemana } = partesEnChile(ahora, zona);
  const faltan = ((1 - diaSemana + 7) % 7) || 7;
  return new Date(ahora.getTime() + faltan * 24 * 3600_000);
}

/** «lunes 27». */
export function diaRenovacion(ahora: Date = new Date(), zona = ZONA): string {
  return `lunes ${partesEnChile(proximoLunes(ahora, zona), zona).dia}`;
}

/** La línea del dashboard y del correo: «Se renueva el lunes 27.» */
export function textoRenueva(ahora: Date = new Date(), zona = ZONA): string {
  return `Se renueva el ${diaRenovacion(ahora, zona)}.`;
}
