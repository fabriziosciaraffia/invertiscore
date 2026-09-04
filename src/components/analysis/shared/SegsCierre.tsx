"use client";

import type { SegCierre } from "@/lib/cierres-capitulos";

/** Pinta los segmentos de un cierre determinista: `mark` = plumón (el CSS del
 *  acordeón lo colorea). Compartido LTR/STR desde T1; antes vivía local en
 *  CapitulosInversion. */
export function SegsCierre({ segs }: { segs: SegCierre[] }) {
  return (
    <>
      {segs.map((s, i) => (s.mark ? <mark key={i}>{s.t}</mark> : <span key={i}>{s.t}</span>))}
    </>
  );
}
