"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

/**
 * Input de moneda con separadores de miles es-CL ("5.000.000").
 * Drop-in replacement de `<input type="number">` para valores enteros.
 *
 * - El `value` prop es la forma CRUDA (ej. `"5000"` o `""`).
 * - El DOM muestra la forma FORMATEADA (ej. `"5.000"`).
 * - `onChange` recibe la forma cruda — sin puntos, solo dígitos.
 *
 * Solo soporta enteros. Si algún campo necesitara decimales UF, usar
 * `<input type="number" step="0.1">` directamente y documentar por qué.
 *
 * Trade-off conocido: al editar en medio del string, el cursor salta al final
 * en el siguiente render. Tolerable para el caso típico de tipeo desde cero.
 */

export function formatMiles(raw: string | number): string {
  const s = typeof raw === "number" ? String(raw) : (raw ?? "");
  const digits = s.replace(/\./g, "").replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-CL");
}

export function parseMiles(s: string): string {
  return (s ?? "").replace(/\./g, "").replace(/[^\d]/g, "");
}

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onChange: (raw: string) => void;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput({ value, onChange, inputMode, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode={inputMode ?? "numeric"}
        value={formatMiles(value)}
        onChange={(e) => onChange(parseMiles(e.target.value))}
        {...rest}
      />
    );
  },
);
