import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Inicia sesión en Franco para ver tus análisis de inversión inmobiliaria.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
