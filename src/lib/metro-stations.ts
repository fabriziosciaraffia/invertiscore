// src/lib/metro-stations.ts

export interface MetroStation {
  name: string;
  line: string;
  lat: number;
  lng: number;
  status: "active" | "future"; // future = L7, L8, L9
}

export const METRO_STATIONS: MetroStation[] = [
  // ===== LÍNEA 1 (Roja) — 27 estaciones =====
  { name: "San Pablo", line: "L1", lat: -33.4425, lng: -70.7141, status: "active" },
  { name: "Neptuno", line: "L1", lat: -33.4441, lng: -70.7042, status: "active" },
  { name: "Pajaritos", line: "L1", lat: -33.4458, lng: -70.6943, status: "active" },
  { name: "Las Rejas", line: "L1", lat: -33.4480, lng: -70.6840, status: "active" },
  { name: "Ecuador", line: "L1", lat: -33.4496, lng: -70.6766, status: "active" },
  { name: "San Alberto Hurtado", line: "L1", lat: -33.4518, lng: -70.6696, status: "active" },
  { name: "Universidad de Santiago", line: "L1", lat: -33.4500, lng: -70.6614, status: "active" },
  { name: "Estación Central", line: "L1", lat: -33.4522, lng: -70.6539, status: "active" },
  { name: "Unión Latinoamericana", line: "L1", lat: -33.4524, lng: -70.6470, status: "active" },
  { name: "República", line: "L1", lat: -33.4529, lng: -70.6395, status: "active" },
  { name: "Los Héroes", line: "L1", lat: -33.4463, lng: -70.6537, status: "active" },
  { name: "La Moneda", line: "L1", lat: -33.4427, lng: -70.6508, status: "active" },
  { name: "Universidad de Chile", line: "L1", lat: -33.4424, lng: -70.6448, status: "active" },
  { name: "Santa Lucía", line: "L1", lat: -33.4414, lng: -70.6386, status: "active" },
  { name: "Universidad Católica", line: "L1", lat: -33.4416, lng: -70.6340, status: "active" },
  { name: "Baquedano", line: "L1", lat: -33.4372, lng: -70.6349, status: "active" },
  { name: "Salvador", line: "L1", lat: -33.4355, lng: -70.6274, status: "active" },
  { name: "Manuel Montt", line: "L1", lat: -33.4318, lng: -70.6192, status: "active" },
  { name: "Pedro de Valdivia", line: "L1", lat: -33.4253, lng: -70.6135, status: "active" },
  { name: "Los Leones", line: "L1", lat: -33.4232, lng: -70.6075, status: "active" },
  { name: "Tobalaba", line: "L1", lat: -33.4194, lng: -70.6001, status: "active" },
  { name: "El Golf", line: "L1", lat: -33.4143, lng: -70.5949, status: "active" },
  { name: "Alcántara", line: "L1", lat: -33.4105, lng: -70.5895, status: "active" },
  { name: "Escuela Militar", line: "L1", lat: -33.4050, lng: -70.5811, status: "active" },
  { name: "Manquehue", line: "L1", lat: -33.3975, lng: -70.5686, status: "active" },
  { name: "Hernando de Magallanes", line: "L1", lat: -33.3929, lng: -70.5588, status: "active" },
  { name: "Los Dominicos", line: "L1", lat: -33.3906, lng: -70.5465, status: "active" },

  // ===== LÍNEA 2 (Amarilla) — 22 estaciones =====
  { name: "Vespucio Norte", line: "L2", lat: -33.3905, lng: -70.6425, status: "active" },
  { name: "Zapadores", line: "L2", lat: -33.3960, lng: -70.6472, status: "active" },
  { name: "Dorsal", line: "L2", lat: -33.4005, lng: -70.6515, status: "active" },
  { name: "Einstein", line: "L2", lat: -33.4060, lng: -70.6537, status: "active" },
  { name: "Cerro Blanco", line: "L2", lat: -33.4143, lng: -70.6556, status: "active" },
  { name: "Patronato", line: "L2", lat: -33.4212, lng: -70.6531, status: "active" },
  { name: "Puente Cal y Canto", line: "L2", lat: -33.4300, lng: -70.6505, status: "active" },
  { name: "Santa Ana", line: "L2", lat: -33.4405, lng: -70.6517, status: "active" },
  { name: "Toesca", line: "L2", lat: -33.4555, lng: -70.6573, status: "active" },
  { name: "Parque O'Higgins", line: "L2", lat: -33.4623, lng: -70.6581, status: "active" },
  { name: "Rondizzoni", line: "L2", lat: -33.4692, lng: -70.6588, status: "active" },
  { name: "Franklin", line: "L2", lat: -33.4747, lng: -70.6596, status: "active" },
  { name: "El Llano", line: "L2", lat: -33.4850, lng: -70.6580, status: "active" },
  { name: "San Miguel", line: "L2", lat: -33.4964, lng: -70.6571, status: "active" },
  { name: "Lo Vial", line: "L2", lat: -33.5024, lng: -70.6568, status: "active" },
  { name: "Departamental", line: "L2", lat: -33.5098, lng: -70.6564, status: "active" },
  { name: "Ciudad del Niño", line: "L2", lat: -33.5179, lng: -70.6558, status: "active" },
  { name: "Lo Ovalle", line: "L2", lat: -33.5253, lng: -70.6555, status: "active" },
  { name: "El Bosque", line: "L2", lat: -33.5460, lng: -70.6582, status: "active" },
  { name: "Observatorio", line: "L2", lat: -33.5580, lng: -70.6580, status: "active" },
  { name: "Copa Lo Martínez", line: "L2", lat: -33.5700, lng: -70.6570, status: "active" },
  { name: "Hospital El Pino", line: "L2", lat: -33.5810, lng: -70.6565, status: "active" },

  // ===== LÍNEA 3 (Café) — 22 estaciones =====
  { name: "Plaza Quilicura", line: "L3", lat: -33.3620, lng: -70.7338, status: "active" },
  { name: "Las Torres", line: "L3", lat: -33.3690, lng: -70.7220, status: "active" },
  { name: "EFE Quilicura", line: "L3", lat: -33.3760, lng: -70.7100, status: "active" },
  { name: "Los Libertadores", line: "L3", lat: -33.3837, lng: -70.6977, status: "active" },
  { name: "Cardenal Caro", line: "L3", lat: -33.3900, lng: -70.6890, status: "active" },
  { name: "Vivaceta", line: "L3", lat: -33.3995, lng: -70.6790, status: "active" },
  { name: "Conchalí", line: "L3", lat: -33.4050, lng: -70.6725, status: "active" },
  { name: "Plaza Chacabuco", line: "L3", lat: -33.4130, lng: -70.6650, status: "active" },
  { name: "Hospitales", line: "L3", lat: -33.4216, lng: -70.6580, status: "active" },
  { name: "Plaza de Armas", line: "L3", lat: -33.4378, lng: -70.6504, status: "active" },
  { name: "Parque Almagro", line: "L3", lat: -33.4487, lng: -70.6432, status: "active" },
  { name: "Matta", line: "L3", lat: -33.4565, lng: -70.6378, status: "active" },
  { name: "Irarrázaval", line: "L3", lat: -33.4561, lng: -70.6258, status: "active" },
  { name: "Monseñor Eyzaguirre", line: "L3", lat: -33.4568, lng: -70.6150, status: "active" },
  { name: "Ñuñoa L3", line: "L3", lat: -33.4570, lng: -70.6045, status: "active" },
  { name: "Chile España", line: "L3", lat: -33.4572, lng: -70.5950, status: "active" },
  { name: "Diagonal Oriente", line: "L3", lat: -33.4575, lng: -70.5850, status: "active" },
  { name: "Plaza Egaña", line: "L3", lat: -33.4500, lng: -70.5733, status: "active" },
  { name: "Fernando Castillo Velasco", line: "L3", lat: -33.4452, lng: -70.5650, status: "active" },

  // ===== LÍNEA 4 (Azul) — 23 estaciones =====
  { name: "Cristóbal Colón", line: "L4", lat: -33.4264, lng: -70.5960, status: "active" },
  { name: "Francisco Bilbao", line: "L4", lat: -33.4332, lng: -70.5913, status: "active" },
  { name: "Príncipe de Gales", line: "L4", lat: -33.4413, lng: -70.5854, status: "active" },
  { name: "Simón Bolívar", line: "L4", lat: -33.4465, lng: -70.5803, status: "active" },
  { name: "Los Orientales", line: "L4", lat: -33.4568, lng: -70.5673, status: "active" },
  { name: "Grecia", line: "L4", lat: -33.4620, lng: -70.5617, status: "active" },
  { name: "Los Presidentes", line: "L4", lat: -33.4698, lng: -70.5564, status: "active" },
  { name: "Quilín", line: "L4", lat: -33.4771, lng: -70.5494, status: "active" },
  { name: "Las Torres L4", line: "L4", lat: -33.4827, lng: -70.5457, status: "active" },
  { name: "Macul", line: "L4", lat: -33.4887, lng: -70.5395, status: "active" },
  { name: "Vicuña Mackenna", line: "L4", lat: -33.4983, lng: -70.5365, status: "active" },
  { name: "Vicente Valdés", line: "L4", lat: -33.5090, lng: -70.5400, status: "active" },
  { name: "Rojas Magallanes", line: "L4", lat: -33.5183, lng: -70.5425, status: "active" },
  { name: "Trinidad", line: "L4", lat: -33.5290, lng: -70.5460, status: "active" },
  { name: "San José de la Estrella", line: "L4", lat: -33.5380, lng: -70.5480, status: "active" },
  { name: "Los Quillayes", line: "L4", lat: -33.5490, lng: -70.5520, status: "active" },
  { name: "Elisa Correa", line: "L4", lat: -33.5620, lng: -70.5570, status: "active" },
  { name: "Hospital Sótero del Río", line: "L4", lat: -33.5750, lng: -70.5600, status: "active" },
  { name: "Protectora de la Infancia", line: "L4", lat: -33.5860, lng: -70.5633, status: "active" },
  { name: "Las Mercedes", line: "L4", lat: -33.5960, lng: -70.5660, status: "active" },
  { name: "Plaza de Puente Alto", line: "L4", lat: -33.6100, lng: -70.5720, status: "active" },

  // ===== LÍNEA 4A (Celeste) — 6 estaciones =====
  { name: "Santa Rosa", line: "L4A", lat: -33.5060, lng: -70.5600, status: "active" },
  { name: "Santa Julia", line: "L4A", lat: -33.5100, lng: -70.5780, status: "active" },
  { name: "San Ramón", line: "L4A", lat: -33.5170, lng: -70.5920, status: "active" },
  { name: "La Granja", line: "L4A", lat: -33.5200, lng: -70.6150, status: "active" },
  { name: "La Cisterna", line: "L4A", lat: -33.5265, lng: -70.6397, status: "active" },

  // ===== LÍNEA 5 (Verde) — 30 estaciones =====
  { name: "Plaza de Maipú", line: "L5", lat: -33.5100, lng: -70.7555, status: "active" },
  { name: "Santiago Bueras", line: "L5", lat: -33.5040, lng: -70.7480, status: "active" },
  { name: "Del Sol", line: "L5", lat: -33.4977, lng: -70.7392, status: "active" },
  { name: "Monte Tabor", line: "L5", lat: -33.4930, lng: -70.7320, status: "active" },
  { name: "Las Parcelas", line: "L5", lat: -33.4885, lng: -70.7248, status: "active" },
  { name: "Laguna Sur", line: "L5", lat: -33.4823, lng: -70.7180, status: "active" },
  { name: "Barrancas", line: "L5", lat: -33.4760, lng: -70.7070, status: "active" },
  { name: "Pudahuel", line: "L5", lat: -33.4670, lng: -70.6978, status: "active" },
  { name: "Lo Prado", line: "L5", lat: -33.4430, lng: -70.7195, status: "active" },
  { name: "Blanqueado", line: "L5", lat: -33.4433, lng: -70.7072, status: "active" },
  { name: "Gruta de Lourdes", line: "L5", lat: -33.4382, lng: -70.6910, status: "active" },
  { name: "Quinta Normal", line: "L5", lat: -33.4397, lng: -70.6807, status: "active" },
  { name: "Cumming", line: "L5", lat: -33.4391, lng: -70.6693, status: "active" },
  { name: "Bellas Artes", line: "L5", lat: -33.4359, lng: -70.6436, status: "active" },
  { name: "Parque Bustamante", line: "L5", lat: -33.4416, lng: -70.6268, status: "active" },
  { name: "Santa Isabel", line: "L5", lat: -33.4493, lng: -70.6234, status: "active" },
  { name: "Ñuble", line: "L5", lat: -33.4646, lng: -70.6225, status: "active" },
  { name: "Rodrigo de Araya", line: "L5", lat: -33.4718, lng: -70.6225, status: "active" },
  { name: "Carlos Valdovinos", line: "L5", lat: -33.4800, lng: -70.6221, status: "active" },
  { name: "Camino Agrícola", line: "L5", lat: -33.4875, lng: -70.6218, status: "active" },
  { name: "San Joaquín", line: "L5", lat: -33.4950, lng: -70.6213, status: "active" },
  { name: "Pedrero", line: "L5", lat: -33.5005, lng: -70.6193, status: "active" },
  { name: "Mirador", line: "L5", lat: -33.5060, lng: -70.6128, status: "active" },
  { name: "Bellavista de La Florida", line: "L5", lat: -33.5120, lng: -70.6032, status: "active" },

  // ===== LÍNEA 6 (Morada) — 11 estaciones =====
  { name: "Cerrillos", line: "L6", lat: -33.4950, lng: -70.7100, status: "active" },
  { name: "Lo Valledor", line: "L6", lat: -33.4795, lng: -70.6870, status: "active" },
  { name: "Club Hípico", line: "L6", lat: -33.4692, lng: -70.6680, status: "active" },
  { name: "Franklin L6", line: "L6", lat: -33.4650, lng: -70.6530, status: "active" },
  { name: "Bio Bío", line: "L6", lat: -33.4583, lng: -70.6460, status: "active" },
  { name: "Ñuble L6", line: "L6", lat: -33.4563, lng: -70.6320, status: "active" },
  { name: "Estadio Nacional", line: "L6", lat: -33.4512, lng: -70.6148, status: "active" },
  { name: "Ñuñoa L6", line: "L6", lat: -33.4430, lng: -70.6100, status: "active" },
  { name: "Inés de Suárez", line: "L6", lat: -33.4347, lng: -70.6095, status: "active" },

  // ===== LÍNEA 7 (Gris) — FUTURA, 19 estaciones =====
  { name: "Brasil", line: "L7", lat: -33.4050, lng: -70.6825, status: "future" },
  { name: "José Miguel Infante", line: "L7", lat: -33.4100, lng: -70.6890, status: "future" },
  { name: "Salvador Gutiérrez", line: "L7", lat: -33.4170, lng: -70.6960, status: "future" },
  { name: "Huelén", line: "L7", lat: -33.4210, lng: -70.6990, status: "future" },
  { name: "Neptuno L7", line: "L7", lat: -33.4270, lng: -70.6940, status: "future" },
  { name: "Radal", line: "L7", lat: -33.4290, lng: -70.6850, status: "future" },
  { name: "Walker Martínez", line: "L7", lat: -33.4310, lng: -70.6760, status: "future" },
  { name: "Matucana", line: "L7", lat: -33.4330, lng: -70.6670, status: "future" },
  { name: "Mapocho", line: "L7", lat: -33.4340, lng: -70.6600, status: "future" },
  { name: "Pedro de Valdivia L7", line: "L7", lat: -33.4253, lng: -70.6135, status: "future" },
  { name: "Isidora Goyenechea", line: "L7", lat: -33.4183, lng: -70.6065, status: "future" },
  { name: "Vitacura", line: "L7", lat: -33.4100, lng: -70.6000, status: "future" },
  { name: "Américo Vespucio L7", line: "L7", lat: -33.4050, lng: -70.5820, status: "future" },
  { name: "Parque Araucano", line: "L7", lat: -33.4030, lng: -70.5720, status: "future" },
  { name: "Gerónimo de Alderete", line: "L7", lat: -33.3990, lng: -70.5590, status: "future" },
  { name: "Padre Hurtado L7", line: "L7", lat: -33.3960, lng: -70.5480, status: "future" },
  { name: "Estoril", line: "L7", lat: -33.3920, lng: -70.5350, status: "future" },

  // ===== LÍNEA 8 — FUTURA, ~14 estaciones =====
  { name: "Pocuro", line: "L8", lat: -33.4340, lng: -70.6230, status: "future" },
  { name: "Los Leones L8", line: "L8", lat: -33.4232, lng: -70.6075, status: "future" },
  { name: "Irarrázaval L8", line: "L8", lat: -33.4460, lng: -70.6100, status: "future" },
  { name: "Rodrigo de Araya L8", line: "L8", lat: -33.4650, lng: -70.6050, status: "future" },
  { name: "Macul L8", line: "L8", lat: -33.4800, lng: -70.5980, status: "future" },
  { name: "Quilín L8", line: "L8", lat: -33.4900, lng: -70.5750, status: "future" },
  { name: "La Florida L8", line: "L8", lat: -33.5050, lng: -70.5880, status: "future" },
  { name: "Walker Martínez L8", line: "L8", lat: -33.5150, lng: -70.5850, status: "future" },
  { name: "Rojas Magallanes L8", line: "L8", lat: -33.5250, lng: -70.5780, status: "future" },
  { name: "La Florida Sur L8", line: "L8", lat: -33.5350, lng: -70.5700, status: "future" },
  { name: "Trinidad L8", line: "L8", lat: -33.5450, lng: -70.5620, status: "future" },
  { name: "San José L8", line: "L8", lat: -33.5550, lng: -70.5550, status: "future" },
  { name: "Puente Alto L8", line: "L8", lat: -33.5950, lng: -70.5650, status: "future" },

  // ===== LÍNEA 9 — FUTURA, ~19 estaciones =====
  { name: "Santa Lucía L9", line: "L9", lat: -33.4414, lng: -70.6386, status: "future" },
  { name: "Bio Bío L9", line: "L9", lat: -33.4583, lng: -70.6460, status: "future" },
  { name: "Franklin L9", line: "L9", lat: -33.4747, lng: -70.6530, status: "future" },
  { name: "San Diego", line: "L9", lat: -33.4580, lng: -70.6480, status: "future" },
  { name: "Placer", line: "L9", lat: -33.4700, lng: -70.6470, status: "future" },
  { name: "San Miguel L9", line: "L9", lat: -33.4964, lng: -70.6500, status: "future" },
  { name: "Lo Vial L9", line: "L9", lat: -33.5024, lng: -70.6480, status: "future" },
  { name: "Departamental L9", line: "L9", lat: -33.5098, lng: -70.6460, status: "future" },
  { name: "San Joaquín L9", line: "L9", lat: -33.4950, lng: -70.6350, status: "future" },
  { name: "La Granja L9", line: "L9", lat: -33.5300, lng: -70.6300, status: "future" },
  { name: "San Ramón L9", line: "L9", lat: -33.5400, lng: -70.6250, status: "future" },
  { name: "Santa Rosa L9", line: "L9", lat: -33.5500, lng: -70.6200, status: "future" },
  { name: "La Pintana Norte", line: "L9", lat: -33.5600, lng: -70.6150, status: "future" },
  { name: "Plaza La Pintana", line: "L9", lat: -33.5800, lng: -70.6300, status: "future" },
  { name: "La Pintana Sur", line: "L9", lat: -33.5900, lng: -70.6250, status: "future" },
  { name: "Gabriela", line: "L9", lat: -33.6000, lng: -70.6100, status: "future" },
  { name: "Bajos de Mena", line: "L9", lat: -33.6100, lng: -70.5950, status: "future" },
  { name: "Puente Alto L9", line: "L9", lat: -33.6100, lng: -70.5720, status: "future" },
];

/**
 * Calcula distancia en metros entre dos puntos (fórmula Haversine)
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Encuentra la estación más cercana y la distancia
 */
export function findNearestStation(lat: number, lng: number, statusFilter?: "active" | "future"): { station: MetroStation; distance: number } | null {
  const stations = statusFilter
    ? METRO_STATIONS.filter(s => s.status === statusFilter)
    : METRO_STATIONS;

  if (stations.length === 0) return null;

  let nearest = stations[0];
  let minDist = haversineDistance(lat, lng, nearest.lat, nearest.lng);

  for (const s of stations) {
    const d = haversineDistance(lat, lng, s.lat, s.lng);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }

  return { station: nearest, distance: minDist };
}
