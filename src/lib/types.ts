export interface Desglose {
  rentabilidad: number;
  plusvalia: number;
  riesgo: number;
  ubicacion: number;
}

export interface Analisis {
  id: string;
  user_id: string;
  nombre: string;
  comuna: string;
  ciudad: string;
  direccion: string | null;
  tipo: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  antiguedad: number;
  precio: number;
  arriendo: number;
  gastos: number;
  contribuciones: number;
  score: number;
  desglose: Desglose;
  resumen: string;
  created_at: string;
}

export interface AnalisisInput {
  nombre: string;
  comuna: string;
  ciudad: string;
  direccion?: string;
  tipo: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  antiguedad: number;
  precio: number;
  arriendo: number;
  gastos: number;
  contribuciones: number;
}
