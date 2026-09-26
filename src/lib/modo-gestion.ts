// ─────────────────────────────────────────────────────────────────────────────
// EL MODO DE GESTIÓN DE RENTA CORTA, NORMALIZADO EN UN SOLO LUGAR (25-sep-2026)
//
// El input del wizard guarda "auto" | "administrador"; la comparativa AMBAS y sus hallazgos hablan
// en "auto" | "admin". Cada página casteaba el valor crudo (`as "auto" | "admin"`), así que un par
// con administrador llegaba como «administrador», el hallazgo de gestión comparaba contra «admin»,
// y lo leía como autogestionado: decía «el administrador tendría que conseguirte…» a alguien que
// ya delega.
//
// La regla es la del motor STR (`short-term-engine.ts`: comisión de plataforma solo con "auto"):
// autogestión es "auto" y nada más; cualquier otro valor —"administrador", "admin" o ausente— es
// administrador, porque así se calcularon los números que el texto describe.
// ─────────────────────────────────────────────────────────────────────────────

import type { ModoGestionAmbas } from "./engines/str-universo-santiago";

export function modoGestionAmbas(raw: unknown): ModoGestionAmbas {
  return raw === "auto" ? "auto" : "admin";
}
