/**
 * External geometry store (one per `<Canvas>`).
 *
 * The store is a plain `Map<id, ItemGeometry>` with immutable item objects and
 * a version-bumped subscription. Per-item subscription granularity comes from
 * `useSyncExternalStore`: each subscriber snapshots *its own* item object, and
 * React only re-renders when that snapshot's identity changes — so a drag
 * re-renders only the dragged item, never the whole canvas.
 *
 * The store is deliberately framework-free: Canvas/Item subscribe via the
 * `useItemSnapshot` hook below.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { ItemGeometry } from './types';

const GEOMETRY_KEYS: (keyof ItemGeometry)[] = [
  'id',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'zIndex',
  'locked',
];

/** Shallow equality over the geometry fields (undefined = not provided). */
function sameGeometry(a: ItemGeometry, b: ItemGeometry): boolean {
  for (const key of GEOMETRY_KEYS) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** Merge a patch, skipping `undefined` fields (undefined means "keep"). */
function mergeGeometry(base: ItemGeometry, patch: Partial<ItemGeometry>): ItemGeometry {
  const next = { ...base };
  for (const key of GEOMETRY_KEYS) {
    const value = patch[key];
    if (value !== undefined) Object.assign(next, { [key]: value });
  }
  return next;
}

export class GeometryStore {
  private items = new Map<string, ItemGeometry>();
  private listeners = new Set<() => void>();
  private orderById = new Map<string, number>();
  private orderCounter = 0;
  /** Whether an item's dimensions are natural (auto-measured) vs explicit. */
  private autoDim = new Map<string, { width: boolean; height: boolean }>();

  /** Subscribe to any geometry change. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Register an item with its *initial* geometry (called on Item mount).
   * If the id already exists the provided fields are merged in, preserving
   * any measured natural size.
   *
   * `auto` records which dimensions are natural (auto-sized, measured by
   * ResizeObserver) rather than explicit — auto dimensions cannot be resized
   * or scaled until the consumer gives the item explicit dimensions.
   */
  register(
    id: string,
    geometry: Partial<ItemGeometry>,
    auto?: { width: boolean; height: boolean },
  ): void {
    const existing = this.items.get(id);
    const next = existing
      ? mergeGeometry(existing, geometry)
      : mergeGeometry(
          { id, x: 0, y: 0, rotation: 0 },
          { ...geometry, rotation: geometry.rotation ?? 0 },
        );
    if (!existing) {
      this.orderById.set(id, this.orderCounter++);
    }
    if (auto) this.autoDim.set(id, auto);
    this.items.set(id, next);
    this.emit();
  }

  /** Unregister an item (Item unmount). */
  unregister(id: string): void {
    if (this.items.delete(id)) {
      this.orderById.delete(id);
      this.autoDim.delete(id);
      this.emit();
    }
  }

  /** True when either dimension is natural (auto-measured) — resize/scale no-op. */
  isAutoSized(id: string): boolean {
    const auto = this.autoDim.get(id);
    if (!auto) return false;
    return auto.width || auto.height;
  }

  /** Read an item's current geometry (stable reference until it changes). */
  get(id: string): ItemGeometry | undefined {
    return this.items.get(id);
  }

  /** Apply a partial patch. No-op when nothing actually changes. */
  set(id: string, patch: Partial<ItemGeometry>): void {
    const current = this.items.get(id);
    if (!current) return;
    const next = mergeGeometry(current, patch);
    if (sameGeometry(current, next)) return;
    this.items.set(id, next);
    this.emit();
  }

  /**
   * Bulk sync (controlled mode / `ref.setItems`): update existing items,
   * register new ones, drop ids that are no longer present.
   */
  setMany(geometries: ItemGeometry[]): void {
    const present = new Set<string>();
    let changed = false;

    for (const g of geometries) {
      present.add(g.id);
      const current = this.items.get(g.id);
      if (!current) {
        this.register(g.id, g);
        changed = true;
      } else {
        const next = mergeGeometry(current, g);
        if (!sameGeometry(current, next)) {
          this.items.set(g.id, next);
          changed = true;
        }
      }
    }

    for (const id of [...this.items.keys()]) {
      if (!present.has(id)) {
        this.items.delete(id);
        this.orderById.delete(id);
        changed = true;
      }
    }

    if (changed) this.emit();
  }

  /** Effective stacking value: explicit zIndex, else mount order. */
  effectiveZ(id: string): number {
    const item = this.items.get(id);
    if (!item) return 0;
    return item.zIndex ?? this.orderById.get(id) ?? 0;
  }

  /** All geometries in render order (effective z ascending). */
  getAll(): ItemGeometry[] {
    return [...this.items.values()].sort(
      (a, b) => this.effectiveZ(a.id) - this.effectiveZ(b.id),
    );
  }

  get size(): number {
    return this.items.size;
  }
}

/**
 * Subscribe a component to a single item's geometry slice. The snapshot is the
 * item's immutable object — its identity only changes when *that* item's
 * geometry changes, so unrelated store updates never re-render the subscriber.
 */
export function useItemSnapshot(store: GeometryStore, id: string): ItemGeometry | undefined {
  const getSnapshot = useCallback(() => store.get(id), [store, id]);
  return useSyncExternalStore(store.subscribe, getSnapshot, () => undefined);
}
