/**
 * El análisis demo que enlaza la landing. Es la ÚNICA superficie del informe
 * visible sin sesión, así que su id lo necesitan dos lugares: la page (para
 * darle acceso premium y eximirlo de la caducidad por versión de prompt) y el
 * cron de precalentado (para refrescarlo siempre, sin depender de la ventana
 * de recientes). Vivía como literal dentro de la page; duplicarlo en el cron
 * habría sido peor que extraerlo.
 *
 * Está protegido contra borrado en los delete-button.
 */
export const DEMO_ANALYSIS_ID = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";
