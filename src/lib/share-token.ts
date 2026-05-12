// ─────────────────────────────────────────────────────────────────────────
// Share token — codifica (ltrId, strId) en base64url determinístico para
// generar URLs públicas `/share/comparativa/[token]`.
//
// Estrategia: cada UUID son 16 bytes binarios. Concatenamos los dos
// (32 bytes total) y los pasamos a base64url. Resultado: token de 43
// caracteres URL-safe, reversible sin DB, idempotente para el mismo par.
//
// Threat model: alguien que decodifique el token obtiene los IDs LTR/STR,
// pero la ruta privada `/analisis/comparativa?ltr=X&str=Y` igual requiere
// auth, así que el "leak" no abre acceso adicional. El propósito del token
// no es secreto criptográfico; es URL compartible y estable.
// ─────────────────────────────────────────────────────────────────────────

const UUID_HEX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidToBytes(uuid: string): Buffer {
  if (!UUID_HEX_RE.test(uuid)) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesToUuid(b: Buffer): string {
  const h = b.toString("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20, 32),
  ].join("-");
}

function b64urlEncode(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encodeShareToken(ltrId: string, strId: string): string {
  const buf = Buffer.concat([uuidToBytes(ltrId), uuidToBytes(strId)]);
  return b64urlEncode(buf);
}

export function decodeShareToken(token: string): { ltrId: string; strId: string } | null {
  try {
    const b = b64urlDecode(token);
    if (b.length !== 32) return null;
    return {
      ltrId: bytesToUuid(b.subarray(0, 16)),
      strId: bytesToUuid(b.subarray(16, 32)),
    };
  } catch {
    return null;
  }
}
