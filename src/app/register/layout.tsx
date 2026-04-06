import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear cuenta gratis",
  description: "Regístrate gratis en Franco y analiza departamentos como inversión. Score, rentabilidad, flujo de caja y más.",
  alternates: { canonical: "https://refranco.ai/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
