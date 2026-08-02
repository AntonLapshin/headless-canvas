/**
 * Component + interaction tests: pointer drags, selection, keyboard, a11y,
 * controlled/uncontrolled modes, disabled/locked behavior, ref handle.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Canvas } from '../src/Canvas';
import { Item } from '../src/Item';
import { MoveHandle, ResizeHandle, RotateHandle, ScaleHandle } from '../src/features';
import styles from '../src/canvas.module.scss';
import type { CanvasHandle, ItemGeometry } from '../src/types';
import { emitResize } from './setup';
import { drag, renderCanvas } from './helpers';

/** Small fixture: two items with move + resize handles. */
function Fixture(props: {
  onSelect?: (id: string | null) => void;
  canvasRef?: React.Ref<CanvasHandle>;
  onItemsChange?: (items: ItemGeometry[]) => void;
  disabled?: boolean;
  snapToGrid?: number;
  constraints?: { maxX: number; maxY: number };
  onDragStart?: (id: string, kind: string) => void;
  onDragEnd?: (id: string, kind: string) => void;
  onItemDoubleClick?: (id: string) => void;
}) {
  return (
    <Canvas
      width={400}
      height={300}
      ref={props.canvasRef}
      onSelect={props.onSelect}
      onItemsChange={props.onItemsChange}
      disabled={props.disabled}
      snapToGrid={props.snapToGrid}
      constraints={props.constraints}
      onDragStart={props.onDragStart as never}
      onDragEnd={props.onDragEnd as never}
      onItemDoubleClick={props.onItemDoubleClick}
      aria-label="Test canvas"
    >
      <Item
        id="a"
        x={100}
        y={50}
        width={200}
        height={100}
        features={
          <>
            <MoveHandle />
            <ResizeHandle direction="se" />
          </>
        }
      >
        <span>A</span>
      </Item>
      <Item id="b" x={20} y={20} width={60} height={40}>
        <span>B</span>
      </Item>
    </Canvas>
  );
}

/** Capture a canvas handle via callback ref. */
function makeRef() {
  const holder: { current: CanvasHandle | null } = { current: null };
  return {
    holder,
    ref: (h: CanvasHandle | null) => {
      holder.current = h;
    },
  };
}

/** Wait for any throttled (rAF/setTimeout) callbacks to flush. */
async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 25));
  });
}

