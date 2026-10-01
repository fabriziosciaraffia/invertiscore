import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entra a Franco con un código a tu correo. Sin contraseña.",
  robots: { index: false, follow: false },
};

export default function EntrarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
