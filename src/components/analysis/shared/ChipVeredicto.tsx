// ─────────────────────────────────────────────────────────────────────────────
// EL CHIP DE VEREDICTO — uno solo para todo el informe (25-sep-2026)
//
// Decisión de Fabrizio: todo chip que nombra un veredicto es el del pop-up de ajustes —
// ✓ Comprar azul, − Ajustar ciruela, ✕ Buscar otro rojo, cada uno con su tinte—, y sale de
// ESTE componente. Antes convivían al menos tres: la píldora neutra blanca de la card de Franco,
// la píldora sólida en mono del capítulo «A qué precio cerrar» y la del pop-up. El sello grande
// de la portada NO es un chip (es el veredicto mismo) y no pasa por acá.
//
// DOS VARIANTES:
//  · `normal` — sobre el papel del informe. Los hexes del pop-up (mockup
//    docs/wireframes/rediseno-informe/popup-matriz-aprobado.html), por tema: en claro Comprar
//    es azul pleno con letra blanca y los otros dos, tintes; en oscuro, lo mismo aclarado.
//  · `sobre-fondo` — sobre la card de Franco, cuyo fondo es SIEMPRE oscuro (del tono profundo del
//    veredicto a tinta, en los dos temas). Ahí el tinte del tema oscuro desaparece contra el fondo
//    y el azul pleno del claro se funde con él, así que la variante es un chip SÓLIDO CLARO con
//    letra oscura del mismo tono, igual en los dos temas. Contraste texto/chip medido: Comprar
//    7,9:1, Ajustar 8,8:1, Buscar otro 6,8:1.
//
// El CSS vive en `CSS_CHIP_VEREDICTO`, que `DocTokens` monta en LTR y STR (el chip se dibuja igual
// dentro de la página y de los modales) y `ChipVeredictoTokens` en AMBAS, que no monta `DocTokens`.
// El chip no depende de ningún token del informe: sus hexes son propios, así que se ve igual donde
// se monte.
// ─────────────────────────────────────────────────────────────────────────────
import type { Veredicto } from "@/lib/types";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";

const CLASE: Record<Veredicto, "c" | "a" | "b"> = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" };

export type VarianteChipVeredicto = "normal" | "sobre-fondo";

export function ChipVeredicto({ v, variante = "normal" }: { v: Veredicto; variante?: VarianteChipVeredicto }) {
  return (
    <span className={`chip-v ${CLASE[v] ?? "a"}${variante === "sobre-fondo" ? " sobre" : ""}`} data-veredicto={v}>
      {signoVeredicto(v)} {etiquetaVeredicto(v, "frase")}
    </span>
  );
}

export const CSS_CHIP_VEREDICTO = `
      /* ═══ EL CHIP DE VEREDICTO (ChipVeredicto.tsx) ═══ Uno solo en todo el informe. */
      .chip-v{display:inline-flex;align-items:center;gap:3px;font-family:var(--font-body,system-ui);font-weight:600;
        font-size:12px;line-height:1.5;border-radius:99px;padding:1px 8px;white-space:nowrap;border:1px solid transparent;
        letter-spacing:0;text-transform:none;vertical-align:baseline}
      .chip-v.c{background:#8DB0E3;color:#0B1A2E;border-color:#8DB0E3}
      .chip-v.a{background:#35232F;color:#D8AECA;border-color:#4E3545}
      .chip-v.b{background:#3E1E21;color:#F0858C;border-color:#5C2B30}
      [data-theme="light"] .chip-v.c{background:#2B558F;color:#FFFFFF;border-color:#2B558F}
      [data-theme="light"] .chip-v.a{background:#F1E4EC;color:#6E4560;border-color:#DCC6D4}
      [data-theme="light"] .chip-v.b{background:#F7DEDF;color:#C8323C;border-color:#EDBFC2}
      /* SOBRE FONDO (la card de Franco, oscura en los dos temas): sólido claro, igual en ambos. */
      .chip-v.sobre.c,[data-theme="light"] .chip-v.sobre.c{background:#8DB0E3;color:#0B1A2E;border-color:#8DB0E3}
      .chip-v.sobre.a,[data-theme="light"] .chip-v.sobre.a{background:#D8AECA;color:#2A1622;border-color:#D8AECA}
      .chip-v.sobre.b,[data-theme="light"] .chip-v.sobre.b{background:#F0858C;color:#3A0D11;border-color:#F0858C}
`;

/** El CSS del chip para las páginas que no montan `DocTokens` (la comparativa AMBAS). */
export function ChipVeredictoTokens() {
  return <style dangerouslySetInnerHTML={{ __html: CSS_CHIP_VEREDICTO }} />;
}
