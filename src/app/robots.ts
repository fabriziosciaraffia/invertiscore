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
        // Las reglas de robots.txt son por PREFIJO: esta línea no cubre solo la
        // ruta literal /analisis/nuevo (borrada el 2026-08-03 con el wizard v1)
        // sino también /analisis/nuevo-v2 y /analisis/nuevo-v4, que están vivos.
        // Por eso queda: sacarla abriría los wizards a indexación.
        "/analisis/nuevo",
      ],
    },
    sitemap: "https://refranco.ai/sitemap.xml",
  };
}
