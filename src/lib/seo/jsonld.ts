// ─────────────────────────────────────────────────────────────────────────
// JSON-LD estructural del sitio — objetos tipados, un solo <script> en el
// root layout. Enforcement por construcción: los bloques se arman acá con
// tipos, no como strings sueltos en JSX.
//
// Tres nodos bajo un @graph (un solo @context, sin duplicarlo):
//   Organization — la entidad legal detrás de la marca
//   WebSite      — el sitio, publicado por la Organization
//   WebApplication — la app (movida desde layout.tsx, mismo contenido)
// ─────────────────────────────────────────────────────────────────────────

const SITE_URL = "https://refranco.ai";

interface OrganizationNode {
  "@type": "Organization";
  "@id": string;
  name: string;
  legalName: string;
  url: string;
  logo: string;
  sameAs: string[];
}

interface WebSiteNode {
  "@type": "WebSite";
  "@id": string;
  name: string;
  url: string;
  publisher: { "@id": string };
}

interface WebApplicationNode {
  "@type": "WebApplication";
  name: string;
  url: string;
  applicationCategory: "FinanceApplication";
  operatingSystem: string;
  description: string;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: "CLP";
  };
}

interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": [OrganizationNode, WebSiteNode, WebApplicationNode];
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const organization: OrganizationNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "refranco",
  legalName: "YAPE DIGITAL SPA",
  url: SITE_URL,
  // Isotipo "f." raster 512×512 — servido por la convención src/app/icon.png.
  logo: `${SITE_URL}/icon.png`,
  sameAs: ["https://www.instagram.com/refranco.ai/"],
};

const webSite: WebSiteNode = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "refranco",
  url: SITE_URL,
  publisher: { "@id": ORGANIZATION_ID },
};

const webApplication: WebApplicationNode = {
  "@type": "WebApplication",
  name: "Franco",
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Analiza departamentos como inversión en Santiago con datos reales. Franco Score, rentabilidad, flujo de caja y análisis con IA.",
  offers: {
    "@type": "Offer",
    price: "9990",
    priceCurrency: "CLP",
  },
};

export function buildSiteJsonLd(): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [organization, webSite, webApplication],
  };
}
