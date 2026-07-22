/**
 * Off-screen player indicators: pure edge-placement math plus a tiny DOM
 * registry bridging the R3F canvas (which knows the camera) and the DOM
 * arrow layer (which owns the elements). The tracker writes styles
 * imperatively every frame — no React state churn at 60fps.
 */

export interface ArrowPlacement {
  readonly visible: boolean;
  /** CSS px within the rink shell. */
  readonly x: number;
  readonly y: number;
  /** Screen-space rotation; 0 = pointing right. */
  readonly angleRad: number;
}

export const ARROW_EDGE_MARGIN_PX = 30;

const HIDDEN: ArrowPlacement = { visible: false, x: 0, y: 0, angleRad: 0 };

/**
 * Clamp an NDC point to the viewport edge (with margin) and aim an arrow at
 * it from screen center. On-screen points produce no arrow.
 */
export function placeEdgeArrow(
  ndcX: number,
  ndcY: number,
  width: number,
  height: number,
  margin = ARROW_EDGE_MARGIN_PX
): ArrowPlacement {
  if (
    !Number.isFinite(ndcX) ||
    !Number.isFinite(ndcY) ||
    (Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1)
  ) {
    return HIDDEN;
  }

  // Screen-space offset from center (NDC y is up, CSS y is down).
  const dx = ndcX * (width / 2);
  const dy = -ndcY * (height / 2);
  const tx = dx !== 0 ? (width / 2 - margin) / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? (height / 2 - margin) / Math.abs(dy) : Infinity;
  const t = Math.min(1, tx, ty);

  return {
    visible: true,
    x: width / 2 + dx * t,
    y: height / 2 + dy * t,
    angleRad: Math.atan2(dy, dx)
  };
}

// One Scene mounts at a time, so a module-level registry is safe; ref
// callbacks unregister with null on unmount.
const arrowElements = new Map<string, HTMLElement>();

export function registerArrowElement(id: string, element: HTMLElement | null): void {
  if (element) {
    arrowElements.set(id, element);
  } else {
    arrowElements.delete(id);
  }
}

export function getArrowElement(id: string): HTMLElement | undefined {
  return arrowElements.get(id);
}

/** Apply a placement to a registered arrow element (no-op when unmounted). */
export function applyArrowPlacement(id: string, placement: ArrowPlacement): void {
  const element = arrowElements.get(id);
  if (!element) {
    return;
  }

  if (!placement.visible) {
    element.style.visibility = "hidden";
    return;
  }

  element.style.visibility = "visible";
  element.style.transform =
    `translate(-50%, -50%) translate(${placement.x}px, ${placement.y}px) ` +
    `rotate(${placement.angleRad}rad)`;
}
