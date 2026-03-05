export interface ComunaData {
  comuna: string;
  ciudad: string;
  region: string;
}

export const COMUNAS: ComunaData[] = [
  // Santiago - Sector Oriente
  { comuna: "Providencia", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Las Condes", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Vitacura", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Lo Barnechea", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "La Reina", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Peñalolén", ciudad: "Santiago", region: "Metropolitana" },
  // Santiago - Centro
  { comuna: "Santiago Centro", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Ñuñoa", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Macul", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Joaquín", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Miguel", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Independencia", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Recoleta", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Quinta Normal", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Estación Central", ciudad: "Santiago", region: "Metropolitana" },
  // Santiago - Sur
  { comuna: "La Florida", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Puente Alto", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "La Cisterna", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Bernardo", ciudad: "Santiago", region: "Metropolitana" },
  // Santiago - Poniente/Norte
  { comuna: "Maipú", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Cerrillos", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Huechuraba", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Quilicura", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Colina", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Lampa", ciudad: "Santiago", region: "Metropolitana" },
  // Valparaíso
  { comuna: "Valparaíso", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Viña del Mar", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Con Con", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Quilpué", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Villa Alemana", ciudad: "Valparaíso", region: "Valparaíso" },
  // Regiones
  { comuna: "Concepción", ciudad: "Concepción", region: "Biobío" },
  { comuna: "Temuco", ciudad: "Temuco", region: "Araucanía" },
  { comuna: "Antofagasta", ciudad: "Antofagasta", region: "Antofagasta" },
  { comuna: "La Serena", ciudad: "La Serena", region: "Coquimbo" },
  { comuna: "Coquimbo", ciudad: "Coquimbo", region: "Coquimbo" },
  { comuna: "Rancagua", ciudad: "Rancagua", region: "O'Higgins" },
  { comuna: "Talca", ciudad: "Talca", region: "Maule" },
  { comuna: "Puerto Montt", ciudad: "Puerto Montt", region: "Los Lagos" },
  { comuna: "Puerto Varas", ciudad: "Puerto Montt", region: "Los Lagos" },
  { comuna: "Iquique", ciudad: "Iquique", region: "Tarapacá" },
  { comuna: "Punta Arenas", ciudad: "Punta Arenas", region: "Magallanes" },
];
