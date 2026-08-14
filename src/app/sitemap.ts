import type { MetadataRoute } from "next";
import { getAllComunasStats } from "@/lib/data/comunas-seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const comunas = await getAllComunasStats();

  const comunaUrls: MetadataRoute.Sitemap = comunas.map((c) => ({
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
