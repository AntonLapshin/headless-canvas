/**
 * <Canvas> — the root of the headless canvas.
 *
 * All pointer logic lives here, on ONE root element: pointerdown/move/up are
 * handled on the canvas root with pointer capture, and hit-testing is purely
 * geometric (coordinate math against the item + feature registries). The DOM
 * tree under the canvas is presentation only — that's what makes the library
 * headless and totally restyleable.
 *
 * The canvas provides a React context (width, height, scale, selection state,
 * registries) and an external geometry store (`useSyncExternalStore`, keyed by
 * item id) so a drag re-renders only the dragged item.
 */

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import styles from './canvas.module.scss';
import { CanvasContext, type InternalCanvasContext } from './context';
import {
  angleFromCenter,
  hitTest,
  moveGeometry,
  normalizeRotation,
  resizeGeometry,
  rotateToGeometry,
} from './hit';
import type { DragContext, FeatureEntry } from './registry';
import { FeatureRegistry } from './registry';
import { GeometryStore } from './store';
import type { ActiveDrag, CanvasHandle, CanvasProps, Constraints, DragKind, ItemGeometry } from './types';

/** rAF with a setTimeout fallback (jsdom / SSR environments). */
const raf = (cb: () => void): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : window.setTimeout(cb, 16);
const caf = (handle: number): void =>
  typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame(handle)
    : window.clearTimeout(handle);

interface DragSession {
  entry: FeatureEntry;
  itemId: string;
  kind: DragKind;
  /** Geometry at drag start — all drag math is relative to this. */
  start: ItemGeometry;
  startLogical: { x: number; y: number };
  pointerId: number;
}

