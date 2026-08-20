import type { MetadataRoute } from "next";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";

export default function sitemap(): MetadataRoute.Sitemap {
  // Del roster, no del cómputo de umbrales: una semana de scraping flojo no
  // puede sacar del sitemap una URL que Google ya indexó. De paso, el sitemap
  // deja de paginar la tabla entera de propiedades para armarse.
  const comunaUrls: MetadataRoute.Sitemap = COMUNAS_ROSTER.map((c) => ({
    url: `https://refranco.ai/comunas/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    { url: "https://refranco.ai", lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: "https://refranco.ai/pricing", lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: "https://refranco.ai/demo", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://refranco.ai/faq", lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: "https://refranco.ai/comunas", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: "https://refranco.ai/cobertura", lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: "https://refranco.ai/aprende", lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: "https://refranco.ai/about", lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: "https://refranco.ai/contact", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://refranco.ai/privacy", lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: "https://refranco.ai/terms", lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    ...comunaUrls,
  ];
}
