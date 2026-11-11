"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LOS DEPTOS EN QUE LA PERSONA YA ESTÁ INSCRITA (11-nov-2026, «Pronto: Invierte con Franco»): un almacén del navegador que
// comparten todas las tarjetas de la página (Explorar, la selección del dashboard). Se pide UNA vez a GET /api/invierte y, al
// inscribirse, se agrega al instante: la tarjeta pasa del botón a la etiqueta «Inscrito en Invierte con Franco» sin recargar.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

let inscritos: Set<string> = new Set();
let pedido: Promise<void> | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

function cargar(): Promise<void> {
  if (!pedido) {
    pedido = fetch("/api/invierte", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { avisos: [] }))
      .then((d: { avisos?: unknown }) => {
        const nuevos = Array.isArray(d.avisos) ? d.avisos.filter((x): x is string => typeof x === "string") : [];
        inscritos = new Set([...Array.from(inscritos), ...nuevos]);
        avisar();
      })
      .catch(() => { pedido = null; });
  }
  return pedido;
}

/** La persona se acaba de inscribir en este depto. */
export function marcarInscrito(avisoId: string): void {
  if (inscritos.has(avisoId)) return;
  inscritos = new Set([...Array.from(inscritos), avisoId]);
  avisar();
}

/** Los inscritos (con cuenta). Sin cuenta no pide nada: devuelve un conjunto vacío. */
export function useInscritos(conCuenta: boolean): ReadonlySet<string> {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    oyentes.add(f);
    if (conCuenta) void cargar();
    return () => { oyentes.delete(f); };
  }, [conCuenta]);
  return inscritos;
}
