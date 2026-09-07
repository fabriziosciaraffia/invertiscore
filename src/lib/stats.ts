// Conteo de avisos activos en `scraped_properties`, redondeado hacia abajo al
// millar. Verificado el 07-sep-2026: 44.256 activas (`is_active = true`).
//
// La landing NO usa esta constante: lee el conteo real en cada revalidación
// (src/lib/landing-vivo.ts). Esta queda para las superficies que no pueden
// consultar la base al renderizar (emails, FAQ, metadata del layout). Si la
// landing y este número se alejan más de un millar, hay que actualizarlo.
export const PROPERTIES_COUNT = "44.000+";
