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
  { name: "San Pablo", line: "L1", lat: -33.4442061, lng: -70.7231838, status: "active" },
  { name: "Neptuno", line: "L1", lat: -33.4515804, lng: -70.7226828, status: "active" },
  { name: "Pajaritos", line: "L1", lat: -33.4574748, lng: -70.7154469, status: "active" },
  { name: "Las Rejas", line: "L1", lat: -33.4575386, lng: -70.7067561, status: "active" },
  { name: "Ecuador", line: "L1", lat: -33.4559226, lng: -70.6997325, status: "active" },
  { name: "San Alberto Hurtado", line: "L1", lat: -33.4542019, lng: -70.6922721, status: "active" },
  { name: "Universidad de Santiago", line: "L1", lat: -33.4528554, lng: -70.6865552, status: "active" },
  { name: "Estación Central", line: "L1", lat: -33.4508228, lng: -70.6789622, status: "active" },
  { name: "Unión Latinoamericana", line: "L1", lat: -33.4493623, lng: -70.673351, status: "active" },
  { name: "República", line: "L1", lat: -33.447702, lng: -70.6671366, status: "active" },
  { name: "Los Héroes", line: "L1", lat: -33.4461853, lng: -70.6604458, status: "active" },
  { name: "La Moneda", line: "L1", lat: -33.4448711, lng: -70.6548709, status: "active" },
  { name: "Universidad de Chile", line: "L1", lat: -33.443867, lng: -70.6506654, status: "active" },
  { name: "Santa Lucía", line: "L1", lat: -33.4424649, lng: -70.6447442, status: "active" },
  { name: "Universidad Católica", line: "L1", lat: -33.4397617, lng: -70.6398924, status: "active" },
  { name: "Baquedano", line: "L1", lat: -33.4372174, lng: -70.6334109, status: "active" },
  { name: "Salvador", line: "L1", lat: -33.4327195, lng: -70.6260885, status: "active" },
  { name: "Manuel Montt", line: "L1", lat: -33.4285532, lng: -70.6196465, status: "active" },
  { name: "Pedro de Valdivia", line: "L1", lat: -33.425483, lng: -70.6137959, status: "active" },
  { name: "Los Leones", line: "L1", lat: -33.422019, lng: -70.6085607, status: "active" },
  { name: "Tobalaba", line: "L1", lat: -33.4182154, lng: -70.6014872, status: "active" },
  { name: "El Golf", line: "L1", lat: -33.4166189, lng: -70.5957077, status: "active" },
  { name: "Alcántara", line: "L1", lat: -33.4154469, lng: -70.5899906, status: "active" },
  { name: "Escuela Militar", line: "L1", lat: -33.4134817, lng: -70.5826796, status: "active" },
  { name: "Manquehue", line: "L1", lat: -33.4094637, lng: -70.5697326, status: "active" },
  { name: "Hernando de Magallanes", line: "L1", lat: -33.4079352, lng: -70.5558454, status: "active" },
  { name: "Los Dominicos", line: "L1", lat: -33.4078854, lng: -70.5449939, status: "active" },

  // ===== LÍNEA 2 (Amarilla) — 22 estaciones =====
  { name: "Vespucio Norte", line: "L2", lat: -33.3807538, lng: -70.6463404, status: "active" },
  { name: "Zapadores", line: "L2", lat: -33.3909444, lng: -70.6424385, status: "active" },
  { name: "Dorsal", line: "L2", lat: -33.3969616, lng: -70.6427404, status: "active" },
  { name: "Einstein", line: "L2", lat: -33.4059459, lng: -70.6431738, status: "active" },
  { name: "Cerro Blanco", line: "L2", lat: -33.4227505, lng: -70.6450582, status: "active" },
  { name: "Patronato", line: "L2", lat: -33.4297317, lng: -70.6471183, status: "active" },
  { name: "Puente Cal y Canto", line: "L2", lat: -33.4328384, lng: -70.6530774, status: "active" },
  { name: "Santa Ana", line: "L2", lat: -33.4382499, lng: -70.6598961, status: "active" },
  { name: "Toesca", line: "L2", lat: -33.4529746, lng: -70.6585851, status: "active" },
  { name: "Parque O'Higgins", line: "L2", lat: -33.4608472, lng: -70.6568466, status: "active" },
  { name: "Rondizzoni", line: "L2", lat: -33.4696578, lng: -70.6563736, status: "active" },
  { name: "Franklin", line: "L2", lat: -33.4766603, lng: -70.6494774, status: "active" },
  { name: "El Llano", line: "L2", lat: -33.4826014, lng: -70.6493814, status: "active" },
  { name: "San Miguel", line: "L2", lat: -33.4887157, lng: -70.6510725, status: "active" },
  { name: "Lo Vial", line: "L2", lat: -33.4968286, lng: -70.6530148, status: "active" },
  { name: "Departamental", line: "L2", lat: -33.5024398, lng: -70.6546333, status: "active" },
  { name: "Ciudad del Niño", line: "L2", lat: -33.5095432, lng: -70.6566453, status: "active" },
  { name: "Lo Ovalle", line: "L2", lat: -33.5172701, lng: -70.6588205, status: "active" },
  { name: "El Bosque", line: "L2", lat: -33.5465722, lng: -70.6667515, status: "active" },
  { name: "Observatorio", line: "L2", lat: -33.560404, lng: -70.6705486, status: "active" },
  { name: "Copa Lo Martínez", line: "L2", lat: -33.5706669, lng: -70.6733824, status: "active" },
  { name: "Hospital El Pino", line: "L2", lat: -33.5828788, lng: -70.6768121, status: "active" },

  // ===== LÍNEA 3 (Café) — 22 estaciones =====
  { name: "Plaza Quilicura", line: "L3", lat: -33.3657194, lng: -70.7288942, status: "active" },
  { name: "Las Torres", line: "L3", lat: -33.4989098, lng: -70.5864455, status: "active" },
  { name: "EFE Quilicura", line: "L3", lat: -33.3760, lng: -70.7100, status: "active" },
  { name: "Los Libertadores", line: "L3", lat: -33.3654303, lng: -70.6919903, status: "active" },
  { name: "Cardenal Caro", line: "L3", lat: -33.3732586, lng: -70.6863362, status: "active" },
  { name: "Vivaceta", line: "L3", lat: -33.3853813, lng: -70.6796401, status: "active" },
  { name: "Conchalí", line: "L3", lat: -33.3978904, lng: -70.6695999, status: "active" },
  { name: "Plaza Chacabuco", line: "L3", lat: -33.4067715, lng: -70.6609686, status: "active" },
  { name: "Hospitales", line: "L3", lat: -33.4176739, lng: -70.6564558, status: "active" },
  { name: "Plaza de Armas", line: "L3", lat: -33.4374154, lng: -70.6512777, status: "active" },
  { name: "Parque Almagro", line: "L3", lat: -33.4513929, lng: -70.6505616, status: "active" },
  { name: "Matta", line: "L3", lat: -33.4582698, lng: -70.6430769, status: "active" },
  { name: "Irarrázaval", line: "L3", lat: -33.4550535, lng: -70.6283154, status: "active" },
  { name: "Monseñor Eyzaguirre", line: "L3", lat: -33.4531944, lng: -70.613519, status: "active" },
  { name: "Ñuñoa L3", line: "L3", lat: -33.4541894, lng: -70.604972, status: "active" },
  { name: "Chile España", line: "L3", lat: -33.4549078, lng: -70.5981422, status: "active" },
  { name: "Diagonal Oriente", line: "L3", lat: -33.4575, lng: -70.5850, status: "active" },
  { name: "Plaza Egaña", line: "L3", lat: -33.4534937, lng: -70.570823, status: "active" },
  { name: "Fernando Castillo Velasco", line: "L3", lat: -33.4520879, lng: -70.55812, status: "active" },

  // ===== LÍNEA 4 (Azul) — 23 estaciones =====
  { name: "Cristóbal Colón", line: "L4", lat: -33.4263163, lng: -70.5909808, status: "active" },
  { name: "Francisco Bilbao", line: "L4", lat: -33.4317928, lng: -70.584703, status: "active" },
  { name: "Príncipe de Gales", line: "L4", lat: -33.4392047, lng: -70.5731497, status: "active" },
  { name: "Simón Bolívar", line: "L4", lat: -33.4461845, lng: -70.5719261, status: "active" },
  { name: "Los Orientales", line: "L4", lat: -33.4626181, lng: -70.5739242, status: "active" },
  { name: "Grecia", line: "L4", lat: -33.4695344, lng: -70.5765034, status: "active" },
  { name: "Los Presidentes", line: "L4", lat: -33.479837, lng: -70.5786662, status: "active" },
  { name: "Quilín", line: "L4", lat: -33.4882637, lng: -70.5804178, status: "active" },
  { name: "Las Torres L4", line: "L4", lat: -33.4989098, lng: -70.5864455, status: "active" },
  { name: "Macul", line: "L4", lat: -33.5092379, lng: -70.5900473, status: "active" },
  { name: "Vicuña Mackenna", line: "L4", lat: -33.5196822, lng: -70.5961986, status: "active" },
  { name: "Vicente Valdés", line: "L4", lat: -33.5264085, lng: -70.5968109, status: "active" },
  { name: "Rojas Magallanes", line: "L4", lat: -33.5361069, lng: -70.5926966, status: "active" },
  { name: "Trinidad", line: "L4", lat: -33.5462943, lng: -70.5881027, status: "active" },
  { name: "San José de la Estrella", line: "L4", lat: -33.5538213, lng: -70.5865567, status: "active" },
  { name: "Los Quillayes", line: "L4", lat: -33.5612253, lng: -70.5852697, status: "active" },
  { name: "Elisa Correa", line: "L4", lat: -33.5692937, lng: -70.5838076, status: "active" },
  { name: "Hospital Sótero del Río", line: "L4", lat: -33.5768981, lng: -70.582317, status: "active" },
  { name: "Protectora de la Infancia", line: "L4", lat: -33.5895738, lng: -70.579833, status: "active" },
  { name: "Las Mercedes", line: "L4", lat: -33.6013816, lng: -70.5774783, status: "active" },
  { name: "Plaza de Puente Alto", line: "L4", lat: -33.6095235, lng: -70.5758419, status: "active" },

  // ===== LÍNEA 4A (Celeste) — 6 estaciones =====
  { name: "Santa Rosa", line: "L4A", lat: -33.5423878, lng: -70.6341267, status: "active" },
  { name: "Santa Julia", line: "L4A", lat: -33.5311022, lng: -70.6055361, status: "active" },
  { name: "San Ramón", line: "L4A", lat: -33.5412286, lng: -70.6431272, status: "active" },
  { name: "La Granja", line: "L4A", lat: -33.5411298, lng: -70.616047, status: "active" },
  { name: "La Cisterna", line: "L4A", lat: -33.5383676, lng: -70.6646244, status: "active" },

  // ===== LÍNEA 5 (Verde) — 30 estaciones =====
  { name: "Plaza de Maipú", line: "L5", lat: -33.5099332, lng: -70.7573092, status: "active" },
  { name: "Santiago Bueras", line: "L5", lat: -33.4962414, lng: -70.7574349, status: "active" },
  { name: "Del Sol", line: "L5", lat: -33.4902363, lng: -70.7531153, status: "active" },
  { name: "Monte Tabor", line: "L5", lat: -33.4822861, lng: -70.7454383, status: "active" },
  { name: "Las Parcelas", line: "L5", lat: -33.4752719, lng: -70.7399789, status: "active" },
  { name: "Laguna Sur", line: "L5", lat: -33.4621633, lng: -70.7379067, status: "active" },
  { name: "Barrancas", line: "L5", lat: -33.4529813, lng: -70.739037, status: "active" },
  { name: "Pudahuel", line: "L5", lat: -33.4448632, lng: -70.7411438, status: "active" },
  { name: "Lo Prado", line: "L5", lat: -33.4434094, lng: -70.7167535, status: "active" },
  { name: "Blanqueado", line: "L5", lat: -33.4413214, lng: -70.7066515, status: "active" },
  { name: "Gruta de Lourdes", line: "L5", lat: -33.438011, lng: -70.6910279, status: "active" },
  { name: "Quinta Normal", line: "L5", lat: -33.440368, lng: -70.6802912, status: "active" },
  { name: "Cumming", line: "L5", lat: -33.4391444, lng: -70.668534, status: "active" },
  { name: "Bellas Artes", line: "L5", lat: -33.4366322, lng: -70.6441329, status: "active" },
  { name: "Parque Bustamante", line: "L5", lat: -33.4428037, lng: -70.6319594, status: "active" },
  { name: "Santa Isabel", line: "L5", lat: -33.4471204, lng: -70.6304343, status: "active" },
  { name: "Ñuble", line: "L5", lat: -33.4673629, lng: -70.6247567, status: "active" },
  { name: "Rodrigo de Araya", line: "L5", lat: -33.4778167, lng: -70.6222636, status: "active" },
  { name: "Carlos Valdovinos", line: "L5", lat: -33.4863985, lng: -70.6191824, status: "active" },
  { name: "Camino Agrícola", line: "L5", lat: -33.4917907, lng: -70.6175195, status: "active" },
  { name: "San Joaquín", line: "L5", lat: -33.4993359, lng: -70.6158257, status: "active" },
  { name: "Pedrero", line: "L5", lat: -33.5079499, lng: -70.6124467, status: "active" },
  { name: "Mirador", line: "L5", lat: -33.5133028, lng: -70.6059146, status: "active" },
  { name: "Bellavista de La Florida", line: "L5", lat: -33.5195217, lng: -70.6000253, status: "active" },

  // ===== LÍNEA 6 (Morada) — 11 estaciones =====
  { name: "Cerrillos", line: "L6", lat: -33.4834342, lng: -70.6955562, status: "active" },
  { name: "Lo Valledor", line: "L6", lat: -33.4784048, lng: -70.6809001, status: "active" },
  { name: "Club Hípico", line: "L6", lat: -33.4692, lng: -70.6680, status: "active" },
  { name: "Franklin L6", line: "L6", lat: -33.4766603, lng: -70.6494774, status: "active" },
  { name: "Bio Bío", line: "L6", lat: -33.4766072, lng: -70.6421784, status: "active" },
  { name: "Ñuble L6", line: "L6", lat: -33.4673629, lng: -70.6247567, status: "active" },
  { name: "Estadio Nacional", line: "L6", lat: -33.4623809, lng: -70.6062176, status: "active" },
  { name: "Ñuñoa L6", line: "L6", lat: -33.4541894, lng: -70.604972, status: "active" },
  { name: "Inés de Suárez", line: "L6", lat: -33.438721, lng: -70.6073371, status: "active" },

  // ===== Estaciones adicionales (OSM) =====
  { name: "Cementerios", line: "L3", lat: -33.4139806, lng: -70.643597, status: "active" },
  { name: "El Parrón", line: "L4A", lat: -33.5264317, lng: -70.6614044, status: "active" },
  { name: "Presidente Pedro Aguirre Cerda", line: "L6", lat: -33.4786906, lng: -70.6647874, status: "active" },
  { name: "Villa Frei", line: "L4", lat: -33.4546697, lng: -70.5814833, status: "active" },
  { name: "Ferrocarril", line: "L3", lat: -33.3654667, lng: -70.7055375, status: "active" },
  { name: "Lo Cruzat", line: "L3", lat: -33.3668342, lng: -70.719772, status: "active" },

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
