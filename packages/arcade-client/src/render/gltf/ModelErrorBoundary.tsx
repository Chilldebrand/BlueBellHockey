import { Component, type ReactNode } from "react";

export interface ModelErrorBoundaryProps {
  /** Rendered instead of the children when GLB loading/render throws. */
  readonly fallback: ReactNode;
  readonly children: ReactNode;
  /** Optional hook for logging which asset failed. */
  readonly onError?: (error: unknown) => void;
}

interface ModelErrorBoundaryState {
  readonly failed: boolean;
}

/**
 * Keeps a broken or missing GLB from blanking the rink: a load/parse/render
 * failure inside the GLTF body path is caught here and the procedural blockout
 * is shown instead. Suspense handles the *loading* state; this handles *errors*.
 */
export class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  constructor(props: ModelErrorBoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
