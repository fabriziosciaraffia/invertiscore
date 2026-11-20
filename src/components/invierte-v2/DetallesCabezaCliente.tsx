"use client";

// Lo de arriba del informe en modo Invierte, del lado del navegador (20-nov-2026): las fotos y «Lo que ve Franco» en su versión
// larga. Si la publicación no se había leído, la lectura la lee en segundo plano y las fotos aparecen solas cuando llegan.
import { useState, type ReactNode } from "react";
import type { LecturaFranco } from "@/lib/invierte-v2/lectura-franco";
import { FotosDepto } from "./FotosDepto";
import { LoQueVeFranco } from "./LoQueVeFranco";

export function DetallesCabezaCliente({ avisoId, fotos: fotosIniciales, lectura, children }: { avisoId: string; fotos: number; lectura: LecturaFranco | null; children?: ReactNode }) {
  const [fotos, setFotos] = useState(fotosIniciales);
  return (
    <>
      <FotosDepto avisoId={avisoId} n={fotos} clase="iv2-det-fotos" />
      {children}
      {/* La versión larga, antes del informe; «Lo que el puntaje no considera» (grave o revisar) va primero (entrega 4). */}
      <LoQueVeFranco avisoId={avisoId} variante="detalles" inicial={lectura} alFotos={(n) => setFotos((f) => (f === n ? f : n))} />
    </>
  );
}
