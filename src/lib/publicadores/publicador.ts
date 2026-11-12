// ─────────────────────────────────────────────────────────────────────────────
// Quién publica cada aviso (12-nov-2026, goal de Fabrizio): para saber a qué corredor llamar cuando alguien quiere invertir
// en un depto. Puro: lo prueba el tier PUBLICADORES.
//
// Lo que trae cada fuente (medido el 12-nov-2026):
//   · EL LISTADO de cada noche (GetProps) trae SOLO EL TIPO, en la URL del aviso: `compracorredorasr` / `arriendocorredorasr`
//     = corredor, `compraparticularsr` / `arriendoparticularsr` = dueño directo, `compranuevo` = inmobiliaria. Ni nombre ni
//     contacto. La ficha nueva lo repite en su letra: `b_` corredor, `o_` particular, `r_` obra nueva.
//   · LA FICHA trae `client`: el id de la corredora en la fuente, su `idType`, su nombre y su logo. NO trae teléfono ni correo:
//     el contacto está detrás del formulario de la fuente, con captcha, y eso no se toca.
//   · EL PERFIL de la corredora (`/empresas/gestioncorredor/corredoras/…/<id>`, el enlace que pone la propia ficha) responde
//     «¡UPS! … no está disponible», también en un navegador real. Sitio, teléfono y correo no están publicados de forma abierta:
//     las columnas existen y quedan vacías hasta que una fuente abierta los dé.
//
// Los datos del publicador son de USO INTERNO: viven en `publicadores` y `avisos_publicador` (RLS sin políticas, solo el
// service role) y no viajan al navegador de los usuarios. `scraped_properties`, que se lee con la llave pública, guarda solo
// el tipo, que ya estaba a la vista en la URL.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoPublicador = "corredor" | "dueno" | "inmobiliaria";
export type ClasePublicador = "franquicia" | "corredora" | "independiente" | "inmobiliaria" | "dueno";

