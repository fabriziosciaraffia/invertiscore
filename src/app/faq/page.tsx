"use client";

import { useState } from "react";
import Link from "next/link";
import { AppNav, NavPrimaryCTA } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

function Accordion({ item, isOpen, onClick }: { item: FAQItem; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-[var(--franco-border)]">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="font-body text-sm font-medium text-[var(--franco-text)] pr-4">{item.q}</span>
        <span className="font-mono text-lg text-[var(--franco-text-muted)] group-hover:text-[var(--franco-text)] transition-colors shrink-0">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && (
        <div className="pb-4 pr-8">
          <p className="font-body text-sm text-[var(--franco-text-secondary)] leading-relaxed">{item.a}</p>
        </div>
      )}
    </div>
  );
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Sobre Franco",
    items: [
      {
        q: "¿Qué es Franco?",
        a: "Franco es una plataforma que analiza departamentos como inversión en Chile. Te dice si un depto es buen negocio, a qué precio conviene y qué retorno puedes esperar — con datos reales, no con la opinión de un corredor.",
      },
      {
        q: "¿Qué es el Franco Score?",
        a: "Es un puntaje de 1 a 100 que evalúa qué tan buena inversión es un departamento, considerando rentabilidad, flujo de caja, plusvalía esperada, riesgo y eficiencia del capital. A mayor score, mejor inversión.",
      },
      {
        q: "¿Qué significan los veredictos?",
        a: "COMPRAR significa que los números cierran bien. AJUSTA EL PRECIO significa que hay potencial pero al precio actual no es ideal — negocia o espera una baja. BUSCAR OTRA significa que los números no cierran y probablemente hay mejores opciones.",
      },
      {
        q: "¿De dónde salen los datos?",
        a: "Analizamos información de mercado de más de 20.000 propiedades en 24 comunas de Santiago. Los datos incluyen precios de venta, arriendos y condiciones actuales del mercado.",
      },
      {
        q: "¿Qué tan confiable es el análisis?",
        a: "Franco usa los mismos modelos financieros que usan los inversionistas profesionales: TIR, cash-on-cash, rentabilidad neta, proyecciones de flujo. La diferencia es que lo automatizamos y lo hacemos accesible. Dicho esto, ningún modelo predice el futuro con certeza — Franco te da la mejor foto posible con los datos disponibles.",
      },
      {
        q: "¿Franco reemplaza a un corredor?",
        a: "No. Franco complementa tu proceso de decisión. Un corredor te muestra propiedades y gestiona la transacción. Franco te dice si esa propiedad es buen negocio como inversión. La diferencia: tu corredor gana si compras, Franco gana si decides bien.",
      },
    ],
  },
  {
    title: "Sobre el pago",
    items: [
      {
        q: "¿Qué incluye el informe Pro?",
        a: "Análisis IA personalizado con veredicto y precio sugerido, proyecciones de patrimonio y flujo a 20 años, escenarios de salida (venta y refinanciamiento), panel para ajustar variables de financiamiento, y análisis de sensibilidad con 3 escenarios.",
      },
      {
        q: "¿Puedo analizar varios deptos?",
        a: "Sí. El análisis básico (score + métricas + comparación zona) es gratis e ilimitado. Cada informe Pro desbloquea un análisis específico. Si quieres analizar otro depto, necesitas otro crédito o una suscripción mensual.",
      },
    ],
  },
  {
    title: "Sobre inversión inmobiliaria",
    items: [
      {
        q: "¿Por qué el 95% de los deptos tiene flujo negativo?",
        a: "Con las tasas hipotecarias actuales en Chile (~4-5%), es matemáticamente casi imposible que el arriendo cubra el dividendo más gastos. Eso no significa que sea mala inversión — significa que la rentabilidad viene de la plusvalía y la amortización del crédito, no del flujo mensual.",
      },
      {
        q: "¿Entonces conviene invertir o no?",
        a: "Depende de cada caso. Un depto con flujo negativo de $50.000/mes puede ser excelente inversión si la plusvalía y amortización generan un retorno de 3-4x en 10 años. Franco te ayuda a ver ese panorama completo.",
      },
    ],
  },
  {
    title: "Legal",
    items: [
      {
        q: "¿Franco es asesor financiero?",
        a: "No. Franco es una herramienta informativa que analiza datos de mercado. No constituye asesoría financiera, tributaria ni recomendación de inversión. Las decisiones de inversión son responsabilidad exclusiva del usuario.",
      },
      {
        q: "¿Mis datos están seguros?",
        a: "Sí. Usamos encriptación SSL, autenticación segura con Supabase y no compartimos tus datos personales con terceros. Los pagos se procesan de forma segura a través de Flow.cl.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Navbar */}
      <AppNav
        variant="marketing"
        linksSlot={
          <Link href="/pricing" className="font-body text-sm text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
            Precios
          </Link>
        }
        ctaSlot={<NavPrimaryCTA href="/analisis/nuevo-v2" label="Analizar →" />}
        mobileMenuItems={[{ label: "Precios", href: "/pricing" }]}
      />

      {/* Header */}
      <section className="py-16 px-6">
        <div className="max-w-[600px] mx-auto text-center">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-[var(--franco-text)]">Preguntas frecuentes</h1>
          <p className="font-body text-sm text-[var(--franco-text-muted)] mt-3">Todo lo que necesitas saber sobre Franco y la inversión inmobiliaria en Chile.</p>
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="pb-20 px-6">
        <div className="max-w-[600px] mx-auto space-y-12">
          {FAQ_SECTIONS.map((section, si) => (
            <div key={si}>
              <h2 className="font-heading font-bold text-lg text-[var(--franco-text)] mb-4">{section.title}</h2>
              <div>
                {section.items.map((item, ii) => {
                  const id = `${si}-${ii}`;
                  return (
                    <Accordion
                      key={id}
                      item={item}
                      isOpen={openId === id}
                      onClick={() => toggle(id)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="border-t border-[var(--franco-border)] py-8 px-6">
        <p className="text-[11px] text-[var(--franco-text-muted)] text-center max-w-md mx-auto leading-relaxed font-body">
          Franco es una herramienta informativa. Los resultados son estimaciones basadas en datos de mercado y no constituyen asesoría financiera, tributaria ni legal.
        </p>
      </section>

      {/* Footer */}
      <AppFooter
        variant="minimal"
        linksSlot={
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Precios</Link>
            <Link href="/terms" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Términos</Link>
            <Link href="/privacy" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Privacidad</Link>
            <Link href="/contact" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">Contacto</Link>
          </div>
        }
      />
    </div>
  );
}
