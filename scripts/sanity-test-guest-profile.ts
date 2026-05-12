// Sanity test del scoring de perfiles de huésped (Commit 2c).
// Verifica que el motor calcGuestProfile() asigna perfil dominante coherente
// para casos representativos por comuna.
//
// Casos:
//   1. Providencia centro (Av. Providencia ~Pedro de Valdivia) → debe sugerir
//      mix turista_leisure + nomada_digital. Hay metro + zonas turísticas + uni cerca.
//   2. Las Condes Apoquindo (Sanhattan area) → ejecutivo_corto debe ser dominante.
//   3. La Reina residencial → familia debe ser dominante.

import { calcGuestProfile, PERFIL_LABEL } from "../src/lib/str-guest-profile";

interface Caso {
  nombre: string;
  lat: number;
  lng: number;
  comuna: string;
  expectedDominante?: string;  // perfil esperado (loose check)
}

const CASOS: Caso[] = [
  {
    nombre: "Providencia centro (Pedro de Valdivia / Av. Providencia)",
    lat: -33.4253,
    lng: -70.6122,
    comuna: "Providencia",
    expectedDominante: "turista_leisure or nomada_digital",
  },
  {
    nombre: "Las Condes Apoquindo (Sanhattan area)",
    lat: -33.4174,
    lng: -70.6042,
    comuna: "Las Condes",
    expectedDominante: "ejecutivo_corto",
  },
  {
    nombre: "La Reina residencial (zona Parque Padre Hurtado)",
    lat: -33.4316,
    lng: -70.5457,
    comuna: "La Reina",
    expectedDominante: "familia",
  },
  {
    nombre: "Santiago centro (Av. Alameda Alameda 107)",
    lat: -33.4422,
    lng: -70.6405,
    comuna: "Santiago",
    expectedDominante: "turista_leisure or nomada_digital",
  },
];

function fmtPct(n: number): string {
  return `${n}%`;
}

function printCaso(c: Caso) {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`CASO: ${c.nombre}`);
  console.log(`coords: (${c.lat}, ${c.lng}) · comuna: ${c.comuna}`);
  console.log(`esperado: ${c.expectedDominante}`);
  console.log("────────────────────────────────────────────────────────────");

  const profile = calcGuestProfile(c.lat, c.lng, c.comuna);

  console.log("\nRanking de perfiles:");
  profile.todos.forEach((p, i) => {
    const marker = i === 0 ? "★" : " ";
    console.log(`  ${marker} ${PERFIL_LABEL[p.perfil].padEnd(28)} score ${String(p.score).padStart(3)}  ${fmtPct(p.porcentaje).padStart(5)}  · ${p.driver}`);
  });

  console.log(`\nDominante: ${PERFIL_LABEL[profile.dominante.perfil]} (${profile.dominante.porcentaje}%)`);
  console.log(`Secundarios: ${profile.secundarios.map((s) => PERFIL_LABEL[s.perfil]).join(", ") || "(ninguno — dominante claro)"}`);
  console.log(`\nPOIs relevantes (top 5):`);
  profile.poisRelevantes.slice(0, 5).forEach((p) => {
    console.log(`  - [${p.tipo.toUpperCase()}] ${p.nombre} · ${Math.round(p.distancia)}m`);
  });
}

function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("SANITY TEST · calcGuestProfile (STR Tipo de huésped)");
  console.log("════════════════════════════════════════════════════════════");
  CASOS.forEach(printCaso);
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("Fin. Verificar manualmente que cada perfil dominante hace sentido.");
  console.log("════════════════════════════════════════════════════════════\n");
}

main();
