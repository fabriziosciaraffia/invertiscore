export interface ComunaData {
  comuna: string;
  ciudad: string;
  region: string;
}

export const REGIONES = [
  "Metropolitana",
  "Valparaíso",
  "Biobío",
  "Araucanía",
  "Los Lagos",
  "O'Higgins",
  "Maule",
  "Coquimbo",
  "Antofagasta",
  "Tarapacá",
  "Atacama",
  "Ñuble",
  "Los Ríos",
  "Arica y Parinacota",
  "Magallanes",
] as const;

export const COMUNAS: ComunaData[] = [
  // ===== REGIÓN METROPOLITANA (52 comunas) =====
  // Sector Oriente
  { comuna: "Providencia", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Las Condes", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Vitacura", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Lo Barnechea", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "La Reina", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Peñalolén", ciudad: "Santiago", region: "Metropolitana" },
  // Centro
  { comuna: "Santiago Centro", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Ñuñoa", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Macul", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Joaquín", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Miguel", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Independencia", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Recoleta", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Quinta Normal", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Estación Central", ciudad: "Santiago", region: "Metropolitana" },
  // Sur
  { comuna: "La Florida", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Puente Alto", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "La Cisterna", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Bernardo", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "La Granja", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "El Bosque", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Ramón", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Lo Espejo", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Pedro Aguirre Cerda", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "La Pintana", ciudad: "Santiago", region: "Metropolitana" },
  // Poniente
  { comuna: "Maipú", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Cerrillos", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Cerro Navia", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Lo Prado", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Pudahuel", ciudad: "Santiago", region: "Metropolitana" },
  // Norte
  { comuna: "Huechuraba", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Quilicura", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Conchalí", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Renca", ciudad: "Santiago", region: "Metropolitana" },
  // Periféricas
  { comuna: "Colina", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Lampa", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Til Til", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Buin", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Paine", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Calera de Tango", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Padre Hurtado", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Peñaflor", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Talagante", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "El Monte", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Isla de Maipo", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San José de Maipo", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Pirque", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "San Pedro", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Alhué", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Curacaví", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "María Pinto", ciudad: "Santiago", region: "Metropolitana" },
  { comuna: "Melipilla", ciudad: "Santiago", region: "Metropolitana" },

  // ===== VALPARAÍSO =====
  { comuna: "Valparaíso", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Viña del Mar", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Con Con", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Quilpué", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "Villa Alemana", ciudad: "Valparaíso", region: "Valparaíso" },
  { comuna: "San Antonio", ciudad: "San Antonio", region: "Valparaíso" },
  { comuna: "Quillota", ciudad: "Quillota", region: "Valparaíso" },
  { comuna: "La Calera", ciudad: "La Calera", region: "Valparaíso" },
  { comuna: "Los Andes", ciudad: "Los Andes", region: "Valparaíso" },
  { comuna: "San Felipe", ciudad: "San Felipe", region: "Valparaíso" },
  { comuna: "Limache", ciudad: "Limache", region: "Valparaíso" },

  // ===== BIOBÍO =====
  { comuna: "Concepción", ciudad: "Concepción", region: "Biobío" },
  { comuna: "Talcahuano", ciudad: "Concepción", region: "Biobío" },
  { comuna: "Hualpén", ciudad: "Concepción", region: "Biobío" },
  { comuna: "San Pedro de la Paz", ciudad: "Concepción", region: "Biobío" },
  { comuna: "Chiguayante", ciudad: "Concepción", region: "Biobío" },
  { comuna: "Coronel", ciudad: "Concepción", region: "Biobío" },
  { comuna: "Los Ángeles", ciudad: "Los Ángeles", region: "Biobío" },

  // ===== ARAUCANÍA =====
  { comuna: "Temuco", ciudad: "Temuco", region: "Araucanía" },
  { comuna: "Padre Las Casas", ciudad: "Temuco", region: "Araucanía" },
  { comuna: "Villarrica", ciudad: "Villarrica", region: "Araucanía" },
  { comuna: "Pucón", ciudad: "Pucón", region: "Araucanía" },

  // ===== LOS LAGOS =====
  { comuna: "Puerto Montt", ciudad: "Puerto Montt", region: "Los Lagos" },
  { comuna: "Puerto Varas", ciudad: "Puerto Montt", region: "Los Lagos" },
  { comuna: "Osorno", ciudad: "Osorno", region: "Los Lagos" },
  { comuna: "Castro", ciudad: "Castro", region: "Los Lagos" },

  // ===== O'HIGGINS =====
  { comuna: "Rancagua", ciudad: "Rancagua", region: "O'Higgins" },
  { comuna: "Machalí", ciudad: "Rancagua", region: "O'Higgins" },
  { comuna: "San Fernando", ciudad: "San Fernando", region: "O'Higgins" },

  // ===== MAULE =====
  { comuna: "Talca", ciudad: "Talca", region: "Maule" },
  { comuna: "Curicó", ciudad: "Curicó", region: "Maule" },
  { comuna: "Linares", ciudad: "Linares", region: "Maule" },

  // ===== COQUIMBO =====
  { comuna: "La Serena", ciudad: "La Serena", region: "Coquimbo" },
  { comuna: "Coquimbo", ciudad: "Coquimbo", region: "Coquimbo" },
  { comuna: "Ovalle", ciudad: "Ovalle", region: "Coquimbo" },

  // ===== ANTOFAGASTA =====
  { comuna: "Antofagasta", ciudad: "Antofagasta", region: "Antofagasta" },
  { comuna: "Calama", ciudad: "Calama", region: "Antofagasta" },

  // ===== TARAPACÁ =====
  { comuna: "Iquique", ciudad: "Iquique", region: "Tarapacá" },
  { comuna: "Alto Hospicio", ciudad: "Iquique", region: "Tarapacá" },

  // ===== ATACAMA =====
  { comuna: "Copiapó", ciudad: "Copiapó", region: "Atacama" },
  { comuna: "Vallenar", ciudad: "Vallenar", region: "Atacama" },

  // ===== ÑUBLE =====
  { comuna: "Chillán", ciudad: "Chillán", region: "Ñuble" },
  { comuna: "Chillán Viejo", ciudad: "Chillán", region: "Ñuble" },

  // ===== LOS RÍOS =====
  { comuna: "Valdivia", ciudad: "Valdivia", region: "Los Ríos" },

  // ===== ARICA Y PARINACOTA =====
  { comuna: "Arica", ciudad: "Arica", region: "Arica y Parinacota" },

  // ===== MAGALLANES =====
  { comuna: "Punta Arenas", ciudad: "Punta Arenas", region: "Magallanes" },
];

// Reference data for market suggestions
export interface ComunaMarketData {
  arriendoPorM2: number; // CLP/m² mensual
  gastosComunesPorM2: number; // CLP/m² mensual
  contribucionesPctAnual: number; // % del precio UF como contribución anual
}

// Average market data by commune type (used for suggestions)
export const COMUNA_MARKET_DATA: Record<string, ComunaMarketData> = {
  // Premium
  "Providencia": { arriendoPorM2: 9500, gastosComunesPorM2: 1400, contribucionesPctAnual: 0.9 },
  "Las Condes": { arriendoPorM2: 9000, gastosComunesPorM2: 1500, contribucionesPctAnual: 1.0 },
  "Vitacura": { arriendoPorM2: 8500, gastosComunesPorM2: 1600, contribucionesPctAnual: 1.1 },
  "Lo Barnechea": { arriendoPorM2: 8000, gastosComunesPorM2: 1500, contribucionesPctAnual: 1.0 },
  "Ñuñoa": { arriendoPorM2: 8500, gastosComunesPorM2: 1300, contribucionesPctAnual: 0.9 },
  "La Reina": { arriendoPorM2: 7500, gastosComunesPorM2: 1200, contribucionesPctAnual: 0.9 },
  "Santiago Centro": { arriendoPorM2: 8000, gastosComunesPorM2: 1200, contribucionesPctAnual: 0.8 },
  // Mid-range
  "San Miguel": { arriendoPorM2: 7500, gastosComunesPorM2: 1200, contribucionesPctAnual: 0.8 },
  "Macul": { arriendoPorM2: 7000, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "La Florida": { arriendoPorM2: 6500, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "Independencia": { arriendoPorM2: 7500, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "Estación Central": { arriendoPorM2: 7000, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "Peñalolén": { arriendoPorM2: 6500, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "Recoleta": { arriendoPorM2: 7000, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
  "Maipú": { arriendoPorM2: 6000, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
  "Quilicura": { arriendoPorM2: 5500, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
  "Puente Alto": { arriendoPorM2: 5500, gastosComunesPorM2: 900, contribucionesPctAnual: 0.7 },
  "San Bernardo": { arriendoPorM2: 5000, gastosComunesPorM2: 900, contribucionesPctAnual: 0.7 },
  "Huechuraba": { arriendoPorM2: 6000, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "Colina": { arriendoPorM2: 5500, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.7 },
  // Valparaíso
  "Viña del Mar": { arriendoPorM2: 7000, gastosComunesPorM2: 1200, contribucionesPctAnual: 0.9 },
  "Con Con": { arriendoPorM2: 7500, gastosComunesPorM2: 1300, contribucionesPctAnual: 0.9 },
  "Valparaíso": { arriendoPorM2: 6000, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
  // Regiones
  "Concepción": { arriendoPorM2: 5500, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
  "Temuco": { arriendoPorM2: 5000, gastosComunesPorM2: 900, contribucionesPctAnual: 0.7 },
  "Antofagasta": { arriendoPorM2: 6500, gastosComunesPorM2: 1100, contribucionesPctAnual: 0.8 },
  "La Serena": { arriendoPorM2: 5500, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
  "Puerto Montt": { arriendoPorM2: 5000, gastosComunesPorM2: 900, contribucionesPctAnual: 0.7 },
  "Rancagua": { arriendoPorM2: 5000, gastosComunesPorM2: 900, contribucionesPctAnual: 0.7 },
  "Talca": { arriendoPorM2: 4500, gastosComunesPorM2: 800, contribucionesPctAnual: 0.7 },
  "Iquique": { arriendoPorM2: 6000, gastosComunesPorM2: 1000, contribucionesPctAnual: 0.8 },
};

// Default values for comunas without specific data
export const DEFAULT_MARKET_DATA: ComunaMarketData = {
  arriendoPorM2: 6000,
  gastosComunesPorM2: 1100,
  contribucionesPctAnual: 0.8,
};

export function getMarketData(comuna: string): ComunaMarketData {
  return COMUNA_MARKET_DATA[comuna] || DEFAULT_MARKET_DATA;
}
