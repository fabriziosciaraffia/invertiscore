"use client";

import { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

// Singleton: solo un tooltip abierto a la vez. Cuando una instancia abre,
// dispatcha un evento que cierra todas las demas. Cada instancia escucha
// y se cierra si el evento NO viene de si misma.
const FRANCO_TOOLTIP_OPEN_EVENT = "franco:tooltip-open";
interface TooltipOpenDetail { exceptId: string; }

type TokenSet = "app" | "landing";

interface TooltipBubbleProps {
  content: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  /**
   * "app" (default) usa los tokens --franco-* (definidos en :root /
   * [data-theme]). "landing" usa --landing-* y portaliza dentro de
   * [data-franco-root] — donde esos tokens existen y siguen el toggle de tema
   * de la landing. La landing NO setea data-theme, así que un portal a body con
   * --franco-* quedaría en dark permanente en modo claro.
   */
  tokenSet?: TokenSet;
}

function TooltipBubble({
  content,
  triggerRef,
  onClose,
  tokenSet = "app",
}: TooltipBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Inicializar fuera de flujo evita que el primer paint ponga el bubble en
  // body flow (block, ~60px alto) y dispare scrollbar flicker / layout shift
  // hasta que el primer rAF lo reposicione.
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
    opacity: 0,
  });
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});

  // Reposicionamiento dinámico: rAF loop mientras el bubble está montado.
  // Captura cambios de scroll, resize y animaciones CSS (transform/translate)
  // del wizard que no disparan eventos DOM. Comparación de rect-key evita
  // setState innecesarios cuando nada cambió.
  useEffect(() => {
    if (!triggerRef.current || !bubbleRef.current) return;

    let rafId = 0;
    let lastKey = "";

    const compute = () => {
      const triggerEl = triggerRef.current;
      const bubble = bubbleRef.current;
      if (!triggerEl || !bubble) {
        rafId = requestAnimationFrame(compute);
        return;
      }

      const trigger = triggerEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const bw = bubble.offsetWidth;
      const bh = bubble.offsetHeight;
      const key = `${trigger.top}|${trigger.left}|${trigger.width}|${trigger.height}|${bw}|${bh}|${vw}`;

      if (key !== lastKey) {
        lastKey = key;
        const margin = 12;
        const gap = 8;

        // Try top-center first
        let top = trigger.top - bh - gap;
        let left = trigger.left + trigger.width / 2 - bw / 2;

        // Clamp horizontal so it stays on screen
        if (left < margin) left = margin;
        if (left + bw > vw - margin) left = vw - margin - bw;

        // Arrow points down to trigger
        let side: "bottom" | "left" | "right" = "bottom";
        const arrowLeft = trigger.left + trigger.width / 2 - left;

        // If no room above, try right
        if (top < margin) {
          top = trigger.top + trigger.height / 2 - bh / 2;
          left = trigger.right + gap;
          side = "left";

          // If no room right either, go left of trigger
          if (left + bw > vw - margin) {
            left = trigger.left - bw - gap;
            side = "right";
          }
        }

        if (side === "bottom") {
          const clampedArrowLeft = Math.max(8, Math.min(arrowLeft, bw - 8));
          setArrowStyle({
            position: "absolute",
            bottom: -4,
            left: clampedArrowLeft,
            transform: "translateX(-50%) rotate(45deg)",
          });
        } else if (side === "left") {
          setArrowStyle({
            position: "absolute",
            left: -4,
            top: "50%",
            transform: "translateY(-50%) rotate(45deg)",
          });
        } else {
          setArrowStyle({
            position: "absolute",
            right: -4,
            top: "50%",
            transform: "translateY(-50%) rotate(45deg)",
          });
        }

        setStyle({ position: "fixed", top, left, opacity: 1 });
      }

      rafId = requestAnimationFrame(compute);
    };

    rafId = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(rafId);
  }, [triggerRef]);

  // Close on outside click/touch + ESC
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        bubbleRef.current && !bubbleRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose, triggerRef]);

  const isLanding = tokenSet === "landing";
  const bubbleColors = isLanding
    ? "bg-[var(--landing-card-bg)] text-[var(--landing-text)] border-[var(--landing-card-border)]"
    : "bg-[var(--franco-card)] text-[var(--franco-text)] border-[var(--franco-border)]";
  const arrowColor = isLanding
    ? "bg-[var(--landing-card-bg)]"
    : "bg-[var(--franco-card)]";

  // Landing: portalizar dentro de [data-franco-root] (no es contenedor con
  // clipping ni transform → position:fixed sigue siendo relativo al viewport)
  // para que --landing-* resuelvan y sigan el tema. App: a body como siempre.
  const target =
    (isLanding && document.querySelector<HTMLElement>("[data-franco-root]")) ||
    document.body;

  return createPortal(
    <div
      ref={bubbleRef}
      style={style}
      className={`z-[9999] border font-body text-[11px] leading-snug p-2.5 px-3 rounded-lg w-[260px] franco-tooltip-bubble pointer-events-auto ${bubbleColors}`}
    >
      {content}
      <div className={`w-2 h-2 ${arrowColor}`} style={arrowStyle} />
    </div>,
    target,
  );
}

