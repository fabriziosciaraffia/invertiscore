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
  eyebrow,
  titulo,
  intent,
  children,
}: {
  id: string;
  tono: "paper" | "paper2";
  eyebrow?: ReactNode;
  titulo?: ReactNode;
  intent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`doc-sec${tono === "paper2" ? " p2" : ""}`}>
      {eyebrow && <div className="doc-sec-eyebrow">{eyebrow}</div>}
      {titulo && <h2 className="doc-sec-t">{titulo}</h2>}
      {intent && <p className="doc-sec-intent">{intent}</p>}
      {children}
    </section>
  );
}
