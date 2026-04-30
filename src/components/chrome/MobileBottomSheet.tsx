"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface BottomSheetItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: BottomSheetItem[];
  title?: string;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  items,
  title,
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] md:hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm bottom-sheet-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl bottom-sheet-slide"
        style={{
          background: "var(--franco-card)",
          borderTop: "0.5px solid var(--franco-border)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2.5">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "var(--franco-border-hover)" }}
            aria-hidden="true"
          />
        </div>

        {title && (
          <p
            className="font-mono uppercase m-0 px-6 mb-2"
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              color: "var(--franco-text-secondary)",
            }}
          >
            {title}
          </p>
        )}

        <ul className="list-none m-0 p-0 pb-4">
          {items.map((item, i) => {
            const handleClick = () => {
              item.onClick?.();
              onClose();
            };
            const content = (
              <span className="flex items-center gap-3 px-6 py-3 font-body text-sm font-medium text-[var(--franco-text)] hover:bg-[var(--franco-elevated)] transition-colors">
                {item.icon}
                <span>{item.label}</span>
              </span>
            );
            return (
              <li
                key={i}
                style={{
                  borderTop: i === 0 ? "none" : "0.5px solid var(--franco-border)",
                }}
              >
                {item.href ? (
                  <Link href={item.href} onClick={handleClick} className="block">
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleClick}
                    className="w-full text-left"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <style jsx>{`
        .bottom-sheet-fade {
          animation: sheetFade 200ms ease-out;
        }
        .bottom-sheet-slide {
          animation: sheetSlide 200ms ease-out;
        }
        @keyframes sheetFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheetSlide {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
