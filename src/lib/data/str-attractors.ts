export interface Attractor {
  nombre: string;
  lat: number;
  lng: number;
  tipo: 'metro' | 'clinica' | 'negocios' | 'turismo' | 'ski';
  comuna?: string;
}

// CLÍNICAS Y HOSPITALES PRINCIPALES
export const CLINICAS: Attractor[] = [
  { nombre: "Clínica Alemana", lat: -33.4012, lng: -70.5874, tipo: "clinica", comuna: "Vitacura" },
  { nombre: "Clínica Las Condes", lat: -33.4088, lng: -70.5717, tipo: "clinica", comuna: "Las Condes" },
  { nombre: "Clínica Santa María", lat: -33.4222, lng: -70.6369, tipo: "clinica", comuna: "Providencia" },
  { nombre: "Clínica Indisa", lat: -33.4286, lng: -70.6329, tipo: "clinica", comuna: "Providencia" },
  { nombre: "Clínica UC Christus", lat: -33.4418, lng: -70.6535, tipo: "clinica", comuna: "Santiago" },
  { nombre: "Clínica Dávila", lat: -33.4204, lng: -70.6742, tipo: "clinica", comuna: "Recoleta" },
  { nombre: "Clínica RedSalud Vitacura", lat: -33.3969, lng: -70.5990, tipo: "clinica", comuna: "Vitacura" },
  { nombre: "Clínica Meds", lat: -33.3986, lng: -70.5673, tipo: "clinica", comuna: "Lo Barnechea" },
  { nombre: "Hospital Salvador", lat: -33.4432, lng: -70.6315, tipo: "clinica", comuna: "Providencia" },
  { nombre: "Hospital Clínico U. Chile", lat: -33.4207, lng: -70.6526, tipo: "clinica", comuna: "Independencia" },
  { nombre: "Hospital Sótero del Río", lat: -33.5248, lng: -70.5848, tipo: "clinica", comuna: "Puente Alto" },
  { nombre: "FALP (Oncológico)", lat: -33.4427, lng: -70.6361, tipo: "clinica", comuna: "Providencia" },
  { nombre: "Hospital Calvo Mackenna", lat: -33.4461, lng: -70.6231, tipo: "clinica", comuna: "Providencia" },
];

// ZONAS DE NEGOCIOS
export const ZONAS_NEGOCIOS: Attractor[] = [
  { nombre: "El Golf / Sanhattan", lat: -33.4172, lng: -70.6053, tipo: "negocios", comuna: "Las Condes" },
  { nombre: "Nueva Las Condes", lat: -33.4048, lng: -70.5760, tipo: "negocios", comuna: "Las Condes" },
  { nombre: "Centro Financiero Santiago", lat: -33.4400, lng: -70.6530, tipo: "negocios", comuna: "Santiago" },
];

// ZONAS TURÍSTICAS
export const ZONAS_TURISTICAS: Attractor[] = [
  { nombre: "Bellavista / Pío Nono", lat: -33.4310, lng: -70.6370, tipo: "turismo", comuna: "Recoleta" },
  { nombre: "Barrio Lastarria", lat: -33.4380, lng: -70.6420, tipo: "turismo", comuna: "Santiago" },
  { nombre: "Barrio Italia", lat: -33.4510, lng: -70.6310, tipo: "turismo", comuna: "Providencia" },
  { nombre: "Centro Histórico / Plaza de Armas", lat: -33.4378, lng: -70.6504, tipo: "turismo", comuna: "Santiago" },
  { nombre: "Cerro San Cristóbal", lat: -33.4252, lng: -70.6340, tipo: "turismo", comuna: "Providencia" },
];

// ACCESO A CENTROS DE SKI
export const ACCESO_SKI: Attractor[] = [
  { nombre: "Inicio ruta Farellones/Valle Nevado", lat: -33.3550, lng: -70.4580, tipo: "ski" },
];

export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanciaMinima(lat: number, lng: number, attractors: Attractor[]): { distancia: number; nombre: string } {
  let min = Infinity;
  let closest = "";
  for (const a of attractors) {
    const d = distanciaMetros(lat, lng, a.lat, a.lng);
    if (d < min) { min = d; closest = a.nombre; }
  }
  return { distancia: min, nombre: closest };
}
