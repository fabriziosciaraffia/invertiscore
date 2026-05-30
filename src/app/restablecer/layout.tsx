import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Crea una nueva contraseña para tu cuenta de Franco.",
  robots: { index: false, follow: false },
};

export default function RestablecerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