/** El tipo de publicador que dice la URL del aviso (la vieja del listado o la nueva de la ficha). null si no lo dice. */
export function tipoDesdeUrl(url: string | null | undefined): TipoPublicador | null {
  if (!url) return null;
  const vieja = url.match(/\/propiedades\/([a-z]+)\//);
  if (vieja) {
    const s = vieja[1];
    if (/nuevo$/.test(s)) return "inmobiliaria";
    if (/particular/.test(s)) return "dueno";
    if (/corredor/.test(s)) return "corredor";
    return null;
  }
  const nueva = url.match(/\/([a-z])_[0-9a-f]+\/?(?:[?#].*)?$/);
  if (nueva) return nueva[1] === "b" ? "corredor" : nueva[1] === "o" ? "dueno" : nueva[1] === "r" ? "inmobiliaria" : null;
  return null;
}

/** Lo que la ficha dice de quien publica. */
export interface PublicadorFicha {
  /** El id del cliente en la fuente (la corredora, la inmobiliaria o la persona). */
  id: number;
  idType: number | null;
  nombre: string | null;
  logo: string | null;
}

/** El objeto JSON que empieza en `desde` (una `{`), respetando strings y escapes. null si no cierra. */
function objetoDesde(s: string, desde: number): string | null {
  let prof = 0;
  let enStr = false;
  for (let i = desde; i < s.length && i < desde + 4000; i++) {
    const c = s[i];
    if (enStr) {
      if (c === "\\") i++;
      else if (c === '"') enStr = false;
      continue;
    }
    if (c === '"') enStr = true;
    else if (c === "{") prof++;
    else if (c === "}") {
      prof--;
      if (prof === 0) return s.slice(desde, i + 1);
    }
  }
  return null;
}

/**
 * El publicador que trae la ficha nueva: el bloque `"client":{…}` de los datos de la página (medido el 12-nov-2026:
 * `{"id":23375,"idType":2,"name":"Century21 Conecta","logo":"…/logos/corredora/23375/….jpeg"}`). null si no viene.
 */
export function parsearPublicadorFicha(html: string | null | undefined): PublicadorFicha | null {
  if (!html) return null;
  const re = /"client":\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const txt = objetoDesde(html, m.index + '"client":'.length);
    if (!txt) continue;
    try {
      const o = JSON.parse(txt) as { id?: unknown; idType?: unknown; name?: unknown; logo?: unknown };
      const id = Number(o.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const nombre = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 200) : null;
      const logo = typeof o.logo === "string" && /^https:\/\//.test(o.logo) ? o.logo.slice(0, 500) : null;
      return { id, idType: Number.isInteger(Number(o.idType)) ? Number(o.idType) : null, nombre, logo };
    } catch {
      /* un bloque ilegible: se mira el siguiente */
    }
  }
  return null;
}

/** ¿La página es la ficha de la fuente? La respuesta «rara» es un 200 que no trae los datos de la página. */
export function esFichaDeLaFuente(html: string | null | undefined): boolean {
  return !!html && /__NEXT_DATA__/.test(html) && /"initialState"/.test(html);
}

/** Las franquicias de corretaje que operan en Chile (por el nombre). */
const FRANQUICIAS = /\b(century\s*21|re\/?\s*max|engel\s*(&|y)?\s*v[oö]lkers|coldwell\s*banker|keller\s*williams|sotheby'?s|exp\s+realty|unne)\b/i;
/** Palabras de empresa: si el nombre las tiene, no es una persona. */
const EMPRESA = /\b(propiedades|inmobiliari[ao]s?|corredor[ae]s?|gesti[oó]n|negocios|bienes\s+ra[ií]ces|real\s+estate|asesor[ií]as?|inversiones|consultores|grupo|servicios|spa|ltda|limitada|s\.?\s?a\.?|e\.?i\.?r\.?l\.?|partners|brokers?|home|homes|house|casas|capital|chile|group|propertie?s|realty)\b/i;
/** Hasta cuántos avisos activos se considera independiente a un nombre de persona. */
export const TOPE_AVISOS_INDEPENDIENTE = 15;

/**
 * La clase del publicador, por el nombre y la cantidad de avisos (12-nov-2026):
 *   · franquicia — el nombre es de una marca de franquicia (Century21, RE/MAX, Engel & Völkers, …), aunque la oficina sea chica;
 *   · independiente — un nombre de persona (dos a cuatro palabras, sin palabras de empresa ni cifras) con hasta 15 avisos;
 *   · corredora — el resto de los corredores: una empresa, o un nombre con más avisos de los que lleva una persona sola.
 * La inmobiliaria y el dueño directo vienen del tipo y no se clasifican por nombre.
 */
export function claseDelPublicador(p: { tipo: TipoPublicador | null; nombre: string | null; avisosActivos: number }): ClasePublicador | null {
  if (p.tipo === "inmobiliaria") return "inmobiliaria";
  if (p.tipo === "dueno") return "dueno";
  if (p.tipo !== "corredor") return null;
  const nombre = (p.nombre ?? "").trim();
  if (FRANQUICIAS.test(nombre)) return "franquicia";
  const palabras = nombre.split(/\s+/).filter(Boolean);
  const pareceUnaPersona = palabras.length >= 2 && palabras.length <= 4 && !EMPRESA.test(nombre) && !/\d/.test(nombre) && !/[&@/]/.test(nombre);
  if (pareceUnaPersona && p.avisosActivos <= TOPE_AVISOS_INDEPENDIENTE) return "independiente";
  return "corredora";
}

/** Cómo se dice cada clase en el panel. */
export const ETIQUETA_CLASE: Record<ClasePublicador, string> = {
  franquicia: "Franquicia",
  corredora: "Corredora",
  independiente: "Corredor independiente",
  inmobiliaria: "Inmobiliaria",
  dueno: "Dueño directo",
};
