import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/perfil",
        "/admin",
        "/api/",
        "/auth/",
        "/checkout",
        "/payments/",
        // Prefijo: cubre wizards (/analisis/nuevo*), informes de usuarios
        // (/analisis/[id], /analisis/renta-corta/[id]), vistas /documento y la
        // comparativa. Los informes además llevan noindex por página — robots.txt
        // bloquea el crawl, no la indexación de URLs descubiertas por links.
        "/analisis/",
      ],
    },
    sitemap: "https://refranco.ai/sitemap.xml",
  };
}
