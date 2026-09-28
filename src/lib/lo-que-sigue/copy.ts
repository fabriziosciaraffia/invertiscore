// ─────────────────────────────────────────────────────────────────────────────
// El copy de las dos ofertas (28-sep-2026, mockup v3). Voz de Franco: directo, en tuteo, sin
// urgencia inventada, sin «desde», sin «guarda tu informe». Lo que cambia con el veredicto es la
// frase que presenta cada oferta, no la oferta. El tier vigila el tuteo acá.
// ─────────────────────────────────────────────────────────────────────────────

export type VeredictoLqs = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

export function veredictoLqs(v: string | null | undefined): VeredictoLqs {
  return v === "COMPRAR" || v === "BUSCAR OTRA" ? v : "AJUSTA SUPUESTOS";
}

export const FRASE_REGISTRO: Record<VeredictoLqs, string> = {
  COMPRAR: "Este conviene. Hay más así.",
  "AJUSTA SUPUESTOS": "Este conviene si lo negocias. Otros convienen tal como están.",
  "BUSCAR OTRA": "Este no. Los que sí, Franco los está juntando.",
};

export const FRASE_PACK: Record<VeredictoLqs, string> = {
  COMPRAR: "¿Otro candidato? Compáralo antes de ofertar.",
  "AJUSTA SUPUESTOS": "Mira dos más antes de sentarte a negociar este.",
  "BUSCAR OTRA": "El siguiente, con el mismo rigor.",
};

export const OFERTA_REGISTRO = {
  ojo: "Lo que sigue",
  titular: "Franco está seleccionando deptos que ya son buena inversión,",
  plumon: "solo para registrados.",
  cierre: "Sé de los primeros.",
  boton: "Quiero estar entre los primeros",
  barraTitulo: "Sé de los primeros",
  barraSub: "Deptos que ya son buena inversión, solo para registrados.",
  barraBoton: "Registrarme",
} as const;

export const REGISTRO_UN_PASO = {
  ojo: "Sé de los primeros",
  titular: "Un correo y listo.",
  plumon: "Sin contraseña.",
  placeholder: "tu@correo.cl",
  entrar: "Entrar",
  o: "o",
  google: "Seguir con Google",
  pie: "Te mandamos un enlace para entrar. Este informe queda en tu cuenta.",
  enviadoTitular: "Revisa tu correo.",
  enviadoPlumon: "El enlace ya salió.",
  enviadoCuerpo: (correo: string) => `Lo mandamos a ${correo}. Al abrirlo entras, y este informe queda en tu cuenta. Mientras tanto, sigue leyendo.`,
  seguir: "Seguir leyendo",
  errorCorreo: "Ese correo no se entiende. Revísalo.",
  errorEnvio: "No pudimos mandar el enlace. Intenta de nuevo.",
} as const;

export const TICKET_PACK = {
  ojo: "Lo que sigue",
  precioNota: "3 análisis, hoy",
  ahorro: (unitario: string, referencia: string) => `${unitario} por análisis en vez de ${referencia}.`,
  vence: (dia: "hoy" | "mañana" | "otro", hora: string) => (dia === "otro" ? `Vence a las ${hora}` : `Vence ${dia} a las ${hora}`),
  boton: (precio: string) => `Tomar los 3 por ${precio}`,
  seguir: "Seguir leyendo",
  despedida: (hora: string) => `Vence a las ${hora} y no vuelve. ¿La dejas pasar?`,
  despedidaResumen: "3 análisis, hoy",
  comprar: "Comprar el pack",
  siSeguir: "Sí, seguir leyendo",
  cerrar: "Cerrar",
} as const;

export const CIERRE_REGISTRO: Record<VeredictoLqs, string> = {
  COMPRAR: "Hay más deptos así. Sé de los primeros.",
  "AJUSTA SUPUESTOS": "Los que convienen tal como están, primero para registrados. Sé de los primeros.",
  "BUSCAR OTRA": "Los que sí convienen, primero para registrados. Sé de los primeros.",
};

export const CHECKOUT_PACK = {
  titulo: "Franco — 3 análisis",
  subtitulo: "3 análisis, sin caducidad",
  vence: (dia: "hoy" | "mañana" | "otro", hora: string) => (dia === "otro" ? `Vence a las ${hora}.` : `Vence ${dia} a las ${hora}.`),
  vencido: "Ese precio venció y no vuelve. Un análisis cuesta $9.990, y los planes siguen en su precio.",
} as const;
