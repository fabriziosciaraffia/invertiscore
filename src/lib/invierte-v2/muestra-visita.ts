// La visita de muestra de las páginas /dev (24-nov-2026): el reporte con un arreglo o sin, para la revisión visual. Datos de ejemplo.
import type { VisitaResumen } from "./visita";

const PUNTOS = (arreglo: boolean) => [
  arreglo ? { tema: "Baños", texto: "Filtración en el cielo del baño principal: hay que repararla.", arreglo: true, enFotos: false } : { tema: "Baños", texto: "En buen estado, sin filtraciones a la vista.", arreglo: false, enFotos: false },
  { tema: "Cocina", texto: "Muebles y cubierta en buen estado.", arreglo: false, enFotos: false },
  { tema: "Piso y ascensor", texto: "Piso 7, dos ascensores funcionando.", arreglo: false, enFotos: false },
  { tema: "Ruido", texto: "Da a calle interior; silencioso a las 11:00.", arreglo: false, enFotos: false },
];

export function visitaMuestra(caso: string, estado = "reporte_publicado"): VisitaResumen {
  const arreglo = caso === "arreglo" || caso === "aceptada";
  return {
    id: "vis", estado, pedidaDesde: caso === "aceptada" ? "aceptada" : "contraoferta", visitadaAt: new Date(Date.now() - 864e5).toISOString(),
    reporteEstado: arreglo ? "arreglos_menores" : "coincide", reporteLinea: arreglo ? "Baño con filtración en el cielo" : "El estado coincide con las fotos",
    arreglos: arreglo ? ["Filtración en el cielo del baño principal: hay que repararla."] : [], puntos: PUNTOS(arreglo), fotos: [],
    delta: arreglo ? 1 : 0, pisoUF: arreglo ? 2874 : 2905, altoUF: arreglo ? 2936 : 2966,
    sugeridaAntesUF: caso === "aceptada" ? 2966 : 2966, sugeridaDespuesUF: arreglo ? (caso === "aceptada" ? 2936 : 2936) : 2966,
  };
}

