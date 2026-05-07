import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Wrapper card con header (icono + título + descripción) y contenido. Move
 * verbatim desde results-client.tsx LTR (Ronda 4a.1). Hoy sin usages activos
 * en LTR — preservada para reuso futuro.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mb-8">
      <Card className="border border-[var(--franco-border)] rounded-2xl shadow-sm bg-[var(--franco-card)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[var(--franco-text)]" />
            <CardTitle className="font-body font-medium text-lg text-[var(--franco-text)]">{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-[var(--franco-text-secondary)]">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
