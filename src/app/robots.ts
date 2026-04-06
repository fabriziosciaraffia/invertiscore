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
        "/analisis/nuevo",
      ],
    },
    sitemap: "https://refranco.ai/sitemap.xml",
  };
}
