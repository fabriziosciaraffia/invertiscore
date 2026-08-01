// ─────────────────────────────────────────────────────────────────────────────
// Keys de borrador en localStorage — dueño único de los patrones
//
// Existe para que los patrones vivan en UN solo lugar: los usan el wizard v4
// (que escribe y lee) y el logout (que purga). Sin esto el botón de salir
// tendría que importar de `components/formulario-v4/`, o duplicar las keys y
// dejar que se separen con el tiempo.
//
// Por qué se purgan: los borradores guardan el objeto de respuestas COMPLETO
// —dirección, coordenadas, precio, pie, tasa, arriendo— en localStorage, que es
// por ORIGEN y no por sesión. Sin purga en el logout, esos datos quedan legibles
// para quien use después el mismo navegador.
// ─────────────────────────────────────────────────────────────────────────────

/** Borradores del wizard v4: `franco_wizard_v4_draft__<owner>__<tabId>`. */
export const V4_DRAFT_PREFIX = "franco_wizard_v4_draft";
/** tabId de la pestaña (sessionStorage, no localStorage). */
export const V4_TAB_KEY = "franco_wizard_v4_tab";
/** Dueño de los borradores escritos sin sesión. */
export const OWNER_INVITADO = "guest";

/**
 * Borradores de los formularios anteriores. Todos guardan la misma clase de
 * dato y ninguno tiene scope de usuario, así que se purgan igual: cerrar solo
 * el de v4 dejaría el agujero a medias.
 */
const KEYS_DRAFT_LEGACY = [
  "franco_wizard_v3_draft",
  "franco_draft_v2",
  "franco_form_draft",
  "franco_draft_renta_corta",
];

/** Marca de la purga retroactiva. Subir el número la vuelve a correr una vez. */
const FLAG_PURGA = "franco_drafts_purgados_v1";

/** Todas las keys de borrador presentes ahora en localStorage. */
export function todasLasKeysDeDraft(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`${V4_DRAFT_PREFIX}__`) || KEYS_DRAFT_LEGACY.includes(k)) keys.push(k);
    }
  } catch {
    /* modo privado / storage bloqueado */
  }
  return keys;
}

/**
 * Borra los borradores y NADA MÁS. La identidad de pestaña se conserva.
 *
 * La distinción no es cosmética: el `tabId` es lo único que sostiene el
 * round-trip invitado -> registro, porque la adopción busca el borrador `guest`
 * de ESTA pestaña. Una purga que se lo lleve deja al usuario sin forma de
 * recuperar lo que escribió.
 */
export function purgarBorradores(): number {
  let n = 0;
  try {
    for (const k of todasLasKeysDeDraft()) {
      localStorage.removeItem(k);
      n++;
    }
  } catch {
    /* ignore */
  }
  return n;
}

/**
 * Borra los borradores Y la identidad de pestaña. Es la del LOGOUT: cerrar
 * sesión tiene que cortar también el hilo de la pestaña, para que la próxima
 * no herede el scope de la anterior.
 */
export function purgarBorradoresYPestana(): number {
  const n = purgarBorradores();
  try {
    sessionStorage.removeItem(V4_TAB_KEY);
  } catch {
    /* ignore */
  }
  return n;
}

/**
 * PURGA RETROACTIVA — una sola vez por navegador.
 *
 * Los borradores escritos antes del scope por dueño no tienen forma de saber a
 * quién pertenecen, así que no hay manera segura de conservarlos: se borran
 * todos. El banner que los ofrecía se auto-vencía a las 24h por el TTL, pero el
 * DATO quedaba en el disco hasta que ese navegador volviera a abrir el wizard.
 * Esto lo cierra en el primer montaje después del deploy.
 *
 * Idempotente vía flag. Devuelve cuántas keys borró (0 si ya había corrido).
 */
export function purgarDraftsLegacyUnaVez(): number {
  try {
    if (localStorage.getItem(FLAG_PURGA)) return 0;
    // `purgarBorradores` y NO la variante con pestaña: acá la pestaña recién
    // arranca y su id es lo que va a sostener el round-trip. Llevárselo fue
    // exactamente la regresión que rompió la adopción.
    const n = purgarBorradores();
    localStorage.setItem(FLAG_PURGA, new Date().toISOString());
    return n;
  } catch {
    return 0;
  }
}
