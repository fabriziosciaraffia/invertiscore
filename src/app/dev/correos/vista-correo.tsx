"use client";

// Un correo en un iframe del ancho pedido, con el alto de su contenido (el srcDoc es del mismo
// origen: se mide al cargar).
import { useRef, useState } from "react";

export function VistaCorreo({ html, ancho }: { html: string; ancho: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [alto, setAlto] = useState(640);
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontSize: 12, opacity: 0.6, margin: "0 0 6px" }}>{ancho} px</figcaption>
      <iframe
        ref={ref}
        title={`Correo a ${ancho} px`}
        srcDoc={html}
        width={ancho}
        height={alto}
        onLoad={() => {
          const d = ref.current?.contentDocument;
          if (d) setAlto(Math.max(d.documentElement.scrollHeight, d.body.scrollHeight) + 8);
        }}
        style={{ border: "1px solid #DDDDE1", borderRadius: 12, background: "#FAFAF8", display: "block" }}
      />
    </figure>
  );
}
