import { Component, type ReactNode } from 'react';

// Renders a fallback (the procedural body) if the GLB model fails to load/clone,
// so the game never breaks when an asset is missing.
export class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('[bbh] model failed to load, using procedural fallback', err);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
