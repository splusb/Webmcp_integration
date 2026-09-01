"use client";

/**
 * Shared presentational states for visualizations.
 * Styled with the neutral Tailwind palette used across the app
 * (see components/ProjectCard.tsx and app/dashboard/page.tsx).
 * Each renders fine inside a card or a panel.
 */

export function VizLoading({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      <p className="mt-3 text-sm text-gray-500">{label ?? "Loading..."}</p>
    </div>
  );
}

export function VizEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-gray-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function VizError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-gray-600">{message ?? "Something went wrong."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}
