/**
 * Vitest setup: jsdom polyfills the library relies on.
 */

import '@testing-library/jest-dom/vitest';

/* ------------------------------------------------------------------ */
/* ResizeObserver mock                                                 */
/* ------------------------------------------------------------------ */

interface MockObserver {
  el: Element;
  cb: ResizeObserverCallback;
}

const observers: MockObserver[] = [];

class MockResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}

  observe(el: Element): void {
    observers.push({ el, cb: this.cb });
  }

  unobserve(el: Element): void {
    const i = observers.findIndex((o) => o.el === el);
    if (i >= 0) observers.splice(i, 1);
  }

  disconnect(): void {
    observers.length = 0;
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver;
}

/** Fire a ResizeObserver callback for a specific element (test helper). */
export function emitResize(el: Element, width: number, height: number): void {
  const rect = { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height };
  const entry = { target: el, contentRect: rect, borderBoxSize: [], contentBoxSize: [] };
  for (const o of [...observers]) {
    if (o.el === el) o.cb([entry as unknown as ResizeObserverEntry], o.cb as unknown as ResizeObserver);
  }
}

/* ------------------------------------------------------------------ */
/* Pointer capture guards (jsdom does not implement them)              */
/* ------------------------------------------------------------------ */

if (typeof Element !== 'undefined') {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
}
