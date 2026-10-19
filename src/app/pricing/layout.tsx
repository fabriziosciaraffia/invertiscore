import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Gratis, un pack de 3 análisis por $19.990 sin vencimiento, o el Plan Franco: 20 análisis al mes por $39.990.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
