"use client";

import React from "react";

interface VizErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface VizErrorBoundaryState {
  hasError: boolean;
}

/**
 * Reusable error boundary for visualization components.
 *
 * A render error inside any wrapped visualization is caught and contained here
 * so it degrades to `fallback` (default `null`) instead of unmounting the
 * surrounding page and its `WebMCPToolRegistry`. This keeps the human UI and the
 * agent's WebMCP tool registration/execution operational even if a viz crashes.
 */
export class VizErrorBoundary extends React.Component<
  VizErrorBoundaryProps,
  VizErrorBoundaryState
> {
  constructor(props: VizErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): VizErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log so a failing visualization is observable but contained.
    console.error("VizErrorBoundary caught an error:", error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