describe('rendering & data attributes', () => {
  it('renders the canvas root with role=group and aria-label', () => {
    const { root } = renderCanvas(<Fixture />);
    expect(root).toHaveAttribute('data-canvas');
    expect(root).toHaveAttribute('role', 'group');
    expect(root).toHaveAttribute('aria-label', 'Test canvas');
  });

  it('renders item wrappers with the data-attribute contract', () => {
    render(<Fixture />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-item-id', 'a');
    expect(itemA).toHaveAttribute('data-selected', 'false');
    expect(itemA).toHaveAttribute('data-hovered', 'false');
    expect(itemA).toHaveAttribute('data-locked', 'false');
    expect(itemA).toHaveAttribute('data-disabled', 'false');
    expect(itemA).toHaveAttribute('tabindex', '0');
    expect(itemA).toHaveAttribute('aria-selected', 'false');
    expect(itemA.style.left).toBe('100px');
    expect(itemA.style.top).toBe('50px');
    expect(itemA.style.width).toBe('200px');
    expect(itemA.style.height).toBe('100px');
  });

  it('renders feature anchors with data-feature + data-direction, no visuals', () => {
    render(<Fixture />);
    const move = document.querySelector('[data-feature="move"]') as HTMLElement;
    const resize = document.querySelector('[data-feature="resize"]') as HTMLElement;
    expect(move).toBeTruthy();
    expect(resize).toHaveAttribute('data-direction', 'se');
    // Anchors carry no consumer-visible classes of their own — only the
    // library's structural `.feature` module class.
    expect(resize).toHaveClass(styles.feature);
    expect(move).toHaveClass(styles.feature);
    expect(resize.className).toBe(styles.feature);
  });
});

describe('selection', () => {
  it('selects an item on body click and deselects on empty click', () => {
    const onSelect = vi.fn();
    const { root } = renderCanvas(<Fixture onSelect={onSelect} />);
    fireEvent.pointerDown(root, { clientX: 150, clientY: 75, pointerId: 1, buttons: 1 });
    expect(onSelect).toHaveBeenLastCalledWith('a');
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'true');
    fireEvent.pointerDown(root, { clientX: 5, clientY: 5, pointerId: 1, buttons: 1 });
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('fires onItemDoubleClick with the hit item id', () => {
    const onItemDoubleClick = vi.fn();
    const { root } = renderCanvas(<Fixture onItemDoubleClick={onItemDoubleClick} />);
    fireEvent.doubleClick(root, { clientX: 150, clientY: 75 });
    expect(onItemDoubleClick).toHaveBeenCalledWith('a');
  });
});

describe('move drag', () => {
  it('moves the item by the pointer delta', async () => {
    const onItemsChange = vi.fn();
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} onItemsChange={onItemsChange} />);
    drag(root, { x: 150, y: 75 }, { x: 170, y: 95 });
    const items = holder.current!.getItems();
    const a = items.find((i) => i.id === 'a')!;
    expect(a.x).toBe(120);
    expect(a.y).toBe(70);
    // final exact payload fired on pointerup
    expect(onItemsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'a', x: 120, y: 70 })]),
    );
    await flushAsync();
  });

  it('fires onDragStart/onDragEnd with the drag kind', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const { root } = renderCanvas(<Fixture onDragStart={onDragStart} onDragEnd={onDragEnd} />);
    drag(root, { x: 150, y: 75 }, { x: 160, y: 80 });
    expect(onDragStart).toHaveBeenCalledWith('a', 'move');
    expect(onDragEnd).toHaveBeenCalledWith('a', 'move');
  });

  it('respects snapToGrid on both axes', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} snapToGrid={50} />);
    drag(root, { x: 150, y: 75 }, { x: 173, y: 91 }); // dx 23, dy 16
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100); // 123 → 100 (snap to 50)
    expect(a.y).toBe(50); // 66 → 50
  });

  it('clamps to constraints', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} constraints={{ maxX: 380, maxY: 280 }} />);
    drag(root, { x: 150, y: 75 }, { x: 400, y: 300 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(180); // right edge may not pass 380
    expect(a.y).toBe(180);
  });

  it('clamps to the canvas bounds by default (no constraints prop)', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // Item a is 200×100 at (100, 50) on a 400×300 canvas → x ≤ 200, y ≤ 200.
    drag(root, { x: 150, y: 75 }, { x: 600, y: 400 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(200);
    expect(a.y).toBe(200);
    expect(a.x + a.width!).toBe(400); // right edge flush with the canvas
    expect(a.y + a.height!).toBe(300); // bottom edge flush with the canvas
  });

  it('does not move a locked item, but still selects it', () => {
    const onSelect = vi.fn();
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} onSelect={onSelect} aria-label="locked canvas">
        <Item id="l" x={100} y={50} width={200} height={100} locked features={<MoveHandle />}>
          <span>L</span>
        </Item>
      </Canvas>,
    );
    drag(root, { x: 150, y: 75 }, { x: 200, y: 100 });
    const l = holder.current!.getItems()[0];
    expect(l.x).toBe(100);
    expect(l.y).toBe(50);
    expect(onSelect).toHaveBeenCalledWith('l');
  });
});

describe('resize drag', () => {
  it('resizes from the se handle, keeping x/y', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // se handle hit region is a 20×20 square around local (200, 100) → canvas (300, 150)
    drag(root, { x: 300, y: 150 }, { x: 350, y: 180 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
    expect(a.width).toBe(250);
    expect(a.height).toBe(130);
  });

  it('nw resize keeps the opposite corner fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="nw canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ResizeHandle direction="nw" />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    drag(root, { x: 100, y: 50 }, { x: 80, y: 40 }); // dx -20, dy -10
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(220);
    expect(a.height).toBe(110);
    expect(a.x + a.width!).toBe(300); // right edge fixed
    expect(a.y + a.height!).toBe(150); // bottom edge fixed
  });

  it('clamps to min size', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // Drag the se corner far past the top-left: dx -200, dy -100 → min sizes.
    drag(root, { x: 300, y: 150 }, { x: 100, y: 50 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.width).toBe(8);
    expect(a.height).toBe(8);
  });

  it('clamps resize growth to the canvas bounds by default', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} />);
    // se drag far past the right/bottom edges: width capped at maxX - x = 300,
    // height capped at maxY - y = 250.
    drag(root, { x: 300, y: 150 }, { x: 500, y: 400 });
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.width).toBe(300);
    expect(a.height).toBe(250);
    expect(a.x + a.width!).toBe(400);
    expect(a.y + a.height!).toBe(300);
  });
});

