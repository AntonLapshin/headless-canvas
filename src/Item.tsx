/**
 * <Item> — a positioned block on the canvas.
 *
 * Registers its geometry with the canvas store on mount (initial values from
 * props), subscribes to its own store slice, and unregisters on unmount.
 * Geometry changes always come from the store, so the same <Item> can be
 * re-rendered with different props without losing drag state.
 *
 * Items without explicit width/height are measured (ResizeObserver on the
 * content box) and stored as their natural size. Auto-sized items cannot be
 * resized or scaled until given explicit dimensions (documented no-op).
 */

import { memo, useLayoutEffect, useRef } from 'react';
import styles from './canvas.module.scss';
import { ItemContext, useInternalCanvas } from './context';
import { useItemSnapshot } from './store';
import type { ItemGeometry, ItemProps } from './types';

function ItemComponent(props: ItemProps) {
  const { id, x, y, width, height, rotation, zIndex, locked, features, className, style, children } =
    props;
  const ctx = useInternalCanvas();
  const { store, disabled } = ctx;
  const contentRef = useRef<HTMLDivElement>(null);

  // Register initial geometry once per id (uncontrolled: props are initial
  // values; controlled: the canvas syncs the `items` prop over the store).
  const autoWidth = width === undefined;
  const autoHeight = height === undefined;
  useLayoutEffect(() => {
    store.register(
      id,
      { id, x, y, width, height, rotation, zIndex, locked },
      { width: autoWidth, height: autoHeight },
    );
    return () => store.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, store]);

  // Natural-size measurement for auto-sized items.
  useLayoutEffect(() => {
    if (!autoWidth && !autoHeight) return;
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const patch: Partial<ItemGeometry> = {};
      if (autoWidth) patch.width = Math.round(rect.width);
      if (autoHeight) patch.height = Math.round(rect.height);
      ctx.updateItem(id, patch);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, autoWidth, autoHeight]);

  // Live geometry from the store (falls back to props on the very first
  // render, before the registration effect runs).
  const snapshot = useItemSnapshot(store, id);
  const geometry: ItemGeometry = snapshot ?? {
    id,
    x,
    y,
    width,
    height,
    rotation,
    zIndex,
    locked,
  };

  const isLocked = geometry.locked === true;
  const selected = ctx.selectedId === id;
  const hovered = ctx.hoveredId === id;
  const selectable = !disabled;

  const wrapperStyle: React.CSSProperties = {
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.height,
    transform: geometry.rotation ? `rotate(${geometry.rotation}deg)` : undefined,
    zIndex: geometry.zIndex,
    ...style,
  };

  return (
    <ItemContext.Provider value={id}>
      <div
        ref={contentRef}
        className={`${styles.item}${className ? ` ${className}` : ''}`}
        style={wrapperStyle}
        data-item-id={id}
        data-selected={selected}
        data-hovered={hovered}
        data-locked={isLocked}
        data-disabled={disabled}
        role="group"
        tabIndex={selectable ? 0 : undefined}
        aria-selected={selectable ? selected : undefined}
      >
        {children}
        {features}
      </div>
    </ItemContext.Provider>
  );
}

/** Memoized: re-renders only when props change or its own geometry changes. */
export const Item = memo(ItemComponent);
