import { NextResponse } from "next/server";
import { prosaIaActiva } from "@/lib/prosa-ia-interruptor";

// ─────────────────────────────────────────────────────────────────────────────
// LA NARRATIVA IA DE LA COMPARATIVA, RETIRADA (25-sep-2026)
//
// La IA salió del informe. Desde la parte 1 del retiro esta ruta respondía 410 con el interruptor
// apagado; en la parte 2 se borró el generador de AMBAS y su prompt, así que ya no hay nada que
// generar: responde 410 siempre. Nada del producto la llama (la comparativa dejó de pedir la
// prosa). Se va con el interruptor, en la última parte.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST() {
  void prosaIaActiva;
  return NextResponse.json({ error: "La narrativa IA de la comparativa está retirada" }, { status: 410 });
}