describe('scale drag', () => {
  it('scales proportionally from the se anchor', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="scale canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ScaleHandle anchor="se" />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    drag(root, { x: 300, y: 150 }, { x: 350, y: 150 }); // dx 50
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(250);
    expect(a.height).toBe(125); // ratio 0.5
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });

  it('defaults to the ne anchor (top-right): bottom-left corner stays fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="scale ne canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ScaleHandle />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // ne handle at local (200, 0) → canvas (300, 50); drag +50 wide.
    drag(root, { x: 300, y: 50 }, { x: 350, y: 50 });
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(250);
    expect(a.height).toBe(125);
    expect(a.x).toBe(100); // left edge fixed (bottom-left corner stays put)
    expect(a.y).toBe(25); // bottom edge fixed at 150 → top moves up
  });

  it('clamps scale growth to the canvas bounds (default constraints)', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="scale bounds canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ScaleHandle anchor="se" />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // Drag the se corner far past the right edge: dx 300 → width would be 500,
    // but the right edge may not pass 400 and the bottom not pass 300.
    drag(root, { x: 300, y: 150 }, { x: 600, y: 150 });
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(300); // maxX - x = 400 - 100
    expect(a.height).toBe(150); // keeps the ratio 0.5
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });

  it('center anchor keeps the center fixed', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="scale center canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<ScaleHandle anchor="center" />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    drag(root, { x: 200, y: 100 }, { x: 250, y: 100 }); // dx 50 → width +100
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(300);
    expect(a.height).toBe(150);
    expect(a.x).toBe(50); // center x stays 200
    expect(a.y).toBe(25); // center y stays 100
  });
});

describe('rotate drag', () => {
  it('rotates by the pointer angle delta around the item center', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="rotate canvas">
        <Item id="a" x={100} y={50} width={200} height={100} features={<RotateHandle />}>
          <span>A</span>
        </Item>
      </Canvas>,
    );
    // handle at local (100, -24) → canvas (200, 26); center (200, 100)
    // start angle -90°, drag to (300, 100) → angle 0° → delta +90°
    drag(root, { x: 200, y: 26 }, { x: 300, y: 100 });
    const a = holder.current!.getItems()[0];
    expect(a.rotation).toBe(90);
  });
});

describe('natural-size measurement', () => {
  it('measures auto-sized items and reports the size in onItemsChange', async () => {
    const onItemsChange = vi.fn();
    const { holder, ref } = makeRef();
    renderCanvas(
      <Canvas width={400} height={300} ref={ref} onItemsChange={onItemsChange} aria-label="auto canvas">
        <Item id="auto" x={10} y={10}>
          <span>Auto sized content</span>
        </Item>
      </Canvas>,
    );
    const el = document.querySelector('[data-item-id="auto"]')!;
    act(() => emitResize(el, 140, 28));
    const a = holder.current!.getItems()[0];
    expect(a.width).toBe(140);
    expect(a.height).toBe(28);
    await flushAsync();
    expect(onItemsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'auto', width: 140, height: 28 })]),
    );
  });

  it('ignores a ResizeHandle on an auto-sized item (documented no-op)', () => {
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(
      <Canvas width={400} height={300} ref={ref} aria-label="auto resize canvas">
        <Item id="auto" x={10} y={10} features={<ResizeHandle direction="se" />}>
          <span>Auto</span>
        </Item>
      </Canvas>,
    );
    act(() => emitResize(document.querySelector('[data-item-id="auto"]')!, 100, 40));
    const before = holder.current!.getItems()[0];
    // se handle at local (100, 40) → canvas (110, 50)
    drag(root, { x: 110, y: 50 }, { x: 150, y: 90 });
    const after = holder.current!.getItems()[0];
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
  });
});

describe('controlled mode', () => {
  it('mirrors the items prop and round-trips drags through onItemsChange', async () => {
    const { holder, ref } = makeRef();
    const latestState: { value: string } = { value: '' };
    function Harness() {
      const [items, setItems] = useState<ItemGeometry[]>([
        { id: 'a', x: 100, y: 50, width: 200, height: 100 },
      ]);
      latestState.value = items[0]?.x?.toFixed(0) ?? 'none';
      return (
        <Canvas
          width={400}
          height={300}
          ref={ref}
          items={items}
          onItemsChange={(next) => setItems(next)}
          aria-label="controlled canvas"
        >
          <Item id="a" x={100} y={50} width={200} height={100} features={<MoveHandle />}>
            <span>A</span>
          </Item>
        </Canvas>
      );
    }
    const { root } = renderCanvas(<Harness />);
    drag(root, { x: 150, y: 75 }, { x: 190, y: 95 });
    expect(latestState.value).toBe('140');
    await flushAsync();
    expect(holder.current!.getItems()[0].x).toBe(140);
  });

  it('controlled selection: onSelect fires and the prop wins', () => {
    const onSelect = vi.fn();
    const Harness = () => {
      const [sel, setSel] = useState<string | null>(null);
      return (
        <Canvas
          width={400}
          height={300}
          selectedId={sel}
          onSelect={(id) => {
            setSel(id);
            onSelect(id);
          }}
          aria-label="controlled selection canvas"
        >
          <Item id="a" x={100} y={50} width={200} height={100}>
            <span>A</span>
          </Item>
        </Canvas>
      );
    };
    const { root } = renderCanvas(<Harness />);
    fireEvent.pointerDown(root, { clientX: 150, clientY: 75, pointerId: 1, buttons: 1 });
    expect(onSelect).toHaveBeenCalledWith('a');
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'true');
  });
});

