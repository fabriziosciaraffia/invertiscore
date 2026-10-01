"use client";

// El final del informe: una línea discreta, la única acción (ver lib/cierre-informe.ts). Sans, en el
// gris del texto secundario, el enlace subrayado en tinta. Sin mono, sin mayúsculas, sin rojo.
import { EnlaceCarga } from "@/components/chrome/EnlaceCarga";
import { RUTA_WIZARD } from "@/lib/cta-analizar";
import { textoCierre } from "@/lib/cierre-informe";

export function CierreInforme({ analisis, conSesion, suscriptor }: { analisis: number; conSesion: boolean; suscriptor: boolean }) {
  const t = textoCierre({ analisis, conSesion, suscriptor });
  return (
    <p className="font-body text-[15px] leading-relaxed text-[var(--franco-text-secondary)] m-0" data-cierre-informe>
      {t.saldo && <>{t.saldo} </>}
      <EnlaceCarga href={RUTA_WIZARD} className="text-[var(--franco-text)] underline underline-offset-4 decoration-1 hover:decoration-2">
        {t.enlace}
      </EnlaceCarga>
    </p>
  );
}
