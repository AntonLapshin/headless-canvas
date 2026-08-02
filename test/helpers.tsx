/**
 * Shared test helpers: pointer-drag simulation + rendering harness.
 */

import { fireEvent, render } from '@testing-library/react';
import type { ReactElement } from 'react';

/** Simulate a full pointer drag (down → move → up) on the canvas root. */
export function drag(
  root: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pointerId = 1,
): void {
  fireEvent.pointerDown(root, {
    clientX: from.x,
    clientY: from.y,
    pointerId,
    buttons: 1,
  });
  fireEvent.pointerMove(root, {
    clientX: to.x,
    clientY: to.y,
    pointerId,
    buttons: 1,
  });
  fireEvent.pointerUp(root, {
    clientX: to.x,
    clientY: to.y,
    pointerId,
    buttons: 1,
  });
}

/** Render a canvas element and return the root node + RTL helpers. */
export function renderCanvas(ui: ReactElement): ReturnType<typeof render> & { root: HTMLElement } {
  const result = render(ui);
  const root = result.container.querySelector('[data-canvas]') as HTMLElement;
  if (!root) throw new Error('renderCanvas: no [data-canvas] element found');
  return { ...result, root };
}