describe('disabled canvas', () => {
  it('renders but disables selection, drag and hover', () => {
    const onSelect = vi.fn();
    const { holder, ref } = makeRef();
    const { root } = renderCanvas(<Fixture canvasRef={ref} disabled onSelect={onSelect} />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-disabled', 'true');
    expect(itemA).not.toHaveAttribute('tabindex');

    drag(root, { x: 150, y: 75 }, { x: 200, y: 100 });
    expect(onSelect).not.toHaveBeenCalled();
    const a = holder.current!.getItems().find((i) => i.id === 'a')!;
    expect(a.x).toBe(100);

    fireEvent.pointerMove(root, { clientX: 150, clientY: 75, buttons: 0 });
    expect(itemA).toHaveAttribute('data-hovered', 'false');
  });
});

describe('keyboard', () => {
  function keyboardFixture() {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    return {
      itemA,
      get: () => holder.current!.getItems().find((i) => i.id === 'a')!,
    };
  }

  it('arrow keys move the focused item', () => {
    const { itemA, get } = keyboardFixture();
    fireEvent.keyDown(itemA, { key: 'ArrowRight' });
    fireEvent.keyDown(itemA, { key: 'ArrowDown' });
    expect(get().x).toBe(101);
    expect(get().y).toBe(51);
  });

  it('keyboard moves respect the canvas bounds', () => {
    const { itemA, get } = keyboardFixture();
    // Item a is 200×100 at (100, 50) on a 400×300 canvas → x clamps at 200.
    for (let i = 0; i < 150; i++) fireEvent.keyDown(itemA, { key: 'ArrowRight' });
    const a = get();
    expect(a.x).toBe(200);
    expect(a.x + a.width!).toBe(400); // right edge flush with the canvas
  });

  it('shift+arrows resize from the fixed top-left', () => {
    const { itemA, get } = keyboardFixture();
    fireEvent.keyDown(itemA, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(itemA, { key: 'ArrowDown', shiftKey: true });
    const a = get();
    expect(a.width).toBe(201);
    expect(a.height).toBe(101);
    expect(a.x).toBe(100);
    expect(a.y).toBe(50);
  });

  it('r rotates by ±15° and Esc deselects', () => {
    const { itemA, get } = keyboardFixture();
    fireEvent.keyDown(itemA, { key: 'r' });
    expect(get().rotation).toBe(15);
    fireEvent.keyDown(itemA, { key: 'R' });
    expect(get().rotation).toBe(0);
    fireEvent.keyDown(itemA, { key: 'Escape' });
    expect(itemA).toHaveAttribute('data-selected', 'false');
  });
});

describe('ref handle (CanvasHandle)', () => {
  it('getItems returns geometries in render order; bringToFront/sendToBack reorder', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    // Mount order: a (0), b (1) → render order a, b
    expect(holder.current!.getItems().map((i) => i.id)).toEqual(['a', 'b']);

    // Raise a above b: a.zIndex = max(0,1)+1 = 2
    holder.current!.bringToFront('a');
    let items = holder.current!.getItems();
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(items.find((i) => i.id === 'a')!.zIndex).toBe(2);

    // Lower b below everything: b.zIndex = min(2,1)-1 = 0
    holder.current!.sendToBack('b');
    items = holder.current!.getItems();
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(items.find((i) => i.id === 'b')!.zIndex).toBe(0);
  });

  it('setItems replaces all geometries', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    holder.current!.setItems([{ id: 'a', x: 1, y: 2, width: 3, height: 4 }]);
    const items = holder.current!.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'a', x: 1, y: 2 });
  });

  it('select via ref works', () => {
    const { holder, ref } = makeRef();
    renderCanvas(<Fixture canvasRef={ref} />);
    act(() => holder.current!.select('a'));
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    expect(itemA).toHaveAttribute('data-selected', 'true');
    act(() => holder.current!.select(null));
    expect(itemA).toHaveAttribute('data-selected', 'false');
  });
});

describe('hover', () => {
  it('tracks hoveredId and drives data-hovered', () => {
    const { root } = renderCanvas(<Fixture />);
    const itemA = screen.getByText('A').closest('[data-item-id="a"]') as HTMLElement;
    fireEvent.pointerMove(root, { clientX: 150, clientY: 75, buttons: 0 });
    expect(itemA).toHaveAttribute('data-hovered', 'true');
    fireEvent.pointerMove(root, { clientX: 5, clientY: 5, buttons: 0 });
    expect(itemA).toHaveAttribute('data-hovered', 'false');
  });
});
