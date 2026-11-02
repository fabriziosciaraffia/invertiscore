// LA REGLA GENERAL (02-nov-2026, goal «Filtros v2 y negociar»): «conviene» y «✓ Comprar» quieren decir AL PRECIO PUBLICADO, y se
// dice —en «¿Cómo se calcula?», la bienvenida, el pop-up de «Analizar este», la barra de abajo, la lista y la tarjeta de
// Explorar—. Los que convienen si se negocia son otra capa (explorar/capa-negociar.ts), con su propia cuenta. SIN DEPENDENCIAS: lo
// leen el pop-up (también en /deptos, cuyo primer paquete no puede cargar portal.ts) y portal.ts.
export const AL_PRECIO_PUBLICADO = "al precio publicado";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** LO QUE DICE UN NEGOCIADO (02-nov-2026, mockup 8, estado C), en la tarjeta, la lista y el pop-up: los dos veredictos y el botón. */
export const NEGOCIADO_COPY = {
  publicado: "publicado",
  alPublicado: "Al precio publicado",
  consigues: "Si consigues",
  /** «Si consigues UF 2.950 (−4,2 %)». */
  siConsigues: (p: number, d: number) => ({ antes: "Si consigues", precio: `UF ${miles(p)}`, despues: `(−${pct1(d)} %)` }),
  analizarA: (p: number) => `Analizar a UF ${miles(p)}`,
} as const;
