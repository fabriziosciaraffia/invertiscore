import type { ReactNode } from "react";

/**
 * SECCIÓN DE PÁGINA del informe — contrato CONGELADO 02-sep-2026 (T2).
 *
 * Un nivel sobre el vocabulario v12: cada sección tiene forma propia, no solo
 * nombre. Fondo a sangre de borde a borde del documento, alternando `paper` /
 * `paper2` entre secciones consecutivas (portada · hero · principales hallazgos ·
 * los números · la inversión · la zona), eyebrow mono en Signal Red, título serif
 * grande y una línea de intención. El test del contrato: haciendo scroll rápido
 * se tienen que ver seis cosas distintas.
 *
 * El sangrado se logra con márgenes negativos contra el padding horizontal de
 * `.doc-page` (64px / 22px en mobile); la página que alterna secciones usa
 * `DocumentoFrame secciones` para soltar su padding vertical y dejar que cada
 * sección gobierne su propio aire. CSS en DocTokens (`.doc-sec*`).
 */
export function SeccionInforme({
  id,
  tono,
  titulo,
  children,
  caja = false,
}: {
  id: string;
  tono: "paper" | "paper2";
  titulo?: ReactNode;
  children: ReactNode;
  /** Contrato §2: SOLO el hero y la recomendación llevan caja. El resto va suelto
   *  sobre el papel. Las reglas de `.doc-sec--caja` cuelgan de `.doc-dictamen`, el
   *  marco, en `PortadaInforme`. */
  caja?: boolean;
}) {
  return (
    <section id={id} className={`doc-sec${tono === "paper2" ? " p2" : ""}${caja ? " doc-sec--caja" : ""}`}>
      {titulo && <h2 className="doc-sec-t">{titulo}</h2>}
      {children}
    </section>
  );
}
