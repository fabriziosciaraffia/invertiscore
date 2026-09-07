// Códec del payload de puntos del mapa de la landing. Sin "use client": lo
// importan el route handler (servidor) y el canvas (cliente).
//
// Formato "FMP1": magic (4 bytes) · uint32 LE n · n × (dy, dx) como varint
// zigzag sobre coordenadas uint16 cuantizadas en CAJA_MAPA y ordenadas por
// (y, x). y crece hacia el sur (como en pantalla), x hacia el este.

import proj from "./mapa-santiago.proj.json";

/** Misma caja que el SVG de calles (tools/mapa/santiago-svg.mjs). */
export const CAJA_MAPA = { S: proj.S, N: proj.N, W: proj.W, E: proj.E } as const;
const Q = 65535;

function zigzag(n: number): number {
  return n >= 0 ? n * 2 : -n * 2 - 1;
}
function unzigzag(u: number): number {
  return u % 2 === 0 ? u / 2 : -(u + 1) / 2;
}

/** [lat, lng][] → bytes. */
export function codificarPuntos(puntos: ReadonlyArray<readonly [number, number]>): Uint8Array<ArrayBuffer> {
  const { S, N, W, E } = CAJA_MAPA;
  const q = puntos.map(([lat, lng]) => [
    Math.round(((N - lat) / (N - S)) * Q),
    Math.round(((lng - W) / (E - W)) * Q),
  ]);
  q.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: number[] = [0x46, 0x4d, 0x50, 0x31]; // "FMP1"
  const n = q.length;
  out.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  let py = 0, px = 0;
  const varint = (v: number) => {
    while (v >= 0x80) { out.push((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
    out.push(v);
  };
  for (const [y, x] of q) {
    varint(zigzag(y - py));
    varint(zigzag(x - px));
    py = y; px = x;
  }
  // Sobre un ArrayBuffer propio (no ArrayBufferLike): así tipa como BodyInit/BlobPart.
  const bytes = new Uint8Array(new ArrayBuffer(out.length));
  bytes.set(out);
  return bytes;
}

/** bytes → coordenadas ya proyectadas al viewBox del mapa (unidades 0..VW / 0..VH). */
export function decodificarPuntos(bytes: Uint8Array): Float32Array {
  if (bytes.length < 8 || bytes[0] !== 0x46 || bytes[1] !== 0x4d || bytes[2] !== 0x50 || bytes[3] !== 0x31) {
    return new Float32Array(0);
  }
  const n = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | ((bytes[7] << 24) >>> 0);
  const out = new Float32Array(n * 2);
  let i = 8, py = 0, px = 0;
  const leer = () => {
    let v = 0, mult = 1, b: number;
    do { b = bytes[i++]; v += (b & 0x7f) * mult; mult *= 128; } while (b & 0x80);
    return v;
  };
  const { S, N, W, E } = CAJA_MAPA;
  const kx = ((E - W) * proj.kLat * proj.s) / Q;
  const ky = ((N - S) * proj.s) / Q;
  for (let k = 0; k < n; k++) {
    py += unzigzag(leer());
    px += unzigzag(leer());
    out[k * 2] = px * kx + proj.ox;
    out[k * 2 + 1] = py * ky + proj.oy;
  }
  return out;
}
