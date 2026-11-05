// El FAQ (05-nov-2026, auditoría de promesas parte 3): la cifra de comparables es el conteo vivo (comparables-vivos.ts), así
// que la página la lee en el servidor, cada hora, y el acordeón sigue siendo de cliente (faq-cliente.tsx).
import { comparablesVivos } from "@/lib/comparables-vivos";
import { faqSecciones } from "@/lib/faq-data";
import { FaqCliente } from "./faq-cliente";

export const revalidate = 3600;

export default async function FAQPage() {
  const { texto } = await comparablesVivos();
  return <FaqCliente secciones={faqSecciones(texto)} />;
}
