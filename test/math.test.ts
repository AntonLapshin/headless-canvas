/**
 * Unit tests for the pure geometry math (hit.ts).
 */

import { describe, expect, it } from 'vitest';
import {
  angleFromCenter,
  clamp,
  DEFAULT_MIN_SIZE,
  hitTest,
  measureEdges,
  moveGeometry,
  normalizeRotation,
  resizeGeometry,
  rotateToGeometry,
  scaleGeometry,
  snap,
  toItemLocal,
} from '../src/hit';
import type { ItemGeometry } from '../src/types';

const item = (over: Partial<ItemGeometry> = {}): ItemGeometry => ({
  id: 'a',
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  rotation: 0,
  ...over,
});

describe('snap / clamp / rotation', () => {
  it('snap rounds to the grid', () => {
    expect(snap(17, 10)).toBe(20);
    expect(snap(13, 10)).toBe(10);
    expect(snap(17, undefined)).toBe(17);
    expect(snap(17, 0)).toBe(17);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it('normalizeRotation maps into [0, 360)', () => {
    expect(normalizeRotation(45)).toBe(45);
    expect(normalizeRotation(405)).toBe(45);
    expect(normalizeRotation(-45)).toBe(315);
    expect(normalizeRotation(720)).toBe(0);
  });

  it('angleFromCenter measures degrees from the positive x-axis', () => {
    expect(angleFromCenter(0, 0, 10, 0)).toBeCloseTo(0);
    expect(angleFromCenter(0, 0, 0, 10)).toBeCloseTo(90);
    expect(angleFromCenter(0, 0, -10, 0)).toBeCloseTo(180);
    expect(angleFromCenter(0, 0, 0, -10)).toBeCloseTo(-90);
  });
});

describe('moveGeometry', () => {
  it('translates by dx/dy', () => {
    expect(moveGeometry(item(), 10, 5, {})).toEqual({ x: 110, y: 55 });
  });

  it('snaps to the grid', () => {
    expect(moveGeometry(item(), 7, 3, { snapToGrid: 10 })).toEqual({ x: 110, y: 50 });
  });

  it('clamps to constraints', () => {
    const opts = { constraints: { minX: 0, minY: 0, maxX: 400, maxY: 300 } };
    expect(moveGeometry(item(), -500, -500, opts)).toEqual({ x: 0, y: 0 });
    // maxX - width: the item's right edge may not pass maxX
    expect(moveGeometry(item(), 500, 500, opts)).toEqual({ x: 200, y: 200 });
  });

  it('handles auto-sized items (undefined w/h treated as 0 for clamping)', () => {
    const opts = { constraints: { maxX: 300, maxY: 200 } };
    const auto = item({ width: undefined, height: undefined });
    expect(moveGeometry(auto, 500, 500, opts)).toEqual({ x: 300, y: 200 });
  });
});

describe('resizeGeometry', () => {
  it('is a no-op for auto-sized items (documented behavior)', () => {
    const auto = item({ width: undefined, height: undefined });
    expect(resizeGeometry(auto, 'se', 50, 50, {})).toEqual({});
  });

  it('se grows width and height, keeping x/y', () => {
    expect(resizeGeometry(item(), 'se', 50, 30, {})).toEqual({ x: 100, y: 50, width: 250, height: 130 });
  });

  it('nw keeps the bottom-right corner fixed', () => {
    const r = resizeGeometry(item(), 'nw', 40, 20, {});
    // Dragging the nw corner +40/+20 shrinks the item; the opposite corner
    // (100+200, 50+100) = (300, 150) stays fixed.
    expect(r.x! + r.width!).toBe(300);
    expect(r.y! + r.height!).toBe(150);
    expect(r.width).toBe(160);
    expect(r.height).toBe(80);
    expect(r.x).toBe(140);
    expect(r.y).toBe(70);
  });

  it('w keeps the right edge fixed; e keeps the left edge fixed', () => {
    const w = resizeGeometry(item(), 'w', 30, 0, {});
    expect(w.x! + w.width!).toBe(300);
    expect(w.x).toBe(130);
    expect(w.width).toBe(170);

    const e = resizeGeometry(item(), 'e', -30, 0, {});
    expect(e.x).toBe(100);
    expect(e.width).toBe(170);
  });

  it('n keeps the bottom edge fixed; s keeps the top edge fixed', () => {
    const n = resizeGeometry(item(), 'n', 0, -25, {});
    expect(n.y! + n.height!).toBe(150);
    expect(n.height).toBe(125);

    const s = resizeGeometry(item(), 's', 0, 25, {});
    expect(s.y).toBe(50);
    expect(s.height).toBe(125);
  });

  it('enforces min size', () => {
    const r = resizeGeometry(item(), 'se', -500, -500, {});
    expect(r.width).toBe(DEFAULT_MIN_SIZE);
    expect(r.height).toBe(DEFAULT_MIN_SIZE);
    // minWidth/minHeight from constraints win
    const c = resizeGeometry(item(), 'se', -500, -500, { constraints: { minWidth: 20, minHeight: 30 } });
    expect(c.width).toBe(20);
    expect(c.height).toBe(30);
  });

  it('snaps the moving edge to the grid', () => {
    // se with snapToGrid 50: right edge 100+200+37=337 → 350 → width 250
    const r = resizeGeometry(item(), 'se', 37, 0, { snapToGrid: 50 });
    expect(r.width).toBe(250);
  });

  it('clamps into bounds constraints', () => {
    const c = { constraints: { maxX: 400, maxY: 300 } };
    const r = resizeGeometry(item(), 'se', 500, 500, c);
    expect(r.x! + r.width!).toBeLessThanOrEqual(400);
    expect(r.y! + r.height!).toBeLessThanOrEqual(300);
  });
});

describe('scaleGeometry', () => {
  const sq = item({ width: 100, height: 50 }); // ratio 0.5

  it('scales proportionally with se anchor (x/y untouched by the patch)', () => {
    const r = scaleGeometry(sq, 'se', 100, 0, {});
    expect(r.width).toBe(200);
    expect(r.height).toBe(100); // 200 × 0.5
    // The patch is partial: x/y are omitted so the store keeps them.
    expect(r.x).toBeUndefined();
    expect(r.y).toBeUndefined();
  });

  it('center anchor keeps the center fixed', () => {
    const r = scaleGeometry(sq, 'center', 50, 0, {});
    // width 100 + 2*50 = 200; center was (150, 75)
    expect(r.width).toBe(200);
    expect(r.height).toBe(100);
    expect(r.x).toBe(150 - 100);
    expect(r.y).toBe(75 - 50);
  });

  it('snaps the scaled width', () => {
    const r = scaleGeometry(sq, 'se', 37, 0, { snapToGrid: 50 });
    expect(r.width).toBe(150);
    expect(r.height).toBe(75);
  });

  it('respects min sizes and keeps the ratio', () => {
    const r = scaleGeometry(sq, 'se', -500, 0, {});
    // width clamps to min 8, but the ratio (0.5) forces height = min 8 →
    // width grows to 16 so height reaches its min.
    expect(r.width).toBe(16);
    expect(r.height).toBe(8);
  });

  it('is a no-op for auto-sized or zero-width items', () => {
    expect(scaleGeometry(item({ width: undefined }), 'se', 50, 0, {})).toEqual({});
    expect(scaleGeometry(item({ width: 0 }), 'se', 50, 0, {})).toEqual({});
  });

  it('ne anchor keeps the bottom-left corner fixed', () => {
    // Item (100, 50) 200×100 → bottom-left corner (100, 150).
    const r = scaleGeometry(item(), 'ne', 50, 0, {});
    expect(r.width).toBe(250);
    expect(r.height).toBe(125);
    expect(r.x).toBeUndefined(); // left edge fixed → x omitted from the patch
    expect(r.y).toBe(150 - 125); // top edge moves up from the fixed bottom
  });

  it('sw anchor keeps the top-right corner fixed', () => {
    // Top-right corner (300, 50). A +40 drag on the left-edge handle shrinks it.
    const r = scaleGeometry(item(), 'sw', 40, 0, {});
    expect(r.width).toBe(160);
    expect(r.height).toBe(80);
    expect(r.x).toBe(300 - 160); // left edge moves, right edge fixed
    expect(r.y).toBeUndefined(); // top edge fixed → y omitted from the patch
  });

  it('nw anchor keeps the bottom-right corner fixed', () => {
    const r = scaleGeometry(item(), 'nw', 50, 0, {});
    expect(r.width).toBe(150);
    expect(r.height).toBe(75);
    expect(r.x).toBe(300 - 150);
    expect(r.y).toBe(150 - 75);
  });

  it('clamps to bounds per anchor', () => {
    const c = { constraints: { minX: 0, minY: 0, maxX: 400, maxY: 300 } };
    // se: right edge ≤ 400 → width ≤ 300 (bottom bound allows 500 at ratio 0.5).
    const se = scaleGeometry(item(), 'se', 500, 0, c);
    expect(se.width).toBe(300);
    expect(se.height).toBe(150);
    // ne: right ≤ 400 → width ≤ 300; top ≥ 0 → width ≤ (150-0)/0.5 = 300.
    const ne = scaleGeometry(item(), 'ne', 500, 0, c);
    expect(ne.width).toBe(300);
    expect(ne.y).toBe(150 - 150);
    // center: symmetric bounds around (200, 100) → width ≤ 2·min(200, 200) and
    // 2·min(100/0.5, 200/0.5) → 400.
    const center = scaleGeometry(item(), 'center', 500, 0, c);
    expect(center.width).toBe(400);
    expect(center.height).toBe(200);
    expect(center.x).toBe(200 - 200);
    expect(center.y).toBe(100 - 100);
  });
});

describe('resizeGeometry lockRatio', () => {
  it('se corner keeps the ratio, top-left fixed (like the old ScaleHandle)', () => {
    const r = resizeGeometry(item(), 'se', 50, 30, { lockRatio: true });
    // 200×100 at ratio 0.5 → width 250, height 125; x/y unchanged (omitted).
    expect(r.width).toBe(250);
    expect(r.height).toBe(125);
    expect(r.x).toBeUndefined();
    expect(r.y).toBeUndefined();
  });

  it('ne corner keeps the ratio, bottom-left fixed', () => {
    const r = resizeGeometry(item(), 'ne', 50, 0, { lockRatio: true });
    expect(r.width).toBe(250);
    expect(r.height).toBe(125);
    expect(r.y).toBe(150 - 125); // bottom edge fixed at 150
    expect(r.x).toBeUndefined(); // left edge fixed
  });

  it('e edge scales the perpendicular axis proportionally around the center', () => {
    const r = resizeGeometry(item(), 'e', 40, 0, { lockRatio: true });
    expect(r.width).toBe(240);
    expect(r.height).toBe(120); // ratio 0.5
    expect(r.y).toBe(50 + (100 - 120) / 2); // vertical center fixed
  });

  it('w edge keeps the right edge fixed and centers vertically', () => {
    const r = resizeGeometry(item(), 'w', -40, 0, { lockRatio: true });
    expect(r.width).toBe(240);
    expect(r.height).toBe(120);
    expect(r.x).toBe(100 + 200 - 240); // right edge fixed at 300
    expect(r.y).toBe(40);
  });

  it('s edge scales the perpendicular axis proportionally around the center', () => {
    const r = resizeGeometry(item(), 's', 0, 40, { lockRatio: true });
    expect(r.height).toBe(140);
    expect(r.width).toBe(280); // 140 / 0.5
    expect(r.x).toBe(100 + (200 - 280) / 2); // horizontal center fixed
  });

  it('n edge keeps the bottom edge fixed and centers horizontally', () => {
    const r = resizeGeometry(item(), 'n', 0, -40, { lockRatio: true });
    expect(r.height).toBe(140);
    expect(r.width).toBe(280);
    expect(r.y).toBe(50 + 100 - 140); // bottom edge fixed at 150
    expect(r.x).toBe(60);
  });

  it('respects min sizes while keeping the ratio', () => {
    const r = resizeGeometry(item(), 'se', -500, -500, { lockRatio: true });
    // ratio 0.5: height min 8 forces width min 16.
    expect(r.width).toBe(16);
    expect(r.height).toBe(8);
  });

  it('clamps into bounds constraints', () => {
    const c = { constraints: { maxX: 400, maxY: 300 } };
    const r = resizeGeometry(item(), 'e', 500, 0, { lockRatio: true, ...c });
    expect(r.width).toBeLessThanOrEqual(400 - item().x);
    expect(r.height).toBeLessThanOrEqual(300 - item().y);
    expect(r.width! / r.height!).toBeCloseTo(2, 5); // ratio preserved
  });
});

describe('measureEdges', () => {
  const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 300 };

  it('measures the distance from each edge to the canvas bound', () => {
    // 200×100 at (100, 50) on a 400×300 canvas.
    const edges = measureEdges(item(), bounds);
    expect(edges).toEqual([
      { edge: 'top', distance: 50 },
      { edge: 'bottom', distance: 150 },
      { edge: 'left', distance: 100 },
      { edge: 'right', distance: 100 },
    ]);
  });

  it('always targets the canvas bound — other items are ignored', () => {
    // (Old behavior measured to the nearest item edge; now the target is
    // always the canvas bound.) An item 10px above must NOT shorten the top
    // line: it stays at the canvas distance 50.
    const edges = measureEdges(item(), bounds);
    expect(edges.find((e) => e.edge === 'top')!.distance).toBe(50);
  });

  it('omits edges flush against a bound (distance 0)', () => {
    // Item flush with the top and left canvas edges → those lines are skipped.
    const flush = item({ x: 0, y: 0 });
    const edges = measureEdges(flush, bounds);
    expect(edges.find((e) => e.edge === 'top')).toBeUndefined();
    expect(edges.find((e) => e.edge === 'left')).toBeUndefined();
    expect(edges.find((e) => e.edge === 'bottom')!.distance).toBe(200);
    expect(edges.find((e) => e.edge === 'right')!.distance).toBe(200);
  });
});

describe('rotateToGeometry', () => {
  it('sets a normalized absolute rotation', () => {
    expect(rotateToGeometry(item(), 45)).toEqual({ rotation: 45 });
    expect(rotateToGeometry(item(), 405)).toEqual({ rotation: 45 });
    expect(rotateToGeometry(item(), -90)).toEqual({ rotation: 270 });
  });
});

describe('toItemLocal', () => {
  it('is the identity for unrotated items', () => {
    const p = toItemLocal({ x: 150, y: 75 }, item());
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(25);
  });

  it('un-rotates the point for rotated items', () => {
    // 90° rotation around center (200, 100): point (200, 150) → local (150, 50)
    const rotated = item({ rotation: 90 });
    const p = toItemLocal({ x: 200, y: 150 }, rotated);
    expect(p.x).toBeCloseTo(150, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });
});

describe('hitTest', () => {
  const feature = (itemId: string, rect: { x: number; y: number; width: number; height: number }) => ({
    id: `f-${itemId}`,
    itemId,
    kind: 'move' as const,
    getHitRect: () => rect,
  });

  it('returns empty for a miss', () => {
    expect(hitTest({ point: { x: 0, y: 0 }, itemsTopmostFirst: [item()], features: [] })).toEqual({
      type: 'empty',
    });
  });

  it('hits an item body', () => {
    const r = hitTest({ point: { x: 150, y: 75 }, itemsTopmostFirst: [item()], features: [] });
    expect(r).toEqual({ type: 'item', itemId: 'a' });
  });

  it('feature wins over the body of the same item', () => {
    const r = hitTest({
      point: { x: 150, y: 75 },
      itemsTopmostFirst: [item()],
      features: [feature('a', { x: 0, y: 0, width: 200, height: 100 })],
    });
    expect(r.type).toBe('feature');
  });

  it('topmost item wins', () => {
    const behind = item({ id: 'behind' });
    const front = item({ id: 'front', x: 100, y: 50 });
    const r = hitTest({
      point: { x: 150, y: 75 },
      itemsTopmostFirst: [front, behind], // already topmost-first
      features: [],
    });
    expect(r).toEqual({ type: 'item', itemId: 'front' });
  });

  it('a feature of a covered item is not hit', () => {
    const behind = item({ id: 'behind' });
    const front = item({ id: 'front' });
    const r = hitTest({
      point: { x: 150, y: 75 },
      itemsTopmostFirst: [front, behind],
      features: [feature('behind', { x: 0, y: 0, width: 200, height: 100 })],
    });
    expect(r).toEqual({ type: 'item', itemId: 'front' });
  });

  it('checks a same-item feature region in item-local (rotated) space', () => {
    const rotated = item({ rotation: 90 });
    // Item: x=100, y=50, 200×100, rotated 90° around center (200, 100).
    // The local origin (0,0) maps to canvas point (250, 0).
    const r = hitTest({
      point: { x: 250, y: 0 },
      itemsTopmostFirst: [rotated],
      features: [feature('a', { x: -10, y: -10, width: 20, height: 20 })],
    });
    expect(r.type).toBe('feature');
  });
});
