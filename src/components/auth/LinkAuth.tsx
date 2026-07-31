"use client";

// Link entre /login y /register que conserva la intención de destino
// (`?next=`, `?plan=`). Mismo patrón que `CtaAnalizar`: un componente para que
// el próximo link no nazca roto por olvidarse de preservar la query.
//
// La query se lee en un efecto y no durante el render a propósito. `/login` y
// `/register` son client components pero Next igual los renderiza en el server,
// donde `window` no existe: calcularla en render daría un href distinto en
// servidor y cliente, o sea desajuste de hidratación. Con el efecto, el primer
// render coincide con el del server y el href se completa al hidratar.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { hrefAuth } from "@/lib/auth-next";

export function LinkAuth({
  destino,
  children,
  className,
}: {
  destino: "/login" | "/register";
  children: ReactNode;
  className?: string;
}) {
  const [href, setHref] = useState<string>(destino);

  useEffect(() => {
    setHref(hrefAuth(destino, window.location.search));
  }, [destino]);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
