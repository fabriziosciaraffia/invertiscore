"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

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

  // Close on outside click/touch
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        bubbleRef.current && !bubbleRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose, triggerRef]);

  return createPortal(
    <div
      ref={bubbleRef}
      style={style}
      className="z-[9999] bg-[#0F0F0F] text-white font-body text-[11px] leading-snug p-2.5 px-3 rounded-lg w-[220px] shadow-lg pointer-events-auto"
    >
      {content}
      <div className="w-2 h-2 bg-[#0F0F0F]" style={arrowStyle} />
    </div>,
    document.body,
  );
}

export function InfoTooltip({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-[#F0F0EC] font-mono text-[9px] text-[#71717A] cursor-help shrink-0"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
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
