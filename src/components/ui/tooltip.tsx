"use client";

import { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";

// Singleton: solo un tooltip abierto a la vez. Cuando una instancia abre,
// dispatcha un evento que cierra todas las demas. Cada instancia escucha
// y se cierra si el evento NO viene de si misma.
const FRANCO_TOOLTIP_OPEN_EVENT = "franco:tooltip-open";
interface TooltipOpenDetail { exceptId: string; }

interface TooltipBubbleProps {
  content: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

function TooltipBubble({ content, triggerRef, onClose }: TooltipBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!triggerRef.current || !bubbleRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current;
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const margin = 12;
    const gap = 8;
    const vw = window.innerWidth;

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
      // Arrow at bottom center, pointing down toward trigger
      const clampedArrowLeft = Math.max(8, Math.min(arrowLeft, bw - 8));
      setArrowStyle({
        position: "absolute",
        bottom: -4,
        left: clampedArrowLeft,
        transform: "translateX(-50%) rotate(45deg)",
      });
    } else if (side === "left") {
      // Arrow on left side pointing left toward trigger
      setArrowStyle({
        position: "absolute",
        left: -4,
        top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
      });
    } else {
      // Arrow on right side pointing right toward trigger
      setArrowStyle({
        position: "absolute",
        right: -4,
        top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
      });
    }

    setStyle({
      position: "fixed",
      top,
      left,
      opacity: 1,
    });
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

  return createPortal(
    <div
      ref={bubbleRef}
      style={style}
      className="z-[9999] bg-[var(--franco-card)] text-[var(--franco-text)] border border-[var(--franco-border)] font-body text-[11px] leading-snug p-2.5 px-3 rounded-lg w-[220px] shadow-lg pointer-events-auto"
    >
      {content}
      <div className="w-2 h-2 bg-[var(--franco-card)]" style={arrowStyle} />
    </div>,
    document.body,
  );
}

interface InfoTooltipProps {
  content: string;
  /**
   * Trigger mode: "hover" (default — abre con hover y click, mantiene
   * comportamiento legacy) o "click" (solo click, mejor en mobile).
   */
  trigger?: "hover" | "click";
}

export function InfoTooltip({ content, trigger = "hover" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

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

  // Hover handlers: solo en mode "hover" (default). En "click" se ignoran.
  const hoverHandlers =
    trigger === "hover"
      ? {
          onMouseEnter: handleOpen,
          onMouseLeave: () => setOpen(false),
        }
      : {};

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Más información"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-[var(--franco-border)] font-mono text-[9px] text-[var(--franco-text-muted)] cursor-help shrink-0 hover:bg-[var(--franco-border-hover)] hover:text-[var(--franco-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--franco-text-secondary)] focus:ring-offset-1 focus:ring-offset-[var(--franco-bg)] transition-colors"
        onClick={handleToggle}
        {...hoverHandlers}
      >
        ?
      </button>
      {open && (
        <TooltipBubble
          content={content}
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
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
