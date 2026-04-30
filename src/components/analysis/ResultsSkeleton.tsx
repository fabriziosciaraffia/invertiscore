"use client";

// Skeleton mimético del layout de resultados. Disponible para usar como
// transición breve (<2s) cuando el contenido real tarda en hidratar.
// Hoy NO se usa en el flujo principal — `page.tsx` server component
// recibe data sincrónica de Supabase, sin async lazy en results-client.

export function ResultsSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4">
        {/* Hero card */}
        <div
          className="results-skeleton-shimmer rounded-2xl"
          style={{ height: 280, background: "var(--franco-elevated)" }}
        />
        {/* Verdict callout */}
        <div
          className="results-skeleton-shimmer rounded-xl"
          style={{ height: 80, background: "var(--franco-elevated)" }}
        />
        {/* 4 subject cards 2x2. La primera mantiene el border Signal Red 1.5px
            para preservar la jerarquía visual del card "featured". */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="results-skeleton-shimmer rounded-xl"
              style={{
                height: 150,
                background: "var(--franco-elevated)",
                ...(i === 0 ? { border: "1.5px solid var(--signal-red)" } : {}),
              }}
            />
          ))}
        </div>
        {/* Drawer trigger (Zona) */}
        <div
          className="results-skeleton-shimmer rounded-lg"
          style={{ height: 60, background: "var(--franco-elevated)" }}
        />
      </div>

      <style jsx>{`
        .results-skeleton-shimmer {
          position: relative;
          overflow: hidden;
        }
        .results-skeleton-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            color-mix(in srgb, var(--franco-text) 4%, transparent) 50%,
            transparent 100%
          );
          animation: skeletonShimmer 1.8s linear infinite;
        }
        @keyframes skeletonShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
