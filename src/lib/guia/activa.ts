// «Por dónde seguir buscando» existe para los informes de renta larga (los avisos se evalúan como
// arriendo largo). La línea del ticket del pack que la promete y la guía después de pagar leen ESTE
// predicado: una no sale sin la otra (lo fija el tier GUIA-BUSQUEDA).
export const GUIA_ACTIVA = true;

export const hayGuia = (modalidad: "ltr" | "str") => GUIA_ACTIVA && modalidad === "ltr";
