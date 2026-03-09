import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const UF_CLP_FALLBACK = 38800;

const SYSTEM_PROMPT =
  "Eres un extractor de datos de cotizaciones inmobiliarias chilenas. Extraes datos estructurados de cotizaciones de inmobiliarias, corredoras o portales. Respondes SOLO con JSON válido, sin texto adicional ni backticks.";

function buildUserPrompt(ufValue: number): string {
  return `Extrae los siguientes datos de esta cotización inmobiliaria. Si un dato no aparece, pon null. Responde SOLO con JSON:
{
  "comuna": "nombre de la comuna",
  "direccion": "dirección completa",
  "dormitorios": número,
  "banos": número,
  "superficie": número en m²,
  "precio_uf": número en UF (si está en CLP, convertir a UF con UF = ${ufValue}),
  "precio_clp": número en CLP,
  "estacionamientos": número,
  "bodegas": número,
  "gastos_comunes": número en CLP mensual,
  "orientacion": "norte/sur/oriente/poniente" o null,
  "piso": número o null,
  "antiguedad": número de años o null,
  "estado_venta": "inmediata" o "futura",
  "fecha_entrega": "YYYY-MM" o null,
  "inmobiliaria": "nombre" o null,
  "proyecto": "nombre del proyecto" o null
}

IMPORTANTE: Si la cotización es de una inmobiliaria o un proyecto nuevo (detectas palabras como "proyecto", "inmobiliaria", "entrega", "etapa", "piloto", "preventa", "en blanco", "en verde"), entonces la antigüedad SIEMPRE es 0 y el estado_venta es "futura". Busca la fecha de entrega estimada en la cotización.`;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió archivo" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 10MB." },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usa PDF, PNG, JPG o WEBP." },
        { status: 400 }
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

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Build content blocks for Claude
    const isPDF = mimeType === "application/pdf";
    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

    if (isPDF) {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      });
    } else {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as "image/png" | "image/jpeg" | "image/webp",
          data: base64,
        },
      });
    }

    contentBlocks.push({
      type: "text",
      text: buildUserPrompt(ufValue),
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON response
    let parsed;
    try {
      const cleaned = text
        .replace(/^```json?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "No pudimos interpretar la cotización. Intenta con otra imagen.", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("parse-quotation error:", err);
    return NextResponse.json(
      { error: "No pudimos leer la cotización. Intenta con otra imagen o completa manualmente." },
      { status: 500 }
    );
  }
}