function CanvasComponent(props: CanvasProps, ref: React.Ref<CanvasHandle>) {
  const {
    width,
    height,
    scale = 1,
    snapToGrid,
    constraints,
    disabled = false,
    selectedId: selectedIdProp,
    onSelect,
    items: itemsProp,
    onItemsChange,
    onDragStart,
    onDragEnd,
    onItemDoubleClick,
    className,
    style,
    children,
  } = props;

  // ---- stable stores (created once per canvas instance) ----
  const [store] = useState(() => new GeometryStore());
  const [registry] = useState(() => new FeatureRegistry());

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const controlled = itemsProp !== undefined;

  // ---- latest-props refs (stable callbacks, fresh values) ----
  const onSelectRef = useRef(onSelect);
  const onItemsChangeRef = useRef(onItemsChange);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onItemDoubleClickRef = useRef(onItemDoubleClick);
  onSelectRef.current = onSelect;
  onItemsChangeRef.current = onItemsChange;
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;
  onItemDoubleClickRef.current = onItemDoubleClick;

  // ---- selection state ----
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredCursor, setHoveredCursor] = useState<string | undefined>(undefined);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : internalSelectedId;

  const select = useCallback(
    (id: string | null) => {
      if (selectedIdProp === undefined) setInternalSelectedId(id);
      onSelectRef.current?.(id);
    },
    [selectedIdProp],
  );

  // ---- coordinate helpers ----
  const snap = useCallback(
    (value: number): number => {
      if (!snapToGrid || snapToGrid <= 0) return value;
      return Math.round(value / snapToGrid) * snapToGrid;
    },
    [snapToGrid],
  );

  /**
   * Effective bounds: items may never leave the canvas, so the canvas edges
   * are the default constraints. An explicit `constraints` prop overrides
   * individual edges (e.g. `{ maxX: 700 }` extends the right bound) but the
   * remaining edges stay pinned to the canvas.
   */
  const effectiveConstraints = useMemo<Constraints>(
    () => ({
      minX: constraints?.minX ?? 0,
      minY: constraints?.minY ?? 0,
      maxX: constraints?.maxX ?? width,
      maxY: constraints?.maxY ?? height,
      minWidth: constraints?.minWidth,
      minHeight: constraints?.minHeight,
    }),
    [constraints, width, height],
  );

  const toLogical = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = rootRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      return { x: (clientX - left) / scale, y: (clientY - top) / scale };
    },
    [scale],
  );

  // ---- onItemsChange notification (rAF-throttled during drag) ----
  const emit = useCallback(() => {
    onItemsChangeRef.current?.(store.getAll());
  }, [store]);
  const notify = useCallback(
    (immediate = false) => {
      if (immediate) {
        if (rafRef.current != null) {
          caf(rafRef.current);
          rafRef.current = null;
        }
        emit();
      } else if (rafRef.current == null) {
        rafRef.current = raf(() => {
          rafRef.current = null;
          emit();
        });
      }
    },
    [emit],
  );

  /** Public context helper: apply a geometry patch, notify consumers. */
  const updateItem = useCallback(
    (id: string, patch: Partial<ItemGeometry>) => {
      store.set(id, patch);
      notify();
    },
    [store, notify],
  );

  const getItems = useCallback(() => store.getAll(), [store]);

  /**
   * Items topmost-first for hit-testing. The selected item is forced to the
   * very top — matching its DOM z-index — so it wins the pointer even when
   * another item is later in the store order.
   */
  const topmostItems = useCallback((): ItemGeometry[] => {
    const items = store.getAll().reverse(); // topmost first
    if (!selectedId) return items;
    const idx = items.findIndex((g) => g.id === selectedId);
    if (idx <= 0) return items; // already topmost (or not registered)
    const [selected] = items.splice(idx, 1);
    items.unshift(selected);
    return items;
  }, [store, selectedId]);

  // ---- drag math dispatch ----
  const applyDrag = useCallback(
    (session: DragSession, dx: number, dy: number, logical: { x: number; y: number }, event: PointerEvent) => {
      const { entry, itemId, start } = session;
      const opts = { snapToGrid, constraints: effectiveConstraints };
      const ctx: DragContext = {
        itemId,
        start,
        dx,
        dy,
        logical,
        startLogical: session.startLogical,
        event,
        snap,
        constraints: effectiveConstraints,
        snapToGrid,
      };
      switch (session.kind) {
        case 'move':
          return moveGeometry(start, dx, dy, opts);
        case 'resize':
          // Auto-sized items have no explicit box to resize (documented no-op).
          if (store.isAutoSized(itemId)) return undefined;
          return resizeGeometry(start, entry.params?.direction ?? 'se', dx, dy, {
            ...opts,
            lockRatio: entry.params?.lockRatio,
          });
        case 'rotate': {
          const w = start.width ?? 0;
          const h = start.height ?? 0;
          const cx = start.x + w / 2;
          const cy = start.y + h / 2;
          const startAngle = angleFromCenter(cx, cy, session.startLogical.x, session.startLogical.y);
          const currentAngle = angleFromCenter(cx, cy, logical.x, logical.y);
          return rotateToGeometry(start, (start.rotation ?? 0) + (currentAngle - startAngle));
        }
        default:
          return entry.onDrag?.(ctx) ?? undefined;
      }
    },
    [snapToGrid, effectiveConstraints, snap, store],
  );

  const beginDrag = useCallback(
    (entry: FeatureEntry, itemId: string, logical: { x: number; y: number }, pointerId: number, currentTarget: HTMLElement) => {
      const start = store.get(itemId);
      if (!start) return;
      const kind = entry.kind as DragKind;
      dragRef.current = {
        entry,
        itemId,
        kind,
        start,
        startLogical: logical,
        pointerId,
      };
      setActiveDrag({ itemId, kind, direction: entry.params?.direction });
      onDragStartRef.current?.(itemId, kind);
      try {
        currentTarget.setPointerCapture?.(pointerId);
      } catch {
        /* pointer capture is a progressive enhancement (absent in jsdom) */
      }
    },
    [store],
  );

  // ---- pointer handlers (the single listener set) ----
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const logical = toLogical(e.clientX, e.clientY);
      const result = hitTest({
        point: logical,
        itemsTopmostFirst: topmostItems(),
        features: registry.getAll(),
      });
      if (result.type === 'feature') {
        select(result.itemId);
        const item = store.get(result.itemId);
        const locked = item?.locked === true;
        if (locked) return; // locked: selection only, no transform
        beginDrag(result.entry, result.itemId, logical, e.pointerId, e.currentTarget);
        e.preventDefault();
      } else if (result.type === 'item') {
        // Body clicks are deliberately ignored: the item's content owns them
        // (buttons, selects, links…). Nothing is intercepted, no selection is
        // made — the event passes through to the DOM normally.
      } else {
        select(null);
      }
    },
    [disabled, toLogical, store, registry, select, beginDrag, topmostItems],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const logical = toLogical(e.clientX, e.clientY);
      const session = dragRef.current;

      if (session && e.pointerId === session.pointerId) {
        const dx = logical.x - session.startLogical.x;
        const dy = logical.y - session.startLogical.y;
        const patch = applyDrag(session, dx, dy, logical, e.nativeEvent);
        if (patch) store.set(session.itemId, patch);
        notify(); // rAF-throttled during drag
        return;
      }

      if (e.buttons === 0) {
        // Hover tracking (only updates when the hovered item changes).
        const result = hitTest({
          point: logical,
          itemsTopmostFirst: topmostItems(),
          features: registry.getAll(),
        });
        const nextHovered = result.type === 'empty' ? null : result.itemId;
        setHoveredId((prev) => (prev === nextHovered ? prev : nextHovered));
        const nextCursor = result.type === 'feature' ? (result.entry.cursor ?? undefined) : undefined;
        setHoveredCursor((prev) => (prev === nextCursor ? prev : nextCursor));
      }
    },
    [disabled, toLogical, applyDrag, store, registry, notify, topmostItems],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      dragRef.current = null;
      setActiveDrag(null);
      onDragEndRef.current?.(session.itemId, session.kind);
      notify(true); // final, exact payload
    },
    [notify],
  );

  const handlePointerLeave = useCallback(() => {
    if (dragRef.current) return;
    setHoveredId(null);
    setHoveredCursor(undefined);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const logical = toLogical(e.clientX, e.clientY);
      const result = hitTest({
        point: logical,
        itemsTopmostFirst: topmostItems(),
        features: registry.getAll(),
      });
      if (result.type !== 'empty') onItemDoubleClickRef.current?.(result.itemId);
    },
    [disabled, toLogical, registry, topmostItems],
  );

  // ---- keyboard (bubbles up from a focused item) ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = e.target as HTMLElement;
      const id = target.dataset?.itemId;
      if (!id) return;
      const item = store.get(id);
      if (!item) return;

      if (e.key === 'Escape') {
        select(null);
        target.blur?.();
        return;
      }

      const locked = item.locked === true;
      if (locked) return; // locked blocks transforms (selection + focus stay)

      const step = 1;
      let patch: Partial<ItemGeometry> | null = null;

      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        select(id);
        if (e.shiftKey) {
          // Shift+arrows resize: right edge (horizontal) / bottom edge (vertical).
          // Auto-sized items cannot be resized (documented no-op).
          if (store.isAutoSized(id)) return;
          const direction = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? 'e' : 's';
          const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? step : -step;
          patch = resizeGeometry(item, direction, e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? delta : 0, e.key === 'ArrowUp' || e.key === 'ArrowDown' ? delta : 0, {
            constraints: effectiveConstraints,
          });
        } else {
          const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
          const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
          patch = moveGeometry(item, dx, dy, { constraints: effectiveConstraints });
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        select(id);
        patch = {
          rotation: normalizeRotation((item.rotation ?? 0) + (e.key === 'r' ? 15 : -15)),
        };
      }

      if (patch) {
        store.set(id, patch);
        notify(true);
      }
    },
    [disabled, store, select, effectiveConstraints, notify],
  );

  // ---- controlled mode: mirror the `items` prop into the store ----
  useEffect(() => {
    if (!controlled || dragRef.current) return;
    store.setMany(itemsProp ?? []);
  }, [controlled, itemsProp, store]);

  // ---- imperative handle ----
  useImperativeHandle(
    ref,
    () => ({
      getItems,
      setItems: (items: ItemGeometry[]) => {
        store.setMany(items);
        notify(true);
      },
      select,
      bringToFront: (id: string) => {
        if (!store.get(id)) return;
        const max = store.getAll().reduce(
          (m, g) => Math.max(m, store.effectiveZ(g.id)),
          -Infinity,
        );
        store.set(id, { zIndex: max + 1 });
        notify(true);
      },
      sendToBack: (id: string) => {
        if (!store.get(id)) return;
        const min = store.getAll().reduce(
          (m, g) => Math.min(m, store.effectiveZ(g.id)),
          Infinity,
        );
        store.set(id, { zIndex: min - 1 });
        notify(true);
      },
    }),
    [getItems, store, notify, select],
  );

  // ---- context value (stable during drags: geometry lives in the store) ----
  const contextValue = useMemo<InternalCanvasContext>(
    () => ({
      width,
      height,
      scale,
      selectedId,
      hoveredId,
      activeDrag,
      select,
      getItem: (id: string) => store.get(id),
      updateItem,
      snap,
      toLogical,
      store,
      registry,
      disabled,
      constraints: effectiveConstraints,
      snapToGrid,
      controlled,
    }),
    [
      width,
      height,
      scale,
      selectedId,
      hoveredId,
      activeDrag,
      select,
      updateItem,
      snap,
      toLogical,
      store,
      registry,
      disabled,
      effectiveConstraints,
      snapToGrid,
      controlled,
    ],
  );

  return (
    <CanvasContext.Provider value={contextValue}>
      <div
        ref={rootRef}
        className={`${styles.canvas}${className ? ` ${className}` : ''}`}
        style={{ width: width * scale, height: height * scale, cursor: hoveredCursor, ...style }}
        data-canvas
        role="group"
        aria-label={props['aria-label']}
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          className={styles.layer}
          style={{ width, height, transform: `scale(${scale})` }}
          data-canvas-layer
        >
          {children}
        </div>
      </div>
    </CanvasContext.Provider>
  );
}

/** Memoized: re-renders only on its own prop/state changes, not on drags. */
export const Canvas = memo(forwardRef(CanvasComponent));
