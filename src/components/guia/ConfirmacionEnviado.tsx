// ─────────────────────────────────────────────────────────────────────────────
// LA CONFIRMACIÓN DE «QUIERO VERLO» (25-oct-2026, recorrido de Fabrizio en el teléfono con un correo largo): «Listo: te lo
// mandamos a …» se desbordaba y las palabras se partían letra por letra —el texto era un ítem flex suelto junto al visto,
// que se encogía al mínimo con `overflow-wrap: anywhere`—. Ahora va en dos líneas: «Listo: te lo mandamos a» arriba y el
// correo abajo, en Inter normal, con el corte sugerido antes del arroba (<wbr>) si no cabe. Lo mismo para «Ya te lo
// mandamos el …», con el asunto en una tercera línea. Puro: lo dibujan el informe (InformeDeAviso) y /dev/quiero-verlo.
// ─────────────────────────────────────────────────────────────────────────────
import { INFORME_DE_AVISO } from "@/lib/guia/copy";

// El espacio duro (U+00A0) entre las dos últimas palabras del título: a 390, «Ya te lo mandamos el 17 de octubre a»
// dejaba la «a» sola en la segunda línea. Así baja con «octubre» (25-oct-2026).
const ESPACIO_DURO = String.fromCharCode(0xa0);
export const sinViuda = (s: string) => s.replace(/ (\S+)$/, (_, ult: string) => ESPACIO_DURO + ult);

/** El correo con el corte sugerido antes del arroba: «nombre» / «@dominio». */
export function CorreoConCorte({ correo }: { correo: string }) {
  const i = correo.lastIndexOf("@");
  if (i <= 0) return <>{correo}</>;
  return <>{correo.slice(0, i)}<wbr />{correo.slice(i)}</>;
}

export function ConfirmacionEnviado({ tipo, correo, cuando = null, asunto = null }: { tipo: "listo" | "ya"; correo: string | null; cuando?: string | null; asunto?: string | null }) {
  const p = INFORME_DE_AVISO.partes(tipo, correo, cuando, asunto);
  return (
    <p className="qv-listo" role="status" data-qv-confirmacion={tipo}>
      <span className="qv-ok" aria-hidden="true">✓</span>
      <span className="qv-listo-txt">
        <span className="qv-listo-t">{sinViuda(p.titulo)}</span>
        <span className="qv-correo" data-qv="correo">{correo ? <CorreoConCorte correo={p.correo} /> : p.correo}</span>
        {p.cola && <span className="qv-cola">{p.cola}</span>}
      </span>
    </p>
  );
}
