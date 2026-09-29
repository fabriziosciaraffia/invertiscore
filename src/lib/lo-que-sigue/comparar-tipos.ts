// Lo que comparte /comparar entre el servidor y la vista (cliente): constantes y tipos, sin
// importar nada del motor ni de Supabase (la vista no puede arrastrar next/headers).
import type { Veredicto } from "@/lib/types";

export const COMPARAR_MIN = 2;
export const COMPARAR_MAX = 4;

export interface OpcionComparar {
  id: string;
  nombre: string;
  comuna: string | null;
  modalidad: "ltr" | "str";
  createdAt: string;
}

export interface ColumnaComparar {
  id: string;
  nombre: string;
  comuna: string | null;
  modalidad: "ltr" | "str";
  veredicto: Veredicto | null;
  precioUF: number | null;
  flujoMensualCLP: number | null;
  resultado10CLP: number | null;
  uf: number;
}
