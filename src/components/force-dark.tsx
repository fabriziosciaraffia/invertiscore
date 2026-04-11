"use client";

import { useEffect } from "react";

export function ForceDark() {
  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme");
    return () => {
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    };
  }, []);
  return null;
}
