import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import FirecrawlApp from "@mendable/firecrawl-js";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

const UF_CLP_FALLBACK = 38800;

const ALLOWED_DOMAINS = [
  "portalinmobiliario.com",
  "www.portalinmobiliario.com",
  "toctoc.com",
  "www.toctoc.com",
  "yapo.cl",
  "www.yapo.cl",
  "chilepropiedades.cl",
  "www.chilepropiedades.cl",
  "goplaceit.com",
  "www.goplaceit.com",
  "icasas.cl",
  "www.icasas.cl",
  "inmuebles.mercadolibre.cl",
];

const CREDIT_LIMIT = 450;
const CREDIT_KEY = "firecrawl_credits_used";
const CREDIT_MONTH_KEY = "firecrawl_credits_month";

const SYSTEM_PROMPT =
  "Eres un extractor de datos de publicaciones inmobiliarias chilenas. Recibes el contenido de una publicación web y extraes datos estructurados. Respondes SOLO con JSON válido, sin texto adicional ni backticks.";

function buildUserPrompt(markdown: string, ufValue: number): string {
  return `Extrae los datos de esta publicación inmobiliaria. Si un dato no aparece, pon null. Responde SOLO con JSON:
{
  "comuna": "nombre de la comuna",
  "direccion": "dirección completa",
  "dormitorios": número,
  "banos": número,
  "superficie": número en m²,
  "precio_uf": número en UF (si está en CLP, convertir a UF con UF = ${ufValue}),
  "precio_clp": número en CLP o null,
  "estacionamientos": número,
  "bodegas": número,
  "gastos_comunes": número en CLP mensual o null,
  "orientacion": "norte/sur/oriente/poniente" o null,
  "piso": número o null,
  "antiguedad": número de años o null,
  "estado_venta": "inmediata" o "futura",
  "fecha_entrega": "YYYY-MM" o null,
  "inmobiliaria": "nombre" o null,
  "proyecto": "nombre del proyecto" o null,
  "arriendo_estimado": número en CLP si aparece info de arriendo o null
}

Contenido de la publicación:
${markdown}`;
}

function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    // Remove common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach((p) =>
      url.searchParams.delete(p)
    );
    return url.toString();
  } catch {
    return raw.trim();
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function getPortalName(url: string): string {
  const host = getDomain(url);
  if (host.includes("portalinmobiliario")) return "Portal Inmobiliario";
  if (host.includes("toctoc")) return "TocToc";
  if (host.includes("yapo")) return "Yapo";
  if (host.includes("chilepropiedades")) return "Chile Propiedades";
  if (host.includes("goplaceit")) return "GoPlaceIt";
  if (host.includes("icasas")) return "iCasas";
  if (host.includes("mercadolibre")) return "Mercado Libre";
  return "portal";
}

async function getCreditsUsed(supabase: ReturnType<typeof createClient>): Promise<{ used: number; month: string }> {
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const { data: monthRow } = await supabase
    .from("config")
    .select("value")
    .eq("key", CREDIT_MONTH_KEY)
    .single();

  const { data: usedRow } = await supabase
    .from("config")
    .select("value")
    .eq("key", CREDIT_KEY)
    .single();

  const storedMonth = monthRow?.value || "";
  const storedUsed = parseInt(usedRow?.value || "0", 10);

  // Reset if new month
  if (storedMonth !== currentMonth) {
    await supabase.from("config").upsert({ key: CREDIT_MONTH_KEY, value: currentMonth });
    await supabase.from("config").upsert({ key: CREDIT_KEY, value: "0" });
    return { used: 0, month: currentMonth };
  }

  return { used: storedUsed, month: currentMonth };
}

async function incrementCredits(supabase: ReturnType<typeof createClient>, current: number): Promise<void> {
  await supabase.from("config").upsert({ key: CREDIT_KEY, value: String(current + 1) });
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabaseAuth = createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const rawUrl = body.url as string;

    if (!rawUrl) {
      return NextResponse.json({ error: "No se envió URL" }, { status: 400 });
    }

    const url = cleanUrl(rawUrl);
    const domain = getDomain(url);

    if (!ALLOWED_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) {
      return NextResponse.json(
        { error: "Portal no soportado. Usa Portal Inmobiliario, TocToc o Yapo." },
        { status: 400 }
      );
    }

    // Check rate limits
    const supabase = createClient();
    const { used } = await getCreditsUsed(supabase);
    if (used >= CREDIT_LIMIT) {
      return NextResponse.json(
        { error: "Función temporalmente no disponible. Completa los datos manualmente." },
        { status: 429 }
      );
    }

    // Get current UF value
    let ufValue = UF_CLP_FALLBACK;
    try {
      const ufRes = await fetch(`${req.nextUrl.origin}/api/uf`);
      const ufData = await ufRes.json();
      if (ufData.uf) ufValue = ufData.uf;
    } catch {
      // Use fallback
    }

    // Scrape with Firecrawl
    let markdown: string;
    try {
      const result = await firecrawl.scrape(url, {
        formats: ["markdown"],
      });

      if (!result.markdown) {
        return NextResponse.json(
          { error: "No pudimos leer esta publicación. Intenta con otra o completa manualmente." },
          { status: 500 }
        );
      }

      markdown = result.markdown;

      // Detect blocked/login pages
      if (markdown.length < 1500 && (
        markdown.includes("ingresa a") || markdown.includes("login") ||
        markdown.includes("Soy nuevo") || markdown.includes("Ya tengo cuenta") ||
        markdown.includes("captcha") || markdown.includes("verificar")
      )) {
        return NextResponse.json(
          { error: "El portal bloqueó el acceso automático. Intenta subir una captura de pantalla o cotización en PDF." },
          { status: 422 }
        );
      }

      // Too little content to extract anything useful
      if (markdown.length < 200) {
        return NextResponse.json(
          { error: "No pudimos extraer contenido de esta publicación. Intenta con otra URL o completa manualmente." },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error("Firecrawl error:", err);
      return NextResponse.json(
        { error: "No pudimos acceder a esta publicación. Intenta con otra o completa manualmente." },
        { status: 500 }
      );
    }

    // Increment credit counter
    await incrementCredits(supabase, used);

    // Truncate markdown if too long (keep first ~15k chars to fit in Claude context)
    const truncated = markdown.length > 15000 ? markdown.slice(0, 15000) + "\n\n[contenido truncado]" : markdown;

    // Extract structured data with Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(truncated, ufValue) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    let parsed;
    try {
      const cleaned = text
        .replace(/^```json?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "No pudimos interpretar los datos de la publicación.", raw: text },
        { status: 500 }
      );
    }

    const portal = getPortalName(url);

    return NextResponse.json({ data: parsed, portal });
  } catch (err) {
    console.error("parse-listing error:", err);
    return NextResponse.json(
      { error: "No pudimos leer esta publicación. Intenta con otra o completa manualmente." },
      { status: 500 }
    );
  }
}
