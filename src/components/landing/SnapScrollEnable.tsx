"use client";

import { useEffect } from "react";

/**
 * Activa `scroll-snap-type: y proximity` en <html> mientras la landing
 * está montada y solo en viewports >= 768px. Mobile mantiene scroll libre.
 */
export default function SnapScrollEnable() {
  useEffect(() => {
    const html = document.documentElement;
    const mq = window.matchMedia("(min-width: 768px)");

    const apply = () => {
      html.style.scrollSnapType = mq.matches ? "y proximity" : "";
    };

    apply();
    mq.addEventListener("change", apply);
    return () => {
      html.style.scrollSnapType = "";
      mq.removeEventListener("change", apply);
    };
  }, []);

  return null;
}
