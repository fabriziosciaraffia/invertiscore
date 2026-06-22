"use client";

import { useState } from "react";
import Link from "next/link";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { FAQ_SECTIONS, type FAQItem } from "@/lib/faq-data";

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

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
{/* Navbar */}
      <UnifiedNav variant="marketing" />

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
