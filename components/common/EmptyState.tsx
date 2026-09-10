import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight sm:text-2xl">
        {title}
      </p>
      {description && (
        <p className="mt-3 max-w-sm whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
