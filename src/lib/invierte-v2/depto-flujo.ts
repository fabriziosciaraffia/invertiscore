// ─────────────────────────────────────────────────────────────────────────────
// EL FLUJO DE CADA DEPTO (etapa 3, parte B1, 21-nov-2026; láminas 4.1-confirmando, 4.1-no-avanza y 4.2-pagina-del-depto, y la tabla
// 0-estados-de-un-depto). Puro: las reglas y los textos; lo usan la página del depto, la base, el admin y el tier.
//   · La etapa de un depto elegido: confirmando (el primer estado de todo elegido) → no_avanza (sin acuerdo, o la ubicación confirmada
//     lo dejó sin convenir) | sin_preaprobacion | listo. Un elegido sin etapa guardada está confirmando.
//   · Pasa de confirmando solo con el acuerdo con quien vende Y la ubicación confirmada con su análisis rehecho (decisión de Fabrizio,
//     20-nov-2026): Comprar, o Ajusta supuestos con el precio al que vuelve a Comprar. Lo demás no avanza, «dejó de convenir». Con eso,
//     listo si la preaprobación deja ofertar (aprobada o compra sin crédito); si no, sin_preaprobacion. La base lo impone también
//     (trigger inv_deptos_transicion).
//   · «Lo que sigue»: un solo bloque con a lo más UN botón, rojo solo cuando le toca a la persona.
// ─────────────────────────────────────────────────────────────────────────────
import { puedeOfertar, type EstadoVisible } from "./preaprobacion";

