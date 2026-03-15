import { NextResponse } from "next/server";

// TEMPORARY DEBUG ENDPOINT — remove after diagnosing scraper issues
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targetUrl = "https://www.toctoc.com/arriendo/departamento/metropolitana/providencia";

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
      },
    });

    const html = await response.text();

    // Buscar JSON-LD
    const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
    const jsonLdBlocks: string[] = [];
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      jsonLdBlocks.push(match[1].substring(0, 1000));
    }

    // Buscar precios en el HTML
    const priceMatches: string[] = [];
    const priceRegex = /\$\s*([\d.]+(?:\.\d{3})+)/g;
    let priceMatch;
    let count = 0;
    while ((priceMatch = priceRegex.exec(html)) !== null && count < 10) {
      priceMatches.push(priceMatch[0]);
      count++;
    }

    // Buscar superficies
    const surfaceMatches: string[] = [];
    const surfRegex = /(\d+)\s*m²/gi;
    let surfMatch;
    count = 0;
    while ((surfMatch = surfRegex.exec(html)) !== null && count < 10) {
      surfaceMatches.push(surfMatch[0]);
      count++;
    }

    // Buscar links a propiedades
    const propLinks: string[] = [];
    const linkRegex = /href="(\/propiedades\/[^"]{0,100})"/gi;
    let linkMatch;
    count = 0;
    while ((linkMatch = linkRegex.exec(html)) !== null && count < 10) {
      propLinks.push(linkMatch[1]);
      count++;
    }

    return NextResponse.json({
      status: response.status,
      htmlLength: html.length,
      first500: html.substring(0, 500),
      jsonLdBlocksFound: jsonLdBlocks.length,
      jsonLdPreview: jsonLdBlocks,
      pricesFound: priceMatches,
      surfacesFound: surfaceMatches,
      propertyLinksFound: propLinks,
      htmlContainsAbout: html.includes('"about"'),
      htmlContainsApartment: html.includes('"Apartment"'),
      htmlContainsPrecio: html.includes("$") || html.includes("UF"),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
