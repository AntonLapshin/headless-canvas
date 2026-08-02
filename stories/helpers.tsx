/**
 * Shared Storybook helpers: canvas-handle registration for play functions,
 * pointer-drag simulation, and a small consumer stylesheet demonstrating the
 * data-attribute styling contract.
 */

import { useEffect, useRef } from 'react';
import { fireEvent } from '@storybook/test';
import type { CanvasHandle } from '../src/types';

declare global {
  interface Window {
    __hc?: { handle: CanvasHandle | null };
  }
}

/** Register the canvas handle on window so play functions can assert state. */
export function useCanvasHandle(): React.RefObject<CanvasHandle> {
  const ref = useRef<CanvasHandle | null>(null);
  useEffect(() => {
    window.__hc = { handle: ref.current };
    return () => {
      window.__hc = undefined;
    };
  }, []);
  return ref as React.RefObject<CanvasHandle>;
}

/**
 * Current canvas handle (from window). Plays can run before the story's
 * effects flush, so this polls briefly for the handle.
 */
export async function getHandle(timeoutMs = 3000): Promise<CanvasHandle> {
  const start = performance.now();
  while (!window.__hc?.handle) {
    if (performance.now() - start > timeoutMs) {
      throw new Error('no canvas handle registered');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return window.__hc.handle;
}

/** Simulate a pointer drag in client coordinates over the canvas root. */
export function dragTo(from: { x: number; y: number }, to: { x: number; y: number }): void {
  const root = document.querySelector('[data-canvas]') as HTMLElement;
  if (!root) throw new Error('no [data-canvas] element');
  const rect = root.getBoundingClientRect();
  const pt = (p: { x: number; y: number }) => ({ clientX: rect.left + p.x, clientY: rect.top + p.y });
  fireEvent.pointerDown(root, { ...pt(from), pointerId: 1, buttons: 1 });
  fireEvent.pointerMove(root, { ...pt(to), pointerId: 1, buttons: 1 });
  fireEvent.pointerUp(root, { ...pt(to), pointerId: 1, buttons: 1 });
}

/** Click (pointer down + up) at a point. */
export function clickAt(p: { x: number; y: number }): void {
  const root = document.querySelector('[data-canvas]') as HTMLElement;
  const rect = root.getBoundingClientRect();
  fireEvent.pointerDown(root, {
    clientX: rect.left + p.x,
    clientY: rect.top + p.y,
    pointerId: 1,
    buttons: 1,
  });
  fireEvent.pointerUp(root, {
    clientX: rect.left + p.x,
    clientY: rect.top + p.y,
    pointerId: 1,
    buttons: 1,
  });
}

/**
 * Flush React's batched state updates. Pointer events are treated as
 * continuous (non-discrete) by React, so a `data-*` attribute written by a
 * pointer handler is committed a microtask later — assert after `await flush()`.
 */
export async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

/**
 * Neutral content blocks used by the demos (consumer-owned styling). Colors
 * come from the styled kit's CSS variables (see stories/styled.tsx) with
 * light-theme fallbacks, so the same block works inside any theme.
 */
export const boxStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  color: 'var(--hc-text, #4a3f35)',
  background:
    'linear-gradient(135deg, var(--hc-item-bg, #faf6ef) 0%, var(--hc-item-bg-2, #f0e6d6) 100%)',
  border: '1px solid var(--hc-border, #d8c8ae)',
  borderRadius: 8,
  boxSizing: 'border-box',
  overflow: 'hidden',
  textAlign: 'center',
  padding: 8,
};