export const ETAPAS = ["confirmando", "no_avanza", "sin_preaprobacion", "listo", "en_pausa", "en_firme", "promesa", "escritura", "inscrito", "no_sigo"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const esEtapa = (x: unknown): x is Etapa => (ETAPAS as readonly unknown[]).includes(x);

/** La página de un depto: a donde lleva la tarjeta de la base. */
export const urlDepto = (avisoId: string) => `/invierte/depto/${encodeURIComponent(avisoId)}`;

/** La etapa que se muestra: la guardada; un elegido sin etapa está confirmando. Las opciones y los descartados no tienen página. */
export function etapaDe(f: { estado: string; etapa: string | null }): Etapa | null {
  if (esEtapa(f.etapa)) return f.etapa;
  return f.estado === "elegido" ? "confirmando" : null;
}

export type Acuerdo = "pendiente" | "con_acuerdo" | "sin_acuerdo";
export interface UbicacionAnalizada { veredicto: string | null; precioComprarUF: number | null }

/** ¿Convence el análisis rehecho con la ubicación real? Comprar, o Ajusta supuestos con un precio al que vuelve a Comprar. */
export const ubicacionConviene = (u: UbicacionAnalizada | null) => !!u && (u.veredicto === "COMPRAR" || (u.veredicto === "AJUSTA SUPUESTOS" && u.precioComprarUF != null));

/** A qué etapa pasa un depto en confirmando, con lo que se sabe. `null`: sigue confirmando (falta el acuerdo o la ubicación). */
export function etapaSiguiente(p: { acuerdo: Acuerdo | null; ubicacion: UbicacionAnalizada | null; preaprobacion: EstadoVisible }): { etapa: Etapa; motivo?: "sin_acuerdo" | "dejo_de_convenir" } | null {
  if (p.acuerdo === "sin_acuerdo") return { etapa: "no_avanza", motivo: "sin_acuerdo" };
  if (p.acuerdo !== "con_acuerdo" || !p.ubicacion) return null;
  if (!ubicacionConviene(p.ubicacion)) return { etapa: "no_avanza", motivo: "dejo_de_convenir" };
  return { etapa: puedeOfertar(p.preaprobacion) ? "listo" : "sin_preaprobacion" };
}

/** Con la preaprobación que cambia: los que esperaban pasan a listo, y al revés. Las demás etapas no se tocan. */
export function etapaConPreaprobacion(etapa: Etapa, preaprobacion: EstadoVisible): Etapa {
  if (etapa === "sin_preaprobacion" && puedeOfertar(preaprobacion)) return "listo";
  if (etapa === "listo" && !puedeOfertar(preaprobacion)) return "sin_preaprobacion";
  return etapa;
}

export const DEPTO_COPY = {
  cabecera: "Tu depto",
  publicado: (uf: string) => `Publicado en UF ${uf}`,
  verDetalles: "Ver los detalles",
  ubicacionAproximada: "Ubicación aproximada, según la publicación. Franco la confirma con quien lo vende.",
  loQueSigue: "Lo que sigue",
  cambiosT: "Cambios en la publicación",
  preguntale: "Pregúntale a Franco por este depto",
  preguntaWhatsapp: (titulo: string) => `Hola, tengo una pregunta sobre ${titulo}.`,
  // No avanza (lámina 4.1-no-avanza): no se dice por qué ni se nombra a quien vende.
  noAvanzaT: "No pudimos avanzar con este depto",
  noAvanzaLinea: "Pasa a veces: no todos los deptos se pueden gestionar. Seguimos trabajando con las otras opciones.",
  dejoDeConvenirLinea: "Al confirmar dónde está, los números cambiaron y este depto dejó de convenir. Seguimos trabajando con las otras opciones.",
  alternativaRotulo: "El más parecido que sí podemos gestionar",
  seguirConEste: "Seguir con este",
  verMisOpciones: "Ver mis otras opciones",
  buscarEnMapa: "Buscar otro en el mapa",
} as const;

export type Tono = "gris" | "ciruela";
export interface LoQueSigue { chip: string; tono: Tono; titulo: string; texto: string | null; boton: { texto: string; href: string } | null }

/** «Lo que sigue» en la página del depto, según su etapa y la preaprobación. null en no_avanza (la página entera cambia). */
export function loQueSigue(etapa: Etapa, pre: EstadoVisible, urlPreaprobacion: string): LoQueSigue | null {
  if (etapa === "confirmando") {
    return { chip: "Franco está en eso", tono: "gris", titulo: "Estamos confirmando este depto", texto: "Franco está coordinando con el vendedor para dejarlo listo para tu oferta o tu visita. Te avisamos apenas esté.", boton: null };
  }
  if (etapa === "sin_preaprobacion") {
    if (pre === "en_revision") return { chip: "Franco está en eso", tono: "gris", titulo: "Tu preaprobación está en revisión", texto: "Apenas la revisemos, puedes ofertar o pedir una visita.", boton: null };
    if (pre === "por_corregir") return { chip: "Te toca a ti", tono: "ciruela", titulo: "Sube de nuevo tu preaprobación para ofertar o visitar", texto: null, boton: { texto: "Subir otra", href: `${urlPreaprobacion}?subir=1` } };
    return { chip: "Te toca a ti", tono: "ciruela", titulo: "Sube tu preaprobación para ofertar o visitar", texto: "Se sube una vez y vale para todos tus deptos.", boton: { texto: "Subir mi preaprobación", href: urlPreaprobacion } };
  }
  if (etapa === "listo") {
    // B1 (21-nov-2026): la oferta y la visita llegan en las entregas siguientes; mientras, sin botón.
    return { chip: "Te toca a ti", tono: "ciruela", titulo: "Listo para ofertar o visitar", texto: "Franco ya lo dejó listo con quien lo vende. Muy pronto vas a poder hacer tu oferta o pedir una visita desde aquí.", boton: null };
  }
  return null;
}

/** La línea de estado de la tarjeta en la base (lámina 3.3-base): el chip y qué pasa ahora. */
export function estadoEnBase(etapa: Etapa, pre: EstadoVisible, motivo: string | null): { chip: string; tono: Tono; linea: string } {
  if (etapa === "no_avanza") return { chip: "No avanzó", tono: "gris", linea: motivo === "dejo_de_convenir" ? "Al confirmar dónde está, dejó de convenir" : "Te mostramos el más parecido que sí podemos gestionar" };
  if (etapa === "sin_preaprobacion") return pre === "en_revision"
    ? { chip: "Franco está en eso", tono: "gris", linea: "Revisando tu preaprobación" }
    : { chip: "Te toca a ti", tono: "ciruela", linea: "Sube tu preaprobación para ofertar o visitar" };
  if (etapa === "listo") return { chip: "Te toca a ti", tono: "ciruela", linea: "Listo para ofertar o visitar" };
  return { chip: "Franco está en eso", tono: "gris", linea: "Confirmando con quien lo vende que sigue disponible" };
}