interface InfoTooltipProps {
  content: string;
  /**
   * Trigger mode:
   * - "auto" (default): hover+click en dispositivos hover-capable, solo click
   *   en touch. Detecta vía matchMedia("(hover: hover) and (pointer: fine)").
   * - "click": solo click, en cualquier dispositivo.
   * - "hover": fuerza hover+click incluso en touch (legacy, evita usar — provoca
   *   parpadeo en iOS porque mouseenter sintetizado dispara antes que click).
   */
  trigger?: "auto" | "hover" | "click";
  /** Set de tokens cromáticos: "app" (--franco-*) o "landing" (--landing-*). */
  tokenSet?: TokenSet;
}

export function InfoTooltip({
  content,
  trigger = "auto",
  tokenSet = "app",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Auto-detect hover capability. Initial false evita registrar handlers
  // de hover en touch durante el primer render (donde mouseenter sintetizado
  // de iOS dispararía el bug). En desktop, el effect corre tras el paint y
  // hover empieza a funcionar; gap es de unos ms.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHoverCapable(mq.matches);
    const handler = (e: MediaQueryListEvent) => setHoverCapable(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Singleton: cuando este abre, cerrar todos los demas. Cuando recibe el
  // evento abierto por otro, este se cierra.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TooltipOpenDetail>).detail;
      if (detail?.exceptId !== id) setOpen(false);
    };
    window.addEventListener(FRANCO_TOOLTIP_OPEN_EVENT, handler);
    return () => window.removeEventListener(FRANCO_TOOLTIP_OPEN_EVENT, handler);
  }, [id]);

  function handleOpen() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<TooltipOpenDetail>(FRANCO_TOOLTIP_OPEN_EVENT, {
          detail: { exceptId: id },
        }),
      );
    }
    setOpen(true);
  }

  function handleToggle() {
    if (open) {
      setOpen(false);
    } else {
      handleOpen();
    }
  }

  const useHover = trigger === "hover" || (trigger === "auto" && hoverCapable);

  const hoverHandlers = useHover
    ? {
        onMouseEnter: handleOpen,
        onMouseLeave: () => setOpen(false),
      }
    : {};

  // El trigger se renderiza inline (dentro del subtree temático), así que
  // --landing-* sí resuelven aquí sin necesidad de portal.
  // Trigger discreto (Fase 2, ronda final): glifo Info muted, sin caja ni fondo
  // — nota al pie, no botón. Mismo estilo en ambos temas (muted → aclara en hover).
  const triggerColors =
    tokenSet === "landing"
      ? "text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)] focus-visible:ring-[var(--landing-text-secondary)]"
      : "text-[var(--franco-text-tertiary)] hover:text-[var(--franco-text-secondary)] focus-visible:ring-[var(--franco-text-secondary)]";

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Más información"
        aria-expanded={open}
        className={`inline-flex items-center justify-center align-middle cursor-help shrink-0 p-1 -m-1 rounded-full focus:outline-none focus-visible:ring-1 transition-colors ${triggerColors}`}
        onClick={handleToggle}
        {...hoverHandlers}
      >
        <Info size={12} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <TooltipBubble
          content={content}
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
          tokenSet={tokenSet}
        />
      )}
    </span>
  );
}

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="inline-flex">
      <div
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </div>
      {open && (
        <TooltipBubble
          content={content}
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
