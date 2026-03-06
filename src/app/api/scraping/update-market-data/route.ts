import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SEED_MARKET_DATA } from "@/lib/market-data";

function createSupabaseAdmin() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* ignored */ }
        },
      },
    }
  );
}

// Firecrawl scraping config
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const PORTAL_BASE_URL = "https://www.portalinmobiliario.com/arriendo";

interface ScrapedListing {
  comuna: string;
  tipo: string;
  precio: number;
  superficie: number;
}

async function scrapePortalInmobiliario(comuna: string, dormitorios: number): Promise<ScrapedListing[]> {
  if (!FIRECRAWL_API_KEY) {
    return [];
  }

  const tipo = dormitorios <= 1 ? "1D" : dormitorios === 2 ? "2D" : "3D";
  const slug = comuna.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  const url = `${PORTAL_BASE_URL}/departamento/${dormitorios}-dormitorio/${slug}`;

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              listings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    price: { type: "number", description: "Monthly rent price in CLP" },
                    area: { type: "number", description: "Useful area in m2" },
                    gastos_comunes: { type: "number", description: "Monthly common expenses in CLP" },
                  },
                },
              },
            },
          },
          prompt: "Extract all rental listings with their monthly price in CLP, useful area in m2, and common expenses (gastos comunes) in CLP.",
        },
      }),
    });

    if (!res.ok) {
      console.error(`Firecrawl error for ${comuna} ${tipo}:`, res.status);
      return [];
    }

    const data = await res.json();
    const listings = data?.data?.extract?.listings || [];

    return listings
      .filter((l: { price: number; area: number }) => l.price > 50000 && l.area > 10)
      .map((l: { price: number; area: number }) => ({
        comuna,
        tipo,
        precio: l.price,
        superficie: l.area,
      }));
  } catch (err) {
    console.error(`Scraping error for ${comuna} ${tipo}:`, err);
    return [];
  }
}

export async function POST(request: Request) {
  // Verify cron secret or admin
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // If no Firecrawl API key, seed with reference data
  if (!FIRECRAWL_API_KEY) {
    const now = new Date().toISOString();
    const rows = SEED_MARKET_DATA.map((row) => ({
      ...row,
      fecha_actualizacion: now,
    }));

    // Upsert seed data
    const { error } = await supabase
      .from("market_data")
      .upsert(rows, { onConflict: "comuna,tipo" });

    if (error) {
      console.error("Seed upsert error:", error);
      return NextResponse.json(
        { error: "Failed to seed data", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Seeded with reference data (no Firecrawl API key)",
      rows: rows.length,
    });
  }

  // Scrape real data from Portal Inmobiliario
  const comunas = [
    "Providencia", "Las Condes", "Ñuñoa", "Santiago Centro",
    "La Florida", "Macul", "San Miguel", "Estación Central",
    "Independencia", "Vitacura", "Lo Barnechea",
    "Recoleta", "Quinta Normal", "Pedro Aguirre Cerda", "San Joaquín",
  ];

  const results: { comuna: string; tipo: string; count: number }[] = [];
  const now = new Date().toISOString();

  for (const comuna of comunas) {
    for (const dormitorios of [1, 2, 3]) {
      const listings = await scrapePortalInmobiliario(comuna, dormitorios);
      const tipo = dormitorios <= 1 ? "1D" : dormitorios === 2 ? "2D" : "3D";

      if (listings.length === 0) continue;

      const arriendos = listings.map((l) => l.precio);
      const superficies = listings.map((l) => l.superficie);
      const arriendoPromedio = Math.round(arriendos.reduce((a, b) => a + b, 0) / arriendos.length);
      const superficiePromedio = superficies.reduce((a, b) => a + b, 0) / superficies.length;

      // Find matching seed data for gastos_comunes_m2 fallback
      const seedMatch = SEED_MARKET_DATA.find((d) => d.comuna === comuna && d.tipo === tipo);

      const { error } = await supabase
        .from("market_data")
        .upsert({
          comuna,
          tipo,
          arriendo_promedio: arriendoPromedio,
          precio_m2_promedio: seedMatch?.precio_m2_promedio ?? Math.round(arriendoPromedio / superficiePromedio / 38800 * 12 / 0.045 * 10) / 10,
          precio_m2_venta_promedio: seedMatch?.precio_m2_venta_promedio ?? seedMatch?.precio_m2_promedio ?? 50,
          gastos_comunes_m2: seedMatch?.gastos_comunes_m2 ?? 1200,
          numero_publicaciones: listings.length,
          fecha_actualizacion: now,
        }, { onConflict: "comuna,tipo" });

      if (error) {
        console.error(`Upsert error for ${comuna} ${tipo}:`, error);
      } else {
        results.push({ comuna, tipo, count: listings.length });
      }
    }
  }

  return NextResponse.json({
    message: "Scraping complete",
    results,
  });
}
