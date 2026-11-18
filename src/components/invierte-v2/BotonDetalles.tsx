"use client";

// «Ver detalles» / «Abrir» de un depto del flujo (etapa 2, 18-nov-2026): crea (o reabre) los detalles por la ruta de la guía,
// desde el mapa, con pie 20 % y 30 años; a quien firmó no le gasta un crédito (charge_mode 'invierte').
import { useState } from "react";

export function BotonDetalles({ avisoId, etiqueta, clase = "iv2-enlace-azul" }: { avisoId: string; etiqueta: string; clase?: string }) {
  const [estado, setEstado] = useState<"listo" | "abriendo" | "error">("listo");
  async function abrir() {
    if (estado === "abriendo") return;
    setEstado("abriendo");
    try {
      const res = await fetch("/api/lo-que-sigue/guia/analizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avisoId, explorar: true, piePct: 20, plazoAnios: 30 }) });
      const d = (await res.json().catch(() => ({}))) as { id?: string };
      if (res.ok && d.id) { window.location.assign(`/analisis/${d.id}`); return; }
    } catch { /* abajo */ }
    setEstado("error");
  }
  return (
    <button type="button" className={clase} onClick={abrir} disabled={estado === "abriendo"} data-inv2="ver-detalles">
      {estado === "abriendo" ? "Abriendo…" : estado === "error" ? "No se pudo abrir: intenta de nuevo" : etiqueta}
    </button>
  );
}
