// El estándar de /deptos (16-oct-2026, decisión de Fabrizio): pie 20 % y plazo 25 años, dichos en la respuesta y
// editables después en el perfil. Vive solo para que el cliente lo lea sin cargar el motor (estandar-deptos.ts lo usa).
export const PIE_DEPTOS = 20;
export const PLAZO_DEPTOS = 25;
/** Los dos pies evaluados a 25 años: el estándar y el de la alternativa «con qué pie sí». */
export const PIES_DEPTOS = [20, 30] as const;
