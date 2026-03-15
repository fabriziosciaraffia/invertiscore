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
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9",
      },
    });

    const html = await response.text();

    // Buscar TODOS los patrones posibles de precio
    const pricePatterns: Record<string, string[]> = {};

    // Patrón 1: $450.000
    let m;
    let c = 0;
    const p1: string[] = [];
    const r1 = /\$\s*([\d.]+(?:\.\d{3})+)/g;
    while ((m = r1.exec(html)) !== null && c < 5) { p1.push(m[0]); c++; }
    pricePatterns["$X.XXX.XXX"] = p1;

    // Patrón 2: $450000 (sin puntos)
    c = 0;
    const p2: string[] = [];
    const r2 = /\$\s*(\d{5,8})/g;
    while ((m = r2.exec(html)) !== null && c < 5) { p2.push(m[0]); c++; }
    pricePatterns["$XXXXXX"] = p2;

    // Patrón 3: UF X.XXX
    c = 0;
    const p3: string[] = [];
    const r3 = /UF\s*([\d.,]+)/gi;
    while ((m = r3.exec(html)) !== null && c < 5) { p3.push(m[0]); c++; }
    pricePatterns["UF X.XXX"] = p3;

    // Patrón 4: data-price, data-valor, price=
    c = 0;
    const p4: string[] = [];
    const r4 = /(?:data-(?:price|valor|precio)|price=|valor=)"?(\d+)"?/gi;
    while ((m = r4.exec(html)) !== null && c < 5) { p4.push(m[0]); c++; }
    pricePatterns["data-price"] = p4;

    // Patrón 5: "price": o "precio":
    c = 0;
    const p5: string[] = [];
    const r5 = /"(?:price|precio|value|valor)":\s*"?(\d+)"?/gi;
    while ((m = r5.exec(html)) !== null && c < 5) { p5.push(m[0]); c++; }
    pricePatterns['"price":'] = p5;

    // Buscar m² en todas sus formas
    const surfPatterns: Record<string, string[]> = {};

    c = 0;
    const s1: string[] = [];
    const rs1 = /(\d+)\s*m²/gi;
    while ((m = rs1.exec(html)) !== null && c < 5) { s1.push(m[0]); c++; }
    surfPatterns["X m²"] = s1;

    c = 0;
    const s2: string[] = [];
    const rs2 = /(\d+)\s*m&sup2;/gi;
    while ((m = rs2.exec(html)) !== null && c < 5) { s2.push(m[0]); c++; }
    surfPatterns["X m&sup2;"] = s2;

    c = 0;
    const s3: string[] = [];
    const rs3 = /(\d+)\s*mt2/gi;
    while ((m = rs3.exec(html)) !== null && c < 5) { s3.push(m[0]); c++; }
    surfPatterns["X mt2"] = s3;

    c = 0;
    const s4: string[] = [];
    const rs4 = /(?:superficie|area|size)"?:\s*"?(\d+)"?/gi;
    while ((m = rs4.exec(html)) !== null && c < 5) { s4.push(m[0]); c++; }
    surfPatterns["superficie:"] = s4;

    // Buscar un fragmento del HTML que contenga "HOLANDA" (primera propiedad del JSON-LD)
    const holandaIndex = html.indexOf("HOLANDA");
    const holandaContext = holandaIndex > -1
      ? html.substring(Math.max(0, holandaIndex - 200), holandaIndex + 500)
      : "NOT FOUND";

    // Buscar __NEXT_DATA__ (Next.js SSR data)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    const hasNextData = !!nextDataMatch;
    const nextDataPreview = nextDataMatch ? nextDataMatch[1].substring(0, 1000) : null;

    // Buscar window.__data o similar
    const windowDataMatch = html.match(/window\.__(?:data|INITIAL_STATE|props)\s*=\s*([\s\S]{0,1000})/i);
    const hasWindowData = !!windowDataMatch;
    const windowDataPreview = windowDataMatch ? windowDataMatch[0].substring(0, 500) : null;

    return NextResponse.json({
      htmlLength: html.length,
      pricePatterns,
      surfPatterns,
      holandaContext: holandaContext.substring(0, 700),
      hasNextData,
      nextDataPreview,
      hasWindowData,
      windowDataPreview,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
