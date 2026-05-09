// Probe testing-patterns-franco §1: validar la nueva función pura
// `getAirbnbEstimate` contra la dirección del bug (Av. O'Higgins 107) +
// del seed STR existente (Pedro de Valdivia 1234) — debe usar cache para
// la primera y posiblemente cache miss para la segunda.

import { config } from 'dotenv';
import path from 'path';
import { getAirbnbEstimate } from '../src/lib/airbnb/get-estimate';

config({ path: path.resolve(process.cwd(), '.env.local') });

const cases: Array<{ label: string; address: string; bedrooms: number; baths: number; guests: number }> = [
  // El que falló en producción
  { label: 'Bug 71f4d2fd · Av. O\'Higgins 107 (1D/1B)', address: "Av. Alameda Libertador Bernardo O'Higgins 107, Santiago, Región Metropolitana, Chile", bedrooms: 1, baths: 1, guests: 2 },
  // Seed 4c — debe estar en cache
  { label: 'Seed 4c · Pedro de Valdivia 1234 (1D/1B)', address: 'Pedro de Valdivia 1234, Providencia', bedrooms: 1, baths: 1, guests: 2 },
];

async function main() {
  for (const c of cases) {
    console.log(`\n══ ${c.label} ══`);
    const t0 = Date.now();
    try {
      const r = await getAirbnbEstimate(c.address, c.bedrooms, c.baths, c.guests);
      const dt = Date.now() - t0;
      if (r.success) {
        console.log(`  ✓ success=${r.success}  source=${r.source}  cached=${r.cached}  ${dt}ms`);
        if (r.source === 'comparables') {
          console.log(`    median_adr=${r.data.median_adr}  median_occupancy=${r.data.median_occupancy}  median_rev=${r.data.median_annual_revenue}`);
          console.log(`    comparables_count=${r.data.comparables_count}  premium_count=${r.data.premium.count}  standard_count=${r.data.standard.count}`);
        } else if (r.source === 'calculator_direct') {
          console.log(`    estimated_adr=${r.data.estimated_adr}  estimated_occupancy=${r.data.estimated_occupancy}  estimated_rev=${r.data.estimated_annual_revenue}`);
          console.log(`    currency=${r.data.currency}`);
        }
      } else {
        console.log(`  ✗ error=${r.error}  message=${r.message}  ${dt}ms`);
      }
    } catch (err) {
      console.log(`  ⚠ THREW: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
