// ─────────────────────────────────────────────────────────────────────────────
// Retry dirigido del titular (FASE 2 rediseño Dictamen).
//
// Medido en el FULL (25-ago): pedirle al modelo contar palabras dentro de la
// generación completa falla en la cola (~18-19 palabras en seeds con matices,
// tasa ~30-50% aun con el límite reforzado dos veces). El patrón del repo para
// esto es el correctivo dirigido (CATCH-VOZ, PLANC) — pero reintentar la
// generación ENTERA por un titular es caro. Esta mini-llamada reescribe SOLO el
// titular (una tarea, un límite, ~30 tokens de salida): la tasa residual cae a
// la cola de la cola, y el fallback sigue siendo null (portada sin titular).
// Cadena completa: prompt (primario) → este retry (correctivo) → null (fallback)
// → render tolerante (tolera null). El golden A9/AS4 mide el resultado FINAL.
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from "@anthropic-ai/sdk";
import { validarTitular } from "./prosa-marcas";

/**
 * Reescribe un titular inválido cumpliendo el contrato duro. Devuelve el titular
 * corregido si la reescritura valida, o null si también falla (el caller apaga
 * el campo). Nunca lanza: cualquier error de API devuelve null.
 */
export async function reescribirTitular(p: {
  anthropic: Anthropic;
  model: string;
  titularInvalido: string;
  motivo: string;
  veredicto: string;
}): Promise<string | null> {
  try {
    const msg = await p.anthropic.messages.create({
      model: p.model,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Reescribe este titular de informe inmobiliario para que cumpla TODAS las reglas. Conserva su idea y su tono; solo recórtalo/ajústalo.

Titular actual (inválido — ${p.motivo}): ${p.titularInvalido}
Veredicto del caso (no lo contradigas): ${p.veredicto}

REGLAS DURAS:
- Máximo 15 palabras en total. Cuenta cada palabra antes de responder.
- Exactamente UNA marca \`**…**\` con máximo 7 palabras marcadas (el corazón de la razón, no la frase entera).
- Sin montos en $ ni UF (porcentajes sí se permiten).
- Español chileno, tuteo, sin jerga financiera (nada de CAP rate, NOI, TIR).
- Una sola razón: si el titular actual tiene dos, conserva la más fuerte.

Responde SOLO con el titular corregido, sin comillas ni explicación.`,
        },
      ],
    });
    const texto = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    // Sin comillas envolventes si el modelo las agregó igual.
    const limpio = texto.replace(/^["«]|["»]$/g, "").trim();
    return validarTitular(limpio).ok ? limpio : null;
  } catch {
    return null;
  }
}
