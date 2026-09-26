import type { Metadata } from "next";

export const metadata: Metadata = {
  // Plantilla propia: la pestaña de renta corta (`/demo/renta-corta`) pone su título y hereda el sufijo.
  title: { default: "Demo — Ejemplo en renta larga", template: "%s | Franco" },
  description: "Un análisis completo de Franco para renta larga: Franco Score, flujo mensual, la zona y qué ajustar para que convenga.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
