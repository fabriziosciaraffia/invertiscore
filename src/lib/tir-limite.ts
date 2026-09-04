/** Umbral de TIR a 10 años bajo el cual "conviene más otra inversión" (la glosa de las seis
 *  cifras y el precio límite del plan). Vive solo, sin dependencias: lo lee el render
 *  (cliente) y el motor (server); importarlo desde simular-str arrastraba analisis-pipeline
 *  y `next/headers` al bundle del cliente. */
export const TIR_LIMITE_PCT = 6;
