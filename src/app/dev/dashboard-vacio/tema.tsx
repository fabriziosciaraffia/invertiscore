"use client";

// El tema de la demo, por la URL: el sitio va en claro con data-theme="light" y en oscuro sin él.
import { useEffect } from "react";

export function Tema({ oscuro }: { oscuro: boolean }) {
  useEffect(() => {
    if (oscuro) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", "light");
  }, [oscuro]);
  return null;
}
