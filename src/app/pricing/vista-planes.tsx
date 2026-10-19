"use client";

import { useEffect } from "react";
import { usePostHog } from "@/lib/posthog-react";

/** El evento de la página de planes (el mismo de antes: `pricing_viewed`), desde que la página es de servidor. */
export function VistaPlanes() {
  const posthog = usePostHog();
  useEffect(() => {
    posthog?.capture("pricing_viewed");
  }, [posthog]);
  return null;
}
